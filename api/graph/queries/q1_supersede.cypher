MATCH (prev:Action {id: $old_id}), (nxt:Action {id: $new_id})
SET prev.status = 'superseded'
CREATE (prev)-[:SUPERSEDED_BY]->(nxt)
RETURN prev.id AS id
