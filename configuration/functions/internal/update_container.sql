CREATE OR REPLACE FUNCTION locus_core.update_container(parameters JSONB) RETURNS JSONB AS
$$
DECLARE
    ret_var JSONB;
BEGIN

    SET SEARCH_PATH = 'locus_core', 'public';

    parameters = parameters -'method';
    parameters = parameters || jsonb_build_object('timestamp', to_char(current_timestamp, 'DD/MM/YYYY HH24:MI:SS'));

    UPDATE locus_core.containers
    SET attributes = attributes ||  jsonb_build_object('log_messages', attributes->'log_messages' || jsonb_build_array(parameters - 'status')),
        status = COALESCE(parameters->>'status',status),
        last_update = current_timestamp
    WHERE id = (parameters->>'id')::BIGINT
    RETURNING attributes || jsonb_build_object('id', id)
    INTO ret_var;

    RETURN ret_var;
END;
$$ LANGUAGE PLPGSQL;