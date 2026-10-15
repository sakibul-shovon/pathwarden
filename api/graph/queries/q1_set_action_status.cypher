MATCH (x:Action {id: $action_id})
SET x.status = $status, x.verdict_reason = $reason
RETURN x.id AS id
