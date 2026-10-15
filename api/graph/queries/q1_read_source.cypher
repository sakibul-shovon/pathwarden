MATCH (s:Session {id: $session_id}), (src:Source {id: $source_id})
CREATE (a:Artifact {id: $artifact_id, kind: 'raw', key: '', store: '', content: $content,
                    content_hash: $content_hash, session_id: $session_id, agent_id: s.agent_id,
                    created_at: $ts, sanitized: false, approved: false, quarantined: false,
                    task_ref: s.task_ref})
CREATE (a)-[:ORIGINATES_FROM]->(src)
CREATE (s)-[:PRODUCED]->(a)
RETURN a.id AS id
