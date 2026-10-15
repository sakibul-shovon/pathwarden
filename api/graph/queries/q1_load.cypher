MATCH (s:Session {id: $session_id}), (a:Artifact {id: $artifact_id})
WHERE NOT a.quarantined
CREATE (s)-[:LOADED]->(a)
RETURN a.id AS id, a.content AS content
