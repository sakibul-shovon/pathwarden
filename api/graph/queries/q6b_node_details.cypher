UNWIND $ids AS nid
MATCH (n {id: nid})
RETURN n.id AS id, labels(n)[0] AS label, n.kind AS kind, n.trust AS trust,
       n.sanitized AS sanitized, n.approved AS approved, n.quarantined AS quarantined,
       n.agent_id AS agent_id, n.session_id AS session_id, n.key AS key, n.created_at AS created_at
