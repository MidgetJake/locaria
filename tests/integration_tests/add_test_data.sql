DO
$$
    DECLARE
        category_id INTEGER;
        category_mod_id INTEGER;
        ret_var JSONB;
    BEGIN

        RAISE NOTICE 'INSERTING TEST DATA INTO LOCARIA';

        SET SEARCH_PATH = 'locaria_core', 'public';
        DELETE FROM categories WHERE category IN ('LOCARIA_TEST', 'LOCARIA_TEST_MOD', 'LOCARIA_TEST_NO_DATA');

        --Create 2 test categories one that allows moderated updates and one that does not
        INSERT INTO categories(category,attributes)
        SELECT 'LOCARIA_TEST', jsonb_build_object()
        RETURNING id INTO category_id;

        INSERT INTO categories(category,attributes)
        SELECT 'LOCARIA_TEST_MOD', jsonb_build_object('moderated_update', true)
        RETURNING id INTO category_mod_id;

        --Create a final one without any data
        INSERT INTO categories(category) SELECT 'LOCARIA_TEST_NO_DATA';

        --Add some data to the base table and an associated view
        DROP TABLE IF EXISTS locaria_data.locaria_test_data CASCADE;

        CREATE TABLE locaria_data.locaria_test_data() INHERITS (locaria_data.base_table);

        INSERT INTO locaria_data.locaria_test_data(category_id, wkb_geometry, attributes)
        VALUES (category_id,
                ST_GEOMFROMEWKT('SRID=4326;Point (-3.51714069502677917 50.3977689822299908)'),
                jsonb_build_object('data', jsonb_build_object('_identifier', 'foo1', '_order', 3), 'description', jsonb_build_object('title', 'find me one', 'type','test', 'text','general description 1', 'mod', 'no', 'order', 'fudge', 'text', 'aaaa'))),
               (category_id,
                ST_GEOMFROMEWKT('SRID=4326;Point (-3.51714069502677917 50.3977689822299908)'),
                jsonb_build_object('data', jsonb_build_object('_identifier', 'foo1',  '_order', 1), 'description', jsonb_build_object('title', 'find me order', 'type','test', 'text','general description 1', 'mod', 'no', 'order', 'aaaaa'))),
               (category_mod_id,
                ST_GEOMFROMEWKT('SRID=4326;Point (-3.51714069502677917 50.3977689822299908)'),
                jsonb_build_object('description', jsonb_build_object('title', 'find me two', 'type','test', 'text','general description 2', 'mod', 'yes', 'order', 'bbbbb')));

        DROP VIEW IF EXISTS locaria_data.locaria_test_view CASCADE;
        CREATE  VIEW locaria_data.locaria_test_view AS
            SELECT id,
                   wkb_geometry::GEOMETRY AS wkb_geometry,
                   attributes || jsonb_build_object('table', 'locaria_data.locaria_test_data') AS attributes,
                   now() AS search_date,
                   category_id
            FROM locaria_data.locaria_test_data;

        --Refresh the views and ensure our data is within

        SELECT locaria_core.create_materialised_view() INTO ret_var;

        --Add data to address search view
        RAISE NOTICE '**** WARNING LOCATION SEARCH VIEW HAS BEEN REBUILT TO TEST DATA';

        DROP MATERIALIZED VIEW IF EXISTS locaria_data.location_search_view CASCADE;
        CREATE MATERIALIZED VIEW locaria_data.location_search_view AS
            SELECT 1 AS id,
                   jsonb_build_object('postcode', 'XX1 1XA', 'address', '1X The road, Town, County, XX1 1XA') AS attributes,
                   ST_GEOMFROMEWKT('SRID=4326;Point (-3.57714069502677917 50.8977689822299908)') AS wkb_geometry;

        IF ret_var->>'logid' IS NOT NULL THEN
           RAISE EXCEPTION '[add_test_date] %', (SELECT log_message FROM logs WHERE id=(ret_var->>'logid')::BIGINT);
        END IF;

        --Add some upload data

        DROP TABLE IF EXISTS locaria_uploads.test_upload;
        CREATE TABLE locaria_uploads.test_upload(
            ogc_fid SERIAL,
            wkb_geometry GEOMETRY,
            title TEXT,
            text TEXT,
            tags TEXT [],
            url TEXT,
            lon FLOAT,
            lat FLOAT
        );

        INSERT INTO locaria_uploads.test_upload(wkb_geometry, title,text,tags,url,lon,lat)
        VALUES(
               ST_GEOMFROMEWKT('SRID=4326;POINT(-1.2 54.2)'),
               'TEST TITLE 1',
               'TEST TEXT 1',
               ARRAY['foo', 'baa'],
               'https://foo.com/baaa',
               -1.4,
               53.2
              ),
            (
            NULL,
            'TEST TITLE 2',
            'TEST TEXT 2',
            ARRAY['foo2', 'baa2'],
            'https://foo2.com/baaa2',
            -1.4,
            53.2
        );

        DELETE FROM locaria_core.files;
        INSERT INTO locaria_core.files(id,attributes)
        SELECT 1, jsonb_build_object();

        RAISE NOTICE 'TEST DATA LOADED AND VIEW REFRESHED %', ret_var;

        END;
$$ LANGUAGE PLPGSQL;
