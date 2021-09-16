--The main search query engine

CREATE OR REPLACE FUNCTION locus_core.search_get_records(search_parameters JSONB, default_limit INTEGER DEFAULT 1000) RETURNS TABLE (
    _fid BIGINT,
    _search_rank DOUBLE PRECISION,
    _wkb_geometry GEOMETRY,
    _attributes JSONB

) AS $$
DECLARE
    default_offset INTEGER DEFAULT 0;
	json_filter JSONB DEFAULT json_build_object();
	filter_var BOOLEAN DEFAULT FALSE;
    results_var JSONB;
    search_ts_query tsquery;
    bbox_var GEOMETRY DEFAULT NULL;
    location_geometry GEOMETRY DEFAULT NULL;
    location_distance NUMERIC DEFAULT 1000;
    start_date_var DATE DEFAULT NULL;
    end_date_var DATE DEFAULT  NULL;
BEGIN

    SET SEARCH_PATH = 'locus_core', 'public';

    IF NULLIF(search_parameters->>'search_text', '*') IS NULL THEN
        search_parameters = (search_parameters::JSONB || jsonb_build_object('search_text', ''))::JSON;
    END IF;

    IF COALESCE(search_parameters->>'limit','') ~ '^[0-9]+$' THEN
        default_limit = LEAST(default_limit, (search_parameters->>'limit')::INTEGER);
    END IF;

    IF COALESCE(search_parameters->>'offset','') ~ '^[0-9]+$' THEN
        default_offset =  (search_parameters->>'offset')::INTEGER;
    END IF;

    IF COALESCE(search_parameters->>'location','') ~ '^SRID=[0-9]+;POINT\([0-9\- .]+\)' THEN
       location_geometry = ST_TRANSFORM(ST_GEOMFROMEWKT(search_parameters->>'location'),4326);
       IF search_parameters->>'location_distance' = 'CONTAINS' THEN
       	location_distance = -1;
       ELSE
       	location_distance = COALESCE((search_parameters->>'location_distance')::NUMERIC, location_distance);
       END IF;
    END IF;

    IF COALESCE(NULLIF(search_parameters->>'category', ''), '*') != '*' THEN
        json_filter = jsonb_build_object('category', search_parameters->>'category');
        filter_var = TRUE;
    END IF;

    IF COALESCE(search_parameters->>'reference', '') != '' THEN
        json_filter = json_filter || jsonb_build_object('ref', search_parameters->>'reference');
        filter_var = TRUE;
    END IF;

	IF COALESCE(search_parameters->>'filter', '') != '' THEN
		json_filter = json_filter || (search_parameters->'filter');
		filter_var = TRUE;
	END IF;


    --Requires BBOX as 'xmax ymax, xmin ymin'
    IF COALESCE(search_parameters->>'bbox','') ~ '^[0-9 ,\-.%C]+$' THEN
        bbox_var := ST_SETSRID(('BOX('|| REPLACE(search_parameters->>'bbox', '%2C', ',') ||')')::BOX2D,4326);
    END IF;

    --We only need one date to do a search if only one present use both for range
    IF COALESCE(search_parameters->>'start_date',search_parameters->>'end_date', '') ~ '^[0-9/-]+$' THEN
        start_date_var = COALESCE(search_parameters->>'start_date',search_parameters->>'end_date')::DATE;
        end_date_var   = COALESCE(search_parameters->>'end_date',search_parameters->>'start_date')::DATE;
    END IF;

    --Build our search ts_vector

    IF REPLACE(search_parameters->>'search_text', ' ', '') = '' THEN
        search_ts_query = '_IGNORE';

    ELSE
		search_ts_query = plainto_tsquery('English', search_parameters->>'search_text');
    END IF;

    --This is the core search query

    RETURN QUERY


            SELECT fid,
                   search_rank::DOUBLE PRECISION,
                   wkb_geometry,
                   attributes || CASE WHEN distance >= 0 THEN jsonb_build_object('distance', distance) ELSE jsonb_build_object() END as attributes
            FROM (
                SELECT  distinct ON(fid) fid,
			            CASE WHEN search_ts_query = '_IGNORE' tHEN 1 ELSE ts_rank(jsonb_to_tsvector('English'::regconfig, attributes, '["string", "numeric"]'::jsonb),search_ts_query) END  as search_rank,
			            wkb_geometry,
			            (attributes::JSONB - 'table') || jsonb_build_object('fid', fid) as attributes,
			            COALESCE(ROUND(ST_DISTANCE(location_geometry::GEOGRAPHY, wkb_geometry::GEOGRAPHY)::NUMERIC,1), -1) AS distance

                FROM global_search_view
                WHERE wkb_geometry IS NOT NULL

                AND (NOT filter_var OR attributes @> json_filter)
                --Category Search
                --AND (COALESCE(NULLIF(search_parameters->>'category',''), '*') = '*' OR  attributes @> jsonb_build_object('category', search_parameters->>'category'))
                --Free text on JSONB attributes search
                AND (search_ts_query = '_IGNORE' OR jsonb_to_tsvector('English'::regconfig, attributes->'description', '["string", "numeric"]'::jsonb) @@ search_ts_query)
                --Bounding box search
                AND (bbox_var IS NULL OR wkb_geometry && bbox_var)
                --distance search
                AND (location_distance = -1 OR location_geometry IS NULL OR ST_DWithin(wkb_geometry::GEOGRAPHY, location_geometry::GEOGRAPHY, location_distance, FALSE))
                --contains search
                AND (location_geometry IS NULL OR location_distance != -1 OR  (location_distance = -1  AND ST_Contains(wkb_geometry, location_geometry)))
                --date search
                --TODO date search
                --AND (start_date_var IS NULL OR search_date::DATE BETWEEN start_date_var AND end_date_var)
                --for tags
                AND ( (search_parameters->'tags') IS NULL OR attributes->'tags' ?| json2text(search_parameters->'tags') )

                OFFSET default_offset
            ) INNER_SUB
            ORDER by distance ASC, search_rank DESC
            LIMIT default_limit;


END;
$$
LANGUAGE PLPGSQL;