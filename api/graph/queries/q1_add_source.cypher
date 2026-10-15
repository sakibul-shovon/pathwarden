MERGE (s:Source {id: $id})
SET s.kind = $kind, s.trust = $trust, s.label = $label
RETURN s.id AS id
