MATCH (s:Session {id: $session_id})
CREATE (a:Artifact {id: $artifact_id, kind: $kind, key: $key, store: $store, content: $content,
                    content_hash: $content_hash, session_id: $session_id, agent_id: s.agent_id,
                    created_at: $ts, sanitized: false, approved: false, quarantined: false,
                    task_ref: $task_ref})
CREATE (s)-[:PRODUCED]->(a)
WITH a
UNWIND $context_ids AS cid
MATCH (c:Artifact {id: cid})
CREATE (a)-[:DERIVED_FROM]->(c)
RETURN count(c) AS derived_edges
