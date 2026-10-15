MATCH (a:Artifact {store: $store, key: $key})
WHERE NOT a.quarantined
RETURN a.id AS id, a.created_at AS created_at
ORDER BY created_at DESC
LIMIT 1
