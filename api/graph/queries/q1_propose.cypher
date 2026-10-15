MATCH (s:Session {id: $session_id}), (p:Artifact {id: $payload_id}), (k:Sink {id: $sink_id})
CREATE (x:Action {id: $action_id, tool: $tool, status: 'proposed', verdict_reason: '',
                  created_at: $ts, task_ref: s.task_ref})
CREATE (s)-[:PROPOSED]->(x)
CREATE (x)-[:PAYLOAD]->(p)
CREATE (x)-[:TARGETS]->(k)
RETURN x.id AS id
