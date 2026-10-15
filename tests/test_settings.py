from __future__ import annotations

from pathlib import Path

import pytest

from api.settings import Settings, load_dotenv


def test_defaults_when_environment_is_empty():
    s = Settings.from_env({})
    assert (s.falkordb_host, s.falkordb_port, s.falkordb_password, s.auth) == (
        "localhost",
        6379,
        None,
        "off",
    )


def test_values_are_read_and_empty_strings_count_as_unset():
    s = Settings.from_env(
        {
            "PW_FALKORDB_HOST": "db.internal",
            "PW_FALKORDB_PORT": "6380",
            "PW_FALKORDB_PASSWORD": "",
            "PW_AUTH": "on",
        }
    )
    assert s.falkordb_host == "db.internal"
    assert s.falkordb_port == 6380
    assert s.falkordb_password is None
    assert s.auth == "on"


def test_invalid_auth_value_is_rejected():
    with pytest.raises(ValueError):
        Settings.from_env({"PW_AUTH": "maybe"})


def test_load_dotenv_parses_comments_and_quotes_and_never_overrides(tmp_path: Path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment\n"
        "\n"
        "PW_TEST_PLAIN=abc   # trailing comment\n"
        'PW_TEST_QUOTED="has # hash"\n'
        "PW_TEST_EXISTING=from-file\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("PW_TEST_PLAIN", raising=False)
    monkeypatch.delenv("PW_TEST_QUOTED", raising=False)
    monkeypatch.setenv("PW_TEST_EXISTING", "from-process")

    load_dotenv(env_file)

    import os

    assert os.environ["PW_TEST_PLAIN"] == "abc"
    assert os.environ["PW_TEST_QUOTED"] == "has # hash"
    assert os.environ["PW_TEST_EXISTING"] == "from-process"
    for key in ("PW_TEST_PLAIN", "PW_TEST_QUOTED"):
        monkeypatch.delenv(key, raising=False)


def test_load_dotenv_ignores_a_missing_file(tmp_path: Path):
    load_dotenv(tmp_path / "does-not-exist.env")  # must not raise
