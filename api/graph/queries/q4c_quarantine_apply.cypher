CREATE (q:Quarantine {id: $qid, source_id: $source_id, ts: $ts, by: $by, artifact_count: size($artifact_ids)})
WITH q
UNWIND $artifact_ids AS aid
MATCH (x:Artifact {id: aid})
SET x.quarantined = true
CREATE (q)-[:COVERS]->(x)
RETURN count(x) AS quarantined_count
