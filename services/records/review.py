import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from app import site_key
from storage import catalog, database


def review(action, identifier):
    with database() as connection:
        row = connection.execute(
            "SELECT site, payload, status FROM applications WHERE id=?", (identifier,)
        ).fetchone()
        if row is None:
            raise SystemExit("没有找到这个申请编号。")
        data = json.loads(row["payload"])
        if action == "show":
            return {"id": identifier, "status": row["status"], "application": data}

        albums = catalog()
        existing = next((album for album in albums if site_key(album["url"]) == row["site"]), None)
        if action == "approve":
            if existing is None:
                raise SystemExit("请先发布友链页并同步目录，再登记通过。")
            connection.execute("UPDATE applications SET status='approved' WHERE id=?", (identifier,))
            return {"id": identifier, "catalogNo": existing["catalogNo"], "status": "approved"}

        if existing:
            return existing
        next_number = max((int(album["catalogNo"]) for album in albums), default=0) + 1
        entry = {"catalogNo": f"{next_number:03d}"}
        entry.update({field: data[field] for field in ("name", "url", "artist", "description", "icon", "rss")
                      if data.get(field)})
        if data.get("genres"):
            entry["genres"] = [tag.strip() for tag in data["genres"].replace("，", ",").split(",") if tag.strip()]
        entry["addedAt"] = datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
        return entry


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="查看友链申请、生成公开条目、登记上架结果")
    parser.add_argument("action", choices=("show", "entry", "approve"))
    parser.add_argument("identifier")
    args = parser.parse_args()
    print(json.dumps(review(args.action, args.identifier), ensure_ascii=False, indent=2))
