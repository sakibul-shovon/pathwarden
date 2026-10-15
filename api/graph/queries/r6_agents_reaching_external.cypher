MATCH (x:CapNode {kind: 'agent'})-[:CAN_FLOW*1..12]->(:CapNode {kind: 'sink', external: true})
RETURN DISTINCT x.name AS agent
