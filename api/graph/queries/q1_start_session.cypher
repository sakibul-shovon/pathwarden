MATCH (ag:Agent {id: $agent_id})
CREATE (s:Session {id: $session_id, agent_id: $agent_id, day_label: $day_label,
                   task_ref: $task_ref, started_at: $ts})
CREATE (ag)-[:RAN]->(s)
RETURN s.id AS id
