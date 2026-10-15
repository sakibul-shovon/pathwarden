MATCH (a:Artifact)-[r:DERIVED_FROM|ORIGINATES_FROM]->(b)
WHERE a.created_at <= $t
RETURN a.id AS src, b.id AS dst, type(r) AS rel
