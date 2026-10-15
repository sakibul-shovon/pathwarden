MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
OPTIONAL MATCH qp = (p)-[:DERIVED_FROM*1..16]->(q:Artifact)
WHERE coalesce(q.quarantined, false)
RETURN coalesce(p.quarantined, false) AS payload_quarantined,
       collect(DISTINCT q.id) AS quarantined_ancestors
