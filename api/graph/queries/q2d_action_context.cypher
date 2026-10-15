MATCH (a:Action {id: $action_id})
OPTIONAL MATCH (a)-[:PAYLOAD]->(p:Artifact)
OPTIONAL MATCH (a)-[:TARGETS]->(k:Sink)
RETURN a.id AS action_id, p.id AS payload_id, k.id AS sink_id, k.external AS external
