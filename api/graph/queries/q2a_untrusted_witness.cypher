MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH tp = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(tp) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
RETURN [n IN nodes(tp) | n.id] AS witness, length(tp) AS hops
ORDER BY hops ASC
LIMIT 1
