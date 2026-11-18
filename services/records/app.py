import hashlib
import json
import re
import time
import uuid
from urllib.parse import urlsplit

from flask import Flask, abort, jsonify, request
from werkzeug.exceptions import HTTPException

from feeds import public_url
from storage import catalog, database

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16384
BASE = "/records/v1"
ORIGINS = {"https://www.theslowmo.com", "https://theslowmo.com"}
FIELDS = {"name": 40, "url": 2048, "artist": 40, "email": 254, "description": 60,
          "icon": 2048, "cover": 2048, "rss": 2048, "article": 2048, "genres": 60}
REQUIRED = {"name", "url", "artist", "email", "description", "icon"}


@app.errorhandler(HTTPException)
def error_response(error):
    return jsonify(error=error.description), error.code


@app.after_request
def cors(response):
    origin = request.headers.get("Origin")
    if origin in ORIGINS:
        response.headers.update({"Access-Control-Allow-Origin": origin,
                                 "Access-Control-Allow-Headers": "Content-Type",
                                 "Access-Control-Allow-Methods": "GET, POST, OPTIONS"})
    response.vary.add("Origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get(BASE + "/health")
def health():
    with database() as conn:
        conn.execute("SELECT id FROM applications LIMIT 1").fetchone()
    return jsonify(status="ok")


@app.get(BASE + "/tracks")
def tracks():
    with database() as conn:
        snapshots = {row["catalog"]: row for row in conn.execute("SELECT * FROM feeds")}
    albums = []
    for album in catalog():
        row = snapshots.get(album["catalogNo"])
        live = row and row["url"] == album["url"]
        albums.append({"catalogNo": album["catalogNo"], "source": "feed" if live else "manual",
                       "updatedAt": row["updated"] if live else None,
                       "tracks": json.loads(row["tracks"]) if live else album.get("tracks", [])[:3]})
    response = jsonify(albums=albums)
    response.headers["Cache-Control"] = "public, max-age=60, stale-if-error=86400"
    return response


def site_key(url):
    parts = urlsplit(url)
    return parts.hostname.rstrip(".").lower() + parts.path.rstrip("/")


def validate(data):
    if not isinstance(data, dict) or data.get("website") or data.get("rules") is not True:
        abort(422, "请确认申请规则并检查表单。")
    clean = {"rules": True}
    for field, limit in FIELDS.items():
        value = data.get(field, "")
        if not isinstance(value, str):
            abort(422, "字段格式有误。")
        value = value.strip()
        if len(value) > limit or (not value and field in REQUIRED) or any(ord(char) < 32 for char in value):
            abort(422, f"请检查字段 {field}。")
        if value and field in {"url", "icon", "rss", "cover", "article"} and not public_url(value):
            abort(422, f"请检查网址 {field}。")
        clean[field] = value
    if not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", clean["email"]):
        abort(422, "邮箱格式有误。")
    return clean


@app.post(BASE + "/applications")
def apply():
    if request.headers.get("Origin") not in ORIGINS | {None}:
        abort(403, "申请来源无效。")
    now = int(time.time())
    peer = request.headers.get("X-Records-Client", request.remote_addr)
    client = hashlib.sha256(f"{now // 3600}:{peer}".encode()).hexdigest()
    with database() as conn:
        conn.execute("DELETE FROM limits WHERE expires <= ?", (now,))
        conn.execute("""INSERT INTO limits VALUES (?,1,?) ON CONFLICT(client)
                        DO UPDATE SET count=count+1""", (client, now + 3600))
        limited = conn.execute("SELECT count FROM limits WHERE client=?", (client,)).fetchone()[0] > 12
    if limited:
        abort(429, "提交次数过多，请稍后再试。")
    clean = validate(request.get_json())
    site = site_key(clean["url"])
    identifier = "SR-" + uuid.uuid4().hex
    with database() as conn:
        if any(site_key(album["url"]) == site for album in catalog()):
            abort(409, "该站点已收录。")
        inserted = conn.execute("""INSERT INTO applications(id,site,payload,created)
                       VALUES(?,?,?,?) ON CONFLICT(site) DO NOTHING""",
                                (identifier, site, json.dumps(clean, ensure_ascii=False), now))
        if not inserted.rowcount:
            abort(409, "该站点已有申请。")
    return jsonify(id=identifier, status="pending"), 201
