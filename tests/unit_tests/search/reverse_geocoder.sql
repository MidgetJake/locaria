DO
$$
DECLARE
    ret_var JSONB;
    parameters JSONB DEFAULT jsonb_build_object('method', 'revgeocoder','lon', -3.57714, 'lat',50.8977);
BEGIN

    SET SEARCH_PATH = 'locaria_core', 'public';

    SELECT locaria_gateway(parameters) INTO ret_var;
    RAISE NOTICE '%', locaria_tests.test_result_processor('reg_geocoder TEST 1', ret_var#>'{features}'->0 , '{properties,postcode}', 'XX1 1XA');

    RAISE NOTICE '%',ret_var;

END;
$$