import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import BASE, app
from feeds import parse_tracks, sync
from jobs import backup, notify
from storage import database, init


class Checks(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.state = Path(temp.name)
        for module in ("storage", "jobs"):
            patcher = patch(f"{module}.STATE", self.state)
            patcher.start()
            self.addCleanup(patcher.stop)
        init()
        self.api = app.test_client()
        self.form = dict(name="检查", artist="QA", email="qa@example.org", description="测试",
                         icon="https://example.org/icon.png", url="https://example.org/blog", rules=True)

    def test_submission_retry_backup(self):
        path = BASE + "/applications"
        response = self.api.post(path, json=self.form)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.api.post(path, json={**self.form, "url": "http://EXAMPLE.org/blog/"}).status_code, 409)
        with patch.dict(os.environ, {"RECORDS_MAIL_RELAY": "https://mail.example.org", "NOTIFY_TOKEN": "test"}):
            with patch("jobs.urlopen", side_effect=OSError):
                notify()
        backup()
        restored = self.state / "restore-test.sqlite"
        shutil.copy(next((self.state / "backups").glob("*.sqlite")), restored)
        conn = sqlite3.connect(restored)
        try:
            row = conn.execute("SELECT id,status,mail,attempts,payload FROM applications").fetchone()
            self.assertEqual(row[:4], (response.json["id"], "pending", "pending", 1))
            self.assertTrue(all(json.loads(row[4])[key] == value for key, value in self.form.items()))
        finally:
            conn.close()

    def test_invalid_and_spam(self):
        for changes in ({"rules": False}, {"website": "spam"}, {"email": "x"}, {"url": "file:///etc"},
                        {"rss": "http://127.0.0.1/"}):
            self.assertEqual(self.api.post(BASE + "/applications", json={**self.form, **changes}).status_code, 422)
        for _ in range(8):
            limited = self.api.post(BASE + "/applications", json={})
        self.assertEqual(limited.status_code, 429)
        with database() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM applications").fetchone()[0], 0)

    def test_site_metadata(self):
        path = BASE + "/site-metadata"
        page = b"""<head><base href="../assets/"><title>Blog - Tagline</title>
        <meta property="og:site_name" content="Blog &amp; Notes">
        <meta name="description" content="Some notes">
        <link rel="apple-touch-icon" href="touch.png"><link rel="icon" href="icon.png">
        <link rel="alternate" type="application/atom+xml" href="/atom.xml"></head>"""
        with patch("metadata.fetch", return_value=("https://example.org/blog/", page)) as fetch:
            data = {"url": "https://example.org/"}
            result = self.api.post(path, json=data)
            self.assertEqual(result.json, {"name": "Blog & Notes", "description": "Some notes",
                                           "icon": "https://example.org/assets/icon.png",
                                           "rss": "https://example.org/atom.xml"})
            self.assertEqual(self.api.post(path, json={"url": "http://127.0.0.1/"}).status_code, 422)
            self.assertEqual(self.api.post(path, json=data, headers={"Origin": "https://other.org"}).status_code, 403)
            fetch.assert_called_once_with(data["url"], html_only=True)
            fetch.side_effect = ValueError()
            self.assertEqual(self.api.post(path, json=data).status_code, 422)
        with database() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM applications").fetchone()[0], 0)

    def test_feed_failure_and_manual(self):
        atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A</title><link href="/post"/><updated>2026-11-10T07:00:00Z</updated></entry></feed>'
        self.assertEqual(parse_tracks(atom, "https://example.org/feed")[0]["publishedAt"], "2026-11-10T07:00:00Z")
        items = "".join(f'<item><title>{num}</title><link>https://example.org/{num}</link><pubDate>2026-11-0{num}T05:00:00Z</pubDate></item>' for num in [1, 1, 2, 3, 4])
        body = f"<rss version='2.0'><channel>{items}</channel></rss>".encode()
        with patch("feeds.fetch", return_value=("https://example.org/feed", body)):
            sync()
        response = self.api.get(BASE + "/tracks").json
        self.assertEqual([track["title"] for track in response["albums"][0]["tracks"]], ["4", "3", "2"])
        with patch("feeds.fetch", side_effect=ValueError):
            sync()
        self.assertEqual(self.api.get(BASE + "/tracks").json, response)
        with database() as conn:
            conn.execute("DELETE FROM feeds")
        self.assertEqual(self.api.get(BASE + "/tracks").json["albums"][0]["source"], "manual")


if __name__ == "__main__":
    unittest.main()
