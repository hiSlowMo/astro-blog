import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

STATE = Path(os.environ.get("RECORDS_STATE", "/var/lib/slowmo-records"))
CATALOG = Path(__file__).with_name("catalog.json")


@contextmanager
def database():
    connection = sqlite3.connect(STATE / "records.sqlite", timeout=8)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def init():
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with database() as conn:
        conn.executescript("""
          PRAGMA journal_mode=WAL;
          CREATE TABLE IF NOT EXISTS feeds (
            catalog TEXT PRIMARY KEY, url TEXT NOT NULL, tracks TEXT NOT NULL, updated INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY, site TEXT UNIQUE NOT NULL, payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL,
            mail TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
            retry INTEGER NOT NULL DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS limits (
            client TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL
          );
        """)


def catalog():
    return json.loads(CATALOG.read_text())
