MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH mp = (p)-[:DERIVED_FROM*1..16]->(m:Artifact {kind: 'memory'})
MATCH up = (m)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(up) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
MATCH (s:Session)-[:PRODUCED]->(m)
RETURN DISTINCT m.id AS memory_id, m.key AS memory_key, s.id AS written_in_session,
       s.agent_id AS written_by, s.day_label AS written_on, u.id AS untrusted_source
