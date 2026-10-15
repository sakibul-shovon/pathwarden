UNWIND $artifact_ids AS aid
MATCH (x:Action)-[:PAYLOAD]->(:Artifact {id: aid})
RETURN DISTINCT x.id AS action_id, x.status AS status
