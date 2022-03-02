import requests
import time
import json
import re
from zipfile import ZipFile
from locaria_load_utils import get_parameters

def custom_loader_main(db,file):
    func = file["attributes"]["custom_loader"]
    if func == 'planning_loader':
        return planning_loader(db,file)
    elif func == 'flood_loader':
        return flood_loader(db,file)
    elif func == 'os_opendata':
        return os_opendata_loader(db, file)
    else:
        return 'ERROR'

def os_opendata_loader(db,file):

    parameters = get_parameters(db,"opennames_loader")['opennames_loader']
    url = parameters.get('os_opendata_api_url','https://api.os.uk/downloads/v1/products')
    os_products = requests.get(url).json()

    # First we get a list of all products, then extract the download url from the one we want
    downloadURL = ''
    for product in os_products:
        if product['id'] == file["attributes"]["product"]:

            # Next we have to get details of the product we require
            product_details = requests.get(product['url']).json()
            #Check whether this version is already loaded
            lastVersion  = parameters.get('opennames_version', '')
            if lastVersion == product_details['version']:
                return {'status' : 'CANCELLED', 'result' : 'OS LOADER', 'message' : f"Version {lastVersion} already loaded"}

            print(f"Loading version {product_details['version']}")
            # Finally we have to get a download url for the format we are interest in
            format_list = requests.get(product_details["downloadsUrl"]).json()
            format = file["attributes"].get("format", "GeoPackage")
            for formats in format_list:
                if formats["format"] == format:
                    print(f"Loading format {format}")
                    downloadURL = formats['url']
                    break

    # Now get a temp dir and download zip file to it
    tmp_dir = file["attributes"]["tmp_dir"]
    print(f"Downloading from {downloadURL} to temporary directory: {tmp_dir}")
    osData = requests.get(downloadURL)
    tmpZipFile = f"{tmp_dir}/osData.zip"
    with open(tmpZipFile, 'wb') as f:
        f.write(osData.content)

    # OS Zip files contain all sorts of stuff we are not interested in
    with ZipFile(tmpZipFile) as extractor:
        extractor.extractall(tmp_dir)
        zipList = extractor.namelist()

    # Look for gpkg by default but can be overridden
    searchExt = '\.' + file["attributes"].get('ext', 'gpkg')

    retFileName = ''
    for unZippedFile in zipList:
        if re.search(searchExt, unZippedFile):
            retFileName = tmp_dir + "/" + unZippedFile
            break

    if(retFileName) == '':
        return {'status' : 'ERROR', 'result' : 'OS LOADER', 'message' : 'Extension not found in OS zipfile'}

    print(retFileName)
    return {'filename' : retFileName, 'version' : product_details['version']}

def flood_loader(db,file):
    print ("Flood Loader")

    base_url = 'https://environment.data.gov.uk/flood-monitoring/id/'
    if not 'name' in file['attributes']:
        return {'status' : 'ERROR', 'result' : 'Missing county', 'message' : 'Missing county for flood_loader'}

    path = file['attributes']['path']
    url = f"{base_url}floods?county={file['attributes']['county']}"
    req = requests.get(url)
    req_data = req.json()
    data = req_data['items']
    print(data)
    if len(data) > 0:
        #format as geojson
        geojson = {'type' : 'FeatureCollection'}
        features = []
        # get floodarea centroid
        for f in data:
            url = f"{base_url}floodAreas/{f['floodAreaID']}"
            req = requests.get(url)
            station = req.json()
            f['longitude'] = station['items']['long']
            f['latitude'] = station['items']['lat']
            f['url'] = f['@id']
            features.extend([{'type' : 'Feature', 'geometry' : {'type' : 'Point', 'coordinates' : [f['longitude'],f['latitude']]}, 'properties' : f}])

        geojson['features'] = features
        print(f"Writing to {path}")
        with open(path, 'w') as p:
            json.dump(geojson,p)

    else:
        return {'status' : 'ERROR', 'result' : 'No flood data', 'message' : 'No flood data'}

    return {'filename': path}

def planning_loader(db,file):

    parameters = get_parameters(db,"planning_loader")['planning_loader']
    base_url = parameters.get('url', 'https://www.planit.org.uk/api/applics/json')
    pageSize = file['attributes'].get('pageSize', 1000)
    index = file['attributes'].get('index', 1000)
    recent = file['attributes'].get('recent', 60)

    if not 'authority' in file['attributes']:
        return {'status' : 'ERROR', 'result' : 'Missing authority', 'message' : 'Missing authority code for planning_loader'}

    fetch = True
    fetched = 0
    rate_limit = 5
    remaining = 0
    path = file['attributes']['path']

    data = []
    while(fetch):
        url = f"{base_url}?auth={file['attributes']['authority']}&recent={recent}&pg_sz={pageSize}&index={index}"
        req = requests.get(url)
        if req == None or not 'total' in req.json():
            fetch = False
            continue

        req_data = req.json()

        if int(req_data['total']) > 0:
            data.extend(req.json()['records'])
            to = int(req_data['to'])
            total = int(req_data['total'])
        else:
            fetch = False
            continue

        if total <= to + 1:
            fetch = False
            continue

        remaining = total - to + 1
        index = to + 1
        page = page if remaining > page else remaining
        fetched = fetched + 1

        if(fetched >= rate_limit):
            print('Paused for rate limit')
            fetched = 0
            time.sleep(60)

    if len(data) > 0:
        #format as geojson
        geojson = {'type' : 'FeatureCollection'}
        features = []
        for f in data:
           # f['text'] = f['message']
           # f['title'] = f['description']
            features.extend([{'type' : 'Feature', 'geometry' : {'type' : 'Point', 'coordinates' : [f['location_x'], f['location_y']]}, 'properties' : f}])

        geojson['features'] = features

        print(f"Writing to {path}")
        with open(path, 'w') as p:
            json.dump(geojson,p)

    return {'filename': path}