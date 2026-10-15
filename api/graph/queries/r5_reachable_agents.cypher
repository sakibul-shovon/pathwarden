MATCH (s:CapNode) WHERE s.name IN $source_names
MATCH (s)-[:CAN_FLOW*1..12]->(x:CapNode {kind: 'agent'})
RETURN DISTINCT x.name AS agent
