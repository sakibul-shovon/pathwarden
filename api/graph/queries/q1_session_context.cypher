MATCH (s:Session {id: $session_id})-[:LOADED|PRODUCED]->(c:Artifact)
RETURN DISTINCT c.id AS id
