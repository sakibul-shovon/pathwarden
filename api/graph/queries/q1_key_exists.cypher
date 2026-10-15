MATCH (a:Artifact {store: $store, key: $key})
RETURN count(a) AS n
