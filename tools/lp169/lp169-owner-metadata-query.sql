WITH lp169_owner_metadata AS (
  SELECT jsonb_build_object(
    'schemas', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', schema_name) ORDER BY schema_name), '[]') FROM information_schema.schemata WHERE schema_name IN ('public','storage','history_capture')),
    'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', table_schema, 'name', table_name, 'type', table_type) ORDER BY table_schema,table_name), '[]') FROM information_schema.tables WHERE table_schema IN ('public','storage','history_capture')),
    'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name, 'name', column_name, 'dataType', data_type) ORDER BY table_schema,table_name,ordinal_position), '[]') FROM information_schema.columns WHERE table_schema IN ('public','storage','history_capture')),
    'routines', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', routine_schema, 'name', routine_name, 'type', routine_type) ORDER BY routine_schema,routine_name), '[]') FROM information_schema.routines WHERE routine_schema IN ('public','storage','history_capture')),
    'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', constraint_schema, 'table', table_name, 'name', constraint_name, 'type', constraint_type) ORDER BY constraint_schema,table_name,constraint_name), '[]') FROM information_schema.table_constraints WHERE constraint_schema IN ('public','storage','history_capture')),
    'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', indexname) ORDER BY schemaname,tablename,indexname), '[]') FROM pg_indexes WHERE schemaname IN ('public','storage','history_capture')),
    'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', trigger_schema, 'table', event_object_table, 'name', trigger_name, 'event', event_manipulation) ORDER BY trigger_schema,event_object_table,trigger_name,event_manipulation), '[]') FROM information_schema.triggers WHERE trigger_schema IN ('public','storage','history_capture')),
    'policies', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', policyname, 'command', cmd, 'roles', array_to_string(roles, ',')) ORDER BY schemaname,tablename,policyname), '[]') FROM pg_policies WHERE schemaname IN ('public','storage','history_capture')),
    'storageBuckets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'public', public) ORDER BY id), '[]') FROM storage.buckets),
    'storageCounts', (SELECT coalesce(jsonb_agg(jsonb_build_object('bucketId', bucket_id, 'objectCount', object_count) ORDER BY bucket_id), '[]') FROM (SELECT bucket_id, count(*)::integer AS object_count FROM storage.objects GROUP BY bucket_id) counts)
  ) AS value
)
SELECT value AS lp169_owner_metadata FROM lp169_owner_metadata;
