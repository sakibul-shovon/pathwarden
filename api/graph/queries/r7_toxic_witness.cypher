MATCH p1 = (u:CapNode {kind: 'source', trust: 'untrusted'})-[:CAN_FLOW*1..12]->(x:CapNode {name: $agent})
WITH x, p1 ORDER BY length(p1) LIMIT 1
MATCH p2 = (s:CapNode {kind: 'source', trust: 'secret'})-[:CAN_FLOW*1..12]->(x)
WITH x, p1, p2 ORDER BY length(p2) LIMIT 1
MATCH p3 = (x)-[:CAN_FLOW*1..12]->(k:CapNode {kind: 'sink', external: true})
WITH p1, p2, p3 ORDER BY length(p3) LIMIT 1
RETURN [n IN nodes(p1) | n.name] AS from_untrusted,
       [n IN nodes(p2) | n.name] AS from_secret,
       [n IN nodes(p3) | n.name] AS to_external
