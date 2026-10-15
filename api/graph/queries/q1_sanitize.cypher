MATCH (s:Session {id: $session_id}), (inp:Artifact {id: $input_id})
CREATE (a:Artifact {id: $artifact_id, kind: 'sanitized', key: $key, store: 'team_memory',
                    content: $content, content_hash: $content_hash, session_id: $session_id,
                    agent_id: s.agent_id, created_at: $ts, sanitized: true, approved: false,
                    quarantined: false, task_ref: s.task_ref})
CREATE (a)-[:DERIVED_FROM]->(inp)
CREATE (s)-[:PRODUCED]->(a)
RETURN a.id AS id
