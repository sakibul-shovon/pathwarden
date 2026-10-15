MATCH (x:Action)-[:PAYLOAD]->(p:Artifact)
WHERE x.created_at <= $t
RETURN x.id AS action_id, x.status AS status, p.id AS payload_id
