MATCH (x:CapNode {kind: 'agent'})
MATCH (:CapNode {kind: 'source', trust: 'untrusted'})-[:CAN_FLOW*1..12]->(x)
WITH DISTINCT x
MATCH (:CapNode {kind: 'source', trust: 'secret'})-[:CAN_FLOW*1..12]->(x)
WITH DISTINCT x
MATCH (x)-[:CAN_FLOW*1..12]->(:CapNode {kind: 'sink', external: true})
RETURN DISTINCT x.name AS toxic_agent
