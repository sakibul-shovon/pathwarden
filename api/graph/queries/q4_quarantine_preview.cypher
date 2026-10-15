MATCH (src:Source {id: $source_id})<-[:ORIGINATES_FROM]-(root:Artifact)
OPTIONAL MATCH dp = (d:Artifact)-[:DERIVED_FROM*1..20]->(root)
WHERE dp IS NULL OR none(n IN nodes(dp) WHERE coalesce(n.sanitized, false))
RETURN collect(DISTINCT root.id) AS roots, collect(DISTINCT d.id) AS descendants
