MATCH (s:CapNode) WHERE s.name IN $source_names
WITH collect(s) AS srcs
MATCH (t:CapNode) WHERE t.name IN $target_names
WITH srcs, collect(t) AS tgts
CALL algo.maxFlow({
  sourceNodes: srcs,
  targetNodes: tgts,
  relationshipTypes: ['CAN_FLOW'],
  capacityProperty: 'cost',
  nodeLabels: ['CapNode']
})
YIELD edges, edgeFlows, maxFlow
RETURN maxFlow,
       [i IN range(0, size(edges) - 1) | edges[i].cap_id] AS flow_cap_ids,
       edgeFlows AS flows
