MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH sp = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(s:Source {trust: 'secret'})
WHERE none(n IN nodes(sp) WHERE coalesce(n.approved, false))
RETURN [n IN nodes(sp) | n.id] AS witness, length(sp) AS hops
ORDER BY hops ASC
LIMIT 1
