MATCH (s:Session)-[:PRODUCED]->(m:Artifact)
WHERE m.store = 'team_memory'
OPTIONAL MATCH up = (m)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(up) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
RETURN m.id AS memory_id, m.key AS key, m.kind AS kind, s.agent_id AS written_by,
       s.day_label AS written_on, coalesce(m.quarantined, false) AS quarantined,
       collect(DISTINCT u.id) AS untrusted_origins
