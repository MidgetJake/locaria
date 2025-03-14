import React, {useState,useEffect} from "react"
import {DataGrid} from '@mui/x-data-grid'
import {useCookies} from "react-cookie";
import LinearProgress from '@mui/material/LinearProgress';
import AdminFileUploader from '../../locaria/components/admin/components/adminFileUploader'
import Box from '@mui/material/Box';
import Button from '@mui/material/Button'
import AdminFileDetails from "../adminFileDetails";
import AdminDataMapper from "../adminDataMapper";
import AdminPlanningLoader from "../adminPlanningLoader";
import AdminFloodMonitoringLoader from "../adminFloodMonitoringLoader";
import AdminCrimeLoader from "../adminCrimeLoader.js";
import AdminBoundaryLoader from "../adminBoundaryLoader";
import AdminEventsLoader from "../adminEventsLoader";
import AdminDataDownload from "../adminDataDownload";
import {Drawer} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {useStyles} from "../../theme/default/adminStyle";

import {closeEditDrawer} from "../editDrawerSlice";
import {useHistory} from "react-router-dom";
import {closeEditFeatureDrawer} from "../editFeatureDrawerSlice";
import {setTitle} from "../adminSlice";
import {closeSystemConfigDrawer} from "../systemConfigDrawerSlice";
import {closeAdminPageDrawer} from "../../locaria/components/admin/redux/slices/adminPagesSlice";
import {closeDashboardDrawer} from "../adminDashboardDrawerSlice";
import {closeAdminCategoryDrawer} from "../adminCategoryDrawerSlice";
import {closeLanguageDrawer} from "../adminLanguageDrawerSlice";
//Details of file we are going to map
let fileDetailsData = {}

//How often we poll for file updates,default is 30 seconds
let defaultRefreshInterval = 5000

export default function AdminUploadDrawer(props) {

    const open = useSelector((state) => state.adminUploadDrawer.open);
    const classes = useStyles();
    const dispatch = useDispatch()
    const history = useHistory();

    const [cookies, setCookies] = useCookies(['location'])
    // hook for file listing display
    const [tableData,setTableData] = useState([])
    // hook set when we are fetching details of files, used by AdminFileUploader to force a re-render after upload
    const [dataFetching, setDataFetching] = useState(true)
    // hook used to open/close the file details control
    const [openDetails, setOpenDetails] = React.useState(false);
    //hook used to trigger a refresh from a timer to update the file listing from database
    const [time, setTime] = useState(Date.now());
    //hook used to display the data mapping component
    const [mapFileDetails,setMapFileDetails] = useState(null)
    //hook used to display planning loader component
    const [planningLoader, setPlanningLoader] = useState(false)
    //Used to switch file list fetching on/off
    const [fetchList, setFetchList] = useState(true)

    useEffect(() => {
        let interval;
        //This hook manages the refresh of the files display every X seconds
        if(open) {
            history.push(`/Admin/Upload/`);
            dispatch(closeEditDrawer());
            dispatch(closeEditFeatureDrawer());
            dispatch(closeSystemConfigDrawer());
            dispatch(closeAdminPageDrawer());
            dispatch(closeDashboardDrawer());
            dispatch(closeAdminCategoryDrawer());
            dispatch(closeLanguageDrawer());

            dispatch(setTitle('Upload'));
            interval = setInterval(() => {
                setTime(Date.now())
            }, props.refreshInterval || defaultRefreshInterval);


        }


        //Register the initial ws queue for getting details of files, only fired once on render
        window.websocket.registerQueue("getFiles", function(json){
            let files = []
            for(let f in json.packet.files) {
                let file = json.packet.files[f]
                files.push({id: file.id, attributes : {...file,...file.attributes}, name : file.attributes.name, status : file.status})
            }
            setTableData(files)
        })

        return () => {
            clearInterval(interval);
        };

    }, [open]);

    const showFileDetails = (params) => {
        //Create the data structure to display a file's details
        fileDetailsData = params
        setOpenDetails(true)
    };

    const viewButton = (params) => {
        //The View file details button shown in the file listing
        return(

            <Button
                variant="contained"
                color={params.value.status === 'FARGATE_PROCESSED'? "primary" :
                        /ERROR/.test(params.value.status) ? "error" :
                           (   params.value.status === 'REGISTERED' ||
                               params.value.status === 'FARGATE_PROCESSING' ||
                               params.value.status === 'DOWNLOAD_REQUESTED'
                           ) ? 'secondary'
                               :"success"}
                size="small"
                onClick ={() => showFileDetails(params.value)}
            >
                {params.value.status === 'FARGATE_PROCESSED'? "IMPORT" : "DETAILS"}
            </Button>

        )
    }

    //The column layout for file listing
    const columns = [
        {field: 'id', headerName: 'ID', width: 50},
        {field : "attributes", headerName: 'Details',renderCell: viewButton, disableClickEventBubbling: true, width: 150},
        {field : "name", headerName  : "File Name", width: 300},
        {field : "status", headerName:   "Status", width : 200}

    ]

    //The column layout for file details listing
    const fileColumns = [
        {field: 'id', headerName: 'Message ID', width: 50},
        {field: 'timestamp', headerName:'Time Stamp', width: 200},
        {field: 'message', headerName:'Message', width: 600}
    ]

    useEffect( () => {
        //Fetch file details every 30 seconds based upon the time hook
        //Don't fetch if we are looking at a file's details
        if(open && !openDetails && mapFileDetails === null && fetchList) {
            window.websocket.send({
                "queue": 'getFiles',
                "api": "sapi",
                "data": {
                    "method": "get_files",
                    "id_token": cookies['id_token']
                }
            })
            setDataFetching(false)
        }
    },[time,mapFileDetails,openDetails])

    return(

        //TODO remove hardcoded style elements
        // TODO REWRITE!!!
        <Drawer
            anchor="right"
            open={open}
            variant="persistent"
            className={classes.adminDrawers}
            style={{color: '#000'}}
            sx={{
                '.MuiDrawer-paper': {
                    borderLeft: 'none',
                    zIndex: 2,
                },
            }}
        >

             { dataFetching &&
                 <Box
                    component="div"
                    sx={{
                         p:2,
                         mt:2,
                         borderRadius: '5px'
                    }}
                 >
                     <LinearProgress />
                 </Box>
             }

             {open === true && mapFileDetails === null && tableData.length > 0 && openDetails === false &&
                     <DataGrid style={{width: '100%'}}
                         rows={tableData}
                         columns={columns}
                         autoHeight
                         initialState={{
                           sorting: {
                               sortModel: [{ field: 'id', sort: 'desc' }],
                           },
                         }}
                     />
             }

             {open && mapFileDetails === null && tableData.length > 0 && openDetails &&
                     <AdminFileDetails
                         fileDetails = {fileDetailsData}
                         fileColumns = {fileColumns}
                         open = {setOpenDetails}
                         forceRefresh = {setTime}
                         setFileDetails = {setMapFileDetails}
                     />
             }

             <div style={{
                 display: 'flex',
                 flexDirection: 'row',
                 width: '100%',
             }}>
                 {open && mapFileDetails === null && !openDetails &&
                 <AdminDataDownload
                     setFetchList = {setFetchList}
                 /> }
                 {open && mapFileDetails === null && !openDetails &&
                     <AdminFileUploader
                         forceRefresh = {setTime}
                     />
                 }
             </div>

             {open && mapFileDetails !== null &&
                     <AdminDataMapper
                        fileDetails = {mapFileDetails}
                        open = {setMapFileDetails}
                     />

             }

             {open && mapFileDetails === null && !openDetails  &&
                     <AdminPlanningLoader
                         forceRefresh = {setTime}
                     />
             }

             {open && mapFileDetails === null && !openDetails  &&
                 <AdminFloodMonitoringLoader
                     forceRefresh = {setTime}
                 />
             }

             {open && mapFileDetails === null && !openDetails  &&
                 <AdminCrimeLoader
                     forceRefresh = {setTime}
                 />
             }

             {open && mapFileDetails === null && !openDetails  &&
                 <AdminBoundaryLoader
                     forceRefresh = {setTime}
                 />
             }
             {open && mapFileDetails === null && !openDetails  &&
                 <AdminEventsLoader
                     forceRefresh = {setTime}
                 />
             }
        </Drawer>

    )
}