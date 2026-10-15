MATCH (a:Artifact {store: $store})
WHERE a.key STARTS WITH $prefix AND NOT a.quarantined
RETURN a.id AS id, a.key AS key, a.created_at AS created_at
ORDER BY created_at ASC
