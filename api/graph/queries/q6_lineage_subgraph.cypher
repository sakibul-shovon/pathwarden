MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH path = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(x)
UNWIND relationships(path) AS r
WITH DISTINCT r
RETURN startNode(r).id AS src, endNode(r).id AS dst, type(r) AS rel
