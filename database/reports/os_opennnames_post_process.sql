DELETE FROM locaria_core.reports WHERE report_name ='opennames_post_process';

INSERT INTO locaria_core.reports(report_name, report_parameters, admin_privilege)
SELECT 'opennames_post_process',
       jsonb_build_object('sql',

$SQL$

        CREATE MATERIALIZED VIEW IF NOT EXISTS locaria_data.location_search_view
        AS
        SELECT
            fid AS id,
            row_to_json(N.*)::JSONB || jsonb_build_object('address', name1) -'wkb_geometry' AS attributes,
            wkb_geometry
        FROM locaria_uploads.opennames N
        WHERE  local_type IN ('City','Town','Other Settlement','Village','Hamlet','Suburban Area','Named Road','Postcode');

        CREATE UNIQUE INDEX IF NOT EXISTS opennames_id
            ON locaria_data.location_search_view
                USING BTREE(id);

        CREATE INDEX IF NOT EXISTS opennames_search_view_jsonb_ts_vector
            ON locaria_data.location_search_view
                USING GIN (jsonb_to_tsvector('Simple'::regconfig, attributes, '["string", "numeric"]'::jsonb));

        CREATE INDEX IF NOT EXISTS opennames_search_view_geometry_gist
            ON locaria_data.location_search_view
                USING GIST(wkb_geometry);

        CREATE INDEX IF NOT EXISTS opennames_search_view_jsonb_ops
            ON locaria_data.location_search_view
                USING gin(attributes jsonb_path_ops);

        REFRESH MATERIALIZED VIEW CONCURRENTLY locaria_data.location_search_view;

        SELECT jsonb_build_object('opennames_post_process', 'success');

        UPDATE parameters
        SET parameter = parameter || jsonb_build_object('opennames_version', ($1::JSONB)->>'version')
        WHERE parameter_name ='opennames_loader';

$SQL$),
TRUE;
