MATCH (s:Session {id: $session_id})
OPTIONAL MATCH (s)-[:PRODUCED|LOADED]->(:Artifact {kind: 'raw'})-[:ORIGINATES_FROM]->(src:Source)
WITH s, collect(DISTINCT src.trust) AS trusts
OPTIONAL MATCH (s)-[:PROPOSED]->(:Action)-[:TARGETS]->(k:Sink)
WITH s, trusts, collect(DISTINCT k.external) AS sink_external
OPTIONAL MATCH (s)-[:PRODUCED]->(w:Artifact)
WHERE w.kind IN ['memory', 'draft', 'patch']
RETURN trusts, sink_external, count(w) AS state_writes
