MERGE (a:Agent {id: $id})
SET a.role = $role
RETURN a.id AS id
