UNWIND $rows AS r
MATCH (a:CapNode {name: r.src}), (b:CapNode {name: r.dst})
CREATE (a)-[:CAN_FLOW {cap_id: r.cap_id, cost: r.cost, description: r.description}]->(b)
