import calendar
import ipaddress
import json
import re
import socket
import subprocess
import tempfile
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlsplit

import feedparser

from storage import catalog, database


class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.feeds = []

    def handle_data(self, data):
        self.text.append(data)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "link" and "alternate" in (attrs.get("rel") or "").lower().split():
            if (attrs.get("type") or "").lower() in ("application/atom+xml", "application/rss+xml"):
                if attrs.get("href"):
                    self.feeds.append(attrs["href"])


def plain(markup, limit):
    parser = Markup()
    parser.feed(markup or "")
    return " ".join(" ".join(parser.text).split())[:limit]


def public_url(value):
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        if (url.scheme not in ("https", "http") or url.username is not None
                or url.password is not None or url.port not in (None, 80, 443)
                or "." not in host or "\\" in value or any(ord(char) < 33 for char in value)):
            return False
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            labels = host.rstrip(".").encode("idna").decode().split(".")
            return (not host.endswith((".localhost", ".local", ".internal"))
                    and all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label, re.I) for label in labels))
    except (ValueError, UnicodeError):
        return False


def fetch(url, *, html_only=False):
    deadline = time.monotonic() + 10 if html_only else None
    for _ in range(5):
        if not public_url(url):
            raise ValueError("invalid URL")
        parts = urlsplit(url)
        port = parts.port or (443 if parts.scheme == "https" else 80)
        host = parts.hostname.encode("idna").decode()
        addresses = [item[4][0] for item in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)]
        resolved = [ipaddress.ip_address(addr) for addr in addresses]
        if not resolved or not all(ip.is_global and not ip.is_multicast for ip in resolved):
            raise ValueError("non-public address")
        address = next((addr for addr in addresses if ":" not in addr), f"[{addresses[0]}]")
        timeout = min(12, deadline - time.monotonic()) if deadline else 12
        if timeout <= 0:
            raise ValueError("fetch timeout")
        target = parts._replace(netloc=f"{host}:{port}", fragment="").geturl()
        with tempfile.TemporaryDirectory() as directory:
            body = Path(directory) / "body"
            result = subprocess.run([
                "curl", "-q", "-sS", "--globoff", "--noproxy", "*", "--proto", "=http,https",
                "--max-time", str(timeout), "--max-filesize", "1048576" if html_only else "4194304",
                "--user-agent", "SlowMoRecords/1.0",
                "--resolve", f"{host}:{port}:{address}", "--output", str(body),
                "--write-out", "%{http_code}\n%{redirect_url}\n%{content_type}", "--", target,
            ], capture_output=True, check=True, timeout=timeout + 1)
            code, redirect, content_type = result.stdout.decode().split("\n", 2)
            if code == "200":
                if html_only and content_type.split(";")[0].strip().lower() not in ("text/html", "application/xhtml+xml"):
                    raise ValueError("expected HTML")
                return url, body.read_bytes()
            if code in ("301", "302", "303", "307", "308") and redirect:
                url = redirect
                continue
            raise ValueError(f"HTTP {code}")
    raise ValueError("too many redirects")


def parse_tracks(body, base):
    result = feedparser.parse(body, response_headers={"content-location": base})
    if result.bozo and not result.entries:
        raise ValueError("invalid feed")
    candidates = []
    for entry in result.entries:
        url = urldefrag(urljoin(base, entry.link)).url if entry.get("link") else ""
        title = plain(entry.get("title"), 260)
        if not title or not public_url(url):
            continue
        parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        stamp = calendar.timegm(parsed) if parsed else 0
        track = {"url": url, "title": title, "excerpt": plain(entry.get("summary"), 300)}
        if parsed:
            track.update(date=time.strftime("%Y-%m-%d", parsed), publishedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", parsed))
        candidates.append((stamp, track))
    unique = {}
    for _, track in sorted(candidates, key=lambda pair: pair[0], reverse=True):
        unique.setdefault(track["url"], track)
    if not unique:
        raise ValueError("no valid entries")
    return list(unique.values())[:3]


def sync():
    for album in catalog():
        try:
            if album.get("rss"):
                candidates = [album["rss"]]
            else:
                base, page = fetch(album["url"])
                links = Markup()
                links.feed(page.decode("utf-8", "replace"))
                candidates = [urljoin(base, link) for link in links.feeds[:3]]
            for candidate in candidates:
                try:
                    final, body = fetch(candidate)
                    tracks = parse_tracks(body, final)
                    with database() as conn:
                        conn.execute("INSERT OR REPLACE INTO feeds VALUES(?,?,?,?)",
                                     (album["catalogNo"], album["url"], json.dumps(tracks), int(time.time())))
                    print(album["catalogNo"], len(tracks), "tracks")
                    break
                except (ValueError, OSError, subprocess.SubprocessError) as error:
                    print(album["catalogNo"], type(error).__name__)
        except Exception as error:
            print(album["catalogNo"], type(error).__name__, "keeping snapshot")
