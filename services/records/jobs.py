import json
import os
import sqlite3
import sys
import time
from datetime import date
from urllib.request import Request, urlopen

from feeds import sync
from storage import STATE, database, init


def review_text(identifier, application):
    fields = (("站点名称", "name"), ("网站地址", "url"), ("博主昵称", "artist"),
              ("联系邮箱", "email"), ("网站简介", "description"), ("代表文章", "article"),
              ("RSS", "rss"), ("网站图标", "icon"), ("专辑封面", "cover"), ("类型标签", "genres"))
    lines = [f"友链申请 {identifier} · 待审核", ""]
    lines.extend(f"{label}：{application.get(key) or '未填写'}" for label, key in fields)
    lines.append("申请规则：" + ("已确认" if application.get("rules") is True else "未确认"))
    lines.extend(["", f"决定收录后，在 Codex 中发送「通过并上架 {identifier}」。"])
    return "\n".join(lines)


def notify():
    relay = os.getenv("RECORDS_MAIL_RELAY")
    if not relay and not all(os.getenv(name) for name in ("CF_ACCOUNT", "CF_EMAIL_TOKEN", "MAIL_FROM", "MAIL_TO")):
        return
    now = int(time.time())
    with database() as conn:
        rows = conn.execute("""SELECT id, attempts, payload FROM applications WHERE mail='pending'
                               AND retry<=? ORDER BY created LIMIT 20""", (now,)).fetchall()
    recipient = os.getenv("MAIL_TO")
    for row in rows:
        identifier = row["id"]
        status = "pending"
        try:
            text = review_text(identifier, json.loads(row["payload"]))
            if relay:
                message = json.dumps({"id": identifier, "text": text}, ensure_ascii=False).encode()
                req = Request(relay, data=message, headers={
                    "Authorization": "Bearer " + os.environ["NOTIFY_TOKEN"], "Content-Type": "application/json"})
            else:
                payload = {"from": os.environ["MAIL_FROM"], "to": recipient, "subject": "SlowMo Records 新友链申请",
                           "text": text}
                req = Request(f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CF_ACCOUNT']}/email/sending/send",
                              data=json.dumps(payload).encode(), headers={"Content-Type": "application/json",
                              "Authorization": "Bearer " + os.environ["CF_EMAIL_TOKEN"]})
            with urlopen(req, timeout=15) as response:
                data = json.load(response)
            result = data.get("result") or {}
            if relay and data.get("accepted") is True:
                status = "accepted"
            elif data.get("success"):
                for field in ("delivered", "queued", "permanent_bounces", "suppressed_recipients"):
                    if recipient in result.get(field, []):
                        status = field
                        break
        except Exception as error:
            print(identifier, type(error).__name__)
        with database() as conn:
            conn.execute("UPDATE applications SET mail=?, attempts=attempts+1,retry=? WHERE id=?",
                         (status, now + min(86400, 300 * 2 ** min(row["attempts"], 9)), identifier))


def backup():
    directory = STATE / "backups"
    directory.mkdir(mode=0o700, exist_ok=True)
    target = directory / f"{date.today()}.sqlite"
    temporary = target.with_suffix(".tmp")
    with database() as source:
        destination = sqlite3.connect(temporary)
        try:
            source.backup(destination)
            if destination.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("invalid backup")
        finally:
            destination.close()
    temporary.replace(target)
    for old in sorted(directory.glob("????-??-??.sqlite"))[:-14]:
        old.unlink()


if __name__ == "__main__":
    init()
    {"init": lambda: None, "sync": sync, "backup": backup, "notify": notify}[sys.argv[1]]()
