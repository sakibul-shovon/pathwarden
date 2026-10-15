MATCH (q:Quarantine {id: $qid})-[:COVERS]->(x:Artifact)
SET x.quarantined = false
RETURN count(x) AS released_count
