UNWIND $rows AS r
CREATE (:CapNode {name: r.name, kind: r.kind, trust: r.trust, external: r.external})
