UNWIND $cap_ids AS cid
MATCH (a:CapNode)-[r:CAN_FLOW {cap_id: cid}]->(b:CapNode)
CREATE (a)-[:REVOKED_FLOW {cap_id: r.cap_id, cost: r.cost, description: r.description}]->(b)
DELETE r
RETURN count(*) AS revoked
