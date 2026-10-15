MATCH (a:CapNode)-[r:CAN_FLOW]->(b:CapNode)
RETURN a.name AS src, b.name AS dst, r.cap_id AS cap_id, r.cost AS cost
