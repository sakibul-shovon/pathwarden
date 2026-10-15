MATCH (n)
WHERE n.id STARTS WITH $prefix
RETURN n.id AS id
