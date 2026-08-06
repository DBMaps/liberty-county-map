-- Read-only LP169.4 Storage metadata. Object bodies and credentials are excluded.
SELECT jsonb_build_object(
  'bucketId', 'certified-addresses',
  'objects', coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'length', nullif(metadata->>'size','')::bigint,
    'contentType', metadata->>'mimetype',
    'etag', metadata->>'eTag'
  ) ORDER BY name), '[]'::jsonb)
) AS lp169_storage_object_inventory
FROM storage.objects
WHERE bucket_id = 'certified-addresses';
