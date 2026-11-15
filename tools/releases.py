#!/usr/bin/env python3
"""Fill in release info from GitHub when the site is built.

Usage: python3 tools/releases.py <site folder>

Any element written like
  <span class="release" data-repo="OWNER/REPO" data-view="tag">fallback</span><!--/release-->
gets the latest release of OWNER/REPO. Views:
  tag    "v1.2.3, 2026-01-31"
  notes  version, date, what's new and a link to the release
What's new is the release notes' "What's new" (or "Changes"/"Changelog")
section when there is one, otherwise the commit titles since the release
before it. If GitHub can't be reached, the fallback text stays.
"""
import html
import json
import os
import re
import sys
import urllib.request

API = "https://api.github.com/repos/"
MARK = re.compile(r'(<(?:span|div) class="release" data-repo="([\w.-]+/[\w.-]+)" data-view="(\w+)">)(.*?)(</(?:span|div)><!--/release-->)', re.S)


def get(path):
    req = urllib.request.Request(API + path, headers={"Accept": "application/vnd.github+json", "User-Agent": "site-build"})
    token = os.environ.get("GH_TOKEN")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def inline(text):
    out = html.escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\[([^\]]+)\]\((https://[^)\s]+)\)", lambda m: f'<a href="{html.escape(m[2])}">{m[1]}</a>', out)
    return out


def section(body):
    """The What's new part of the release notes, or None."""
    lines = body.replace("\r", "").split("\n")
    for i, line in enumerate(lines):
        if re.match(r"#+\s*(what'?s new|changes|changelog)\b", line.strip(), re.I):
            rest = []
            for more in lines[i + 1:]:
                if more.startswith("#"):
                    break
                rest.append(more)
            return "\n".join(rest).strip() or None
    return None


def bullets(text):
    items = [re.sub(r"^[-*]\s+", "", l.strip()) for l in text.split("\n") if l.strip()]
    return "<ul class=\"list\">" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>"


def whats_new(repo, rel, releases):
    found = section(rel.get("body") or "")
    if found:
        return bullets(found)
    older = [r for r in releases if not r["draft"] and r["tag_name"] != rel["tag_name"]]
    if not older:
        return ""
    cmp = get(f"{repo}/compare/{older[0]['tag_name']}...{rel['tag_name']}")
    titles = [c["commit"]["message"].split("\n")[0] for c in cmp.get("commits", [])]
    titles = [t for t in titles if not re.match(r"(merge|version|bump|release|readme|docs?|tests?|ci)\b", t, re.I)][-8:]
    return bullets("\n".join(reversed(titles))) if titles else ""


def render(repo, view, cache):
    if repo not in cache:
        releases = [r for r in get(f"{repo}/releases?per_page=10") if not r["draft"] and not r["prerelease"]]
        cache[repo] = (releases[0], releases) if releases else None
    if not cache[repo]:
        return None
    rel, releases = cache[repo]
    tag, date = html.escape(rel["tag_name"]), rel["published_at"][:10]
    if view == "tag":
        return f"{tag}, {date}"
    if view == "notes":
        notes = whats_new(repo, rel, releases)
        return (f'<p><span class="lead">{tag}</span> <span class="dim">released {date}</span></p>\n'
                f"{notes}\n"
                f'<p><a href="{html.escape(rel["html_url"])}">Release notes on GitHub</a></p>')
    return None


def main(folder):
    cache = {}
    for root, _, files in os.walk(folder):
        for name in files:
            if not name.endswith(".html"):
                continue
            path = os.path.join(root, name)
            text = open(path, encoding="utf-8").read()

            def fill(m):
                try:
                    new = render(m[2], m[3], cache)
                except Exception as e:  # keep the fallback, never break the build
                    print(f"warning: {m[2]}: {e}", file=sys.stderr)
                    new = None
                return m[1] + (new if new is not None else m[4]) + m[5]

            new_text = MARK.sub(fill, text)
            if new_text != text:
                open(path, "w", encoding="utf-8").write(new_text)
                print("release info:", os.path.relpath(path, folder))


if __name__ == "__main__":
    main(sys.argv[1])
