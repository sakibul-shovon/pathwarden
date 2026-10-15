MATCH (n)
RETURN max(coalesce(n.created_at, n.started_at, n.ts)) AS max_ts
