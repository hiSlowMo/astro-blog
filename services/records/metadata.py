import re
from html.parser import HTMLParser
from urllib.parse import urljoin

from feeds import fetch, public_url


class SiteHead(HTMLParser):
    def __init__(self):
        super().__init__()
        self.finished = False
        self.in_title = False
        self.title = []
        self.meta = {}
        self.base = ""
        self.links = []

    def handle_starttag(self, tag, attributes):
        if tag == "body":
            self.finished = True
        if self.finished:
            return
        attrs = {key: value.strip() for key, value in attributes if value}
        if tag == "title":
            self.in_title = True
        elif tag == "meta" and attrs.get("content"):
            key = attrs.get("property") or attrs.get("name", "")
            self.meta.setdefault(key.lower(), attrs["content"])
        elif tag == "base" and not self.base:
            self.base = attrs.get("href", "")
        elif tag == "link" and attrs.get("href"):
            rel = attrs.get("rel", "").lower().split()
            if "icon" in rel or "apple-touch-icon" in rel:
                self.links.append(("icon" if "icon" in rel else "touch", attrs["href"]))
            if "alternate" in rel and attrs.get("type", "").lower().split(";")[0].strip() in (
                    "application/rss+xml", "application/atom+xml"):
                self.links.append(("rss", attrs["href"]))

    def handle_endtag(self, tag):
        if tag == "head":
            self.finished = True
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title and not self.finished:
            self.title.append(data)


def site_metadata(url):
    final, body = fetch(url, html_only=True)
    charset = re.search(rb"""<meta\b[^>]*?\bcharset\s*=\s*["']?\s*([\w.-]+)""", body[:4096], re.I)
    encoding = charset[1].decode("ascii") if charset else "utf-8"
    parser = SiteHead()
    try:
        text = body.decode(encoding, "replace")
    except (ValueError, LookupError):
        text = body.decode("utf-8", "replace")
    end = re.search(r"</head\s*>", text, re.I)
    try:
        parser.feed(text[:end.end()] if end else text)
    except AssertionError as error:
        raise ValueError("invalid HTML declaration") from error
    name = parser.meta.get("og:site_name") or parser.meta.get("og:title") or "".join(parser.title)
    description = parser.meta.get("description") or parser.meta.get("og:description", "")
    fields = {"name": " ".join(name.split())[:40], "description": " ".join(description.split())[:60]}
    try:
        base = urljoin(final, parser.base)
    except ValueError:
        base = final
    for kind, href in parser.links:
        try:
            target = urljoin(base, href)
        except ValueError:
            continue
        if len(target) <= 2048 and public_url(target):
            fields.setdefault(kind, target)
    fields.setdefault("icon", fields.pop("touch", ""))
    return {key: value for key, value in fields.items() if value}
