UNWIND $rows AS r
CREATE (:Sink {id: r.id, kind: r.kind, external: r.external})
