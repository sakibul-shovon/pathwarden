from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import create_app
from api.settings import Settings


def test_health_reports_ok_and_lists_a_graph_that_exists(settings, db, graph_name):
    db.select_graph(graph_name).query("CREATE (:T {id: 'x'})")

    response = TestClient(create_app(settings)).get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["falkordb"] == "ok"
    assert graph_name in body["graphs"]


def test_health_reports_unreachable_database_in_the_documented_error_shape():
    unreachable = Settings(falkordb_host="127.0.0.1", falkordb_port=1)

    response = TestClient(create_app(unreachable)).get("/api/health")

    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "falkordb_unavailable"
    assert "detail" in body
