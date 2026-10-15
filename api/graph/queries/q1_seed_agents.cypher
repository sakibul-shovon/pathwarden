UNWIND $rows AS r
CREATE (:Agent {id: r.id, role: r.role})
