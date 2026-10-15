UNWIND $rows AS r
CREATE (:Source {id: r.id, kind: r.kind, trust: r.trust, label: r.label})
