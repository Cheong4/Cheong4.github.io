#!/usr/bin/env python3
"""posts/*.md, news/*.md 의 front matter 를 읽어 각 폴더에 index.json 을 만든다.
(GitHub Actions 에서 자동 실행됨. 로컬에서도 `python3 tools/build_index.py` 로 실행 가능)"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
FM = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.S)


def parse(text):
    text = text.replace("\r\n", "\n").lstrip("﻿")
    m = FM.match(text)
    meta, body = {}, text
    if m:
        for line in m.group(1).split("\n"):
            if ":" in line and not line.lstrip().startswith("#"):
                k, v = line.split(":", 1)
                meta[k.strip().lower()] = v.strip().strip("\"'")
        body = m.group(2)
    return meta, body.strip()


def split_tags(v):
    return [t.strip() for t in re.split(r"[,，]", v) if t.strip()] if v else []


def build(kind, include_body):
    d = ROOT / kind
    if not d.is_dir():
        return
    items = []
    for p in sorted(d.glob("*.md")):
        meta, body = parse(p.read_text(encoding="utf-8"))
        if meta.get("draft", "").lower() in ("true", "yes", "1"):
            continue
        item = {
            "slug": p.stem,
            "title": meta.get("title", p.stem),
            "date": meta.get("date", ""),
            "tags": split_tags(meta.get("tags", "")),
        }
        for k in ("author", "source", "url"):
            if meta.get(k):
                item[k] = meta[k]
        plain = re.sub(r"\s+", " ", re.sub(r"[#>*`\[\]!|]", "", body)).strip()
        item["summary"] = meta.get("summary") or plain[:140]
        if include_body:
            item["body"] = body
        items.append(item)
    items.sort(key=lambda x: (x["date"], x["slug"]), reverse=True)
    (d / "index.json").write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{kind}: {len(items)} item(s)")


build("posts", include_body=False)
build("news", include_body=True)
