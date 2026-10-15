MATCH (a:Artifact {id: $artifact_id})
RETURN a.id AS id, a.kind AS kind, a.key AS key, a.store AS store, a.content AS content,
       a.agent_id AS agent_id, a.session_id AS session_id, a.created_at AS created_at,
       a.sanitized AS sanitized, a.approved AS approved, a.quarantined AS quarantined
