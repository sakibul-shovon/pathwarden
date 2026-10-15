MATCH (p:Artifact {id: $artifact_id})
CREATE (ap:Approval {id: $approval_id, by: $by, ts: $ts, scope: 'release'})
CREATE (ap)-[:APPROVES]->(p)
SET p.approved = true
RETURN p.id AS id
