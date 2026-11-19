#!/usr/bin/env python3
"""Fill in release info from GitHub when the site is built.

Usage: python3 tools/releases.py <site folder>

Any element written like
  <span class="release" data-repo="OWNER/REPO" data-view="tag">fallback</span><!--/release-->
gets the latest release of OWNER/REPO. Views:
  version  "v1.2.3"
  iso      "2026-01-31T12:00:00Z", for scripts
  first-iso  when the project was first released, for scripts
  tag      "v1.2.3, 2026-01-31"
  notes    version, date, what's new and a link to the release
Items marked <!--item OWNER/REPO-->...<!--/item--> inside <!--latest-->...<!--/latest-->
are put newest project first: by first release, or by the latest release whose notes have
a line saying just "Overhaul" (a major update that remakes the project).
What's new is the release notes' "What's new" (or "Changes"/"Changelog")
section when there is one, otherwise the commit titles since the release
before it. If GitHub can't be reached, the fallback text stays.
A NEW! badge marked <!--new-->...<!--/new--> (holding a first-iso release time) is left
out of the page altogether once that first release is 72 hours old.
It also writes feed.xml (Atom): the releases of every project marked on the pages, newest
first, for feed readers.
"""
import datetime
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
    """List lines (- or *) become a list; other lines stay paragraphs."""
    out, items = [], []
    for l in (l.strip() for l in text.split("\n")):
        if re.match(r"[-*]\s+", l):
            items.append(f"<li>{inline(l[1:].strip())}</li>")
            continue
        if items:
            out.append('<ul class="list">' + "".join(items) + "</ul>")
            items = []
        if l:
            out.append(f"<p>{inline(l)}</p>")
    if items:
        out.append('<ul class="list">' + "".join(items) + "</ul>")
    return "\n".join(out)


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


def all_releases(repo, cache):
    """Every published release of the project (all pages of the list), oldest first."""
    key = repo + "#all"
    if key not in cache:
        page, found = 1, []
        while True:
            batch = get(f"{repo}/releases?per_page=100&page={page}")
            found += [r for r in batch if not r["draft"] and not r["prerelease"]]
            if len(batch) < 100:
                break
            page += 1
        cache[key] = sorted(found, key=lambda r: r["published_at"])
    return cache[key]


def first_release(repo, cache):
    """The project's first published release, or None."""
    releases = all_releases(repo, cache)
    return releases[0] if releases else None


OVERHAUL = re.compile(r"^[#*\s]*overhaul[*\s]*$", re.I | re.M)   # a line or heading saying just "Overhaul"


def project_date(repo, cache):
    """When the project counts as new for the Latest order: its first release, or its latest
    release whose notes say "Overhaul" (a major update that remakes it). None if no release."""
    releases = all_releases(repo, cache)
    marked = [r for r in releases if OVERHAUL.search(r.get("body") or "")]
    chosen = marked[-1] if marked else (releases[0] if releases else None)
    return chosen["published_at"] if chosen else None


def render(repo, view, cache):
    if view == "first-iso":   # for scripts: when the project was first released
        first = first_release(repo, cache)
        return html.escape(first["published_at"]) if first else None
    if repo not in cache:
        releases = [r for r in get(f"{repo}/releases?per_page=10") if not r["draft"] and not r["prerelease"]]
        cache[repo] = (releases[0], releases) if releases else None
    if not cache[repo]:
        return None
    rel, releases = cache[repo]
    tag, date = html.escape(rel["tag_name"]), rel["published_at"][:10]
    if view == "version":
        return tag
    if view == "iso":
        return html.escape(rel["published_at"])   # for scripts: when it was released
    if view == "tag":
        return f"{tag}, {date}"
    if view == "notes":
        notes = whats_new(repo, rel, releases)
        return (f'<p><span class="lead">{tag}</span> <span class="dim">released {date}</span></p>\n'
                f"{notes}\n"
                f'<p><a href="{html.escape(rel["html_url"])}">Release notes on GitHub</a></p>')
    return None


LIST = re.compile(r"(<!--latest-->)(.*?)(<!--/latest-->)", re.S)
ITEM = re.compile(r"<!--item ([\w.-]+/[\w.-]+)-->.*?<!--/item-->", re.S)


def newest_first(text, cache):
    """Inside <!--latest-->...<!--/latest-->, puts the <!--item OWNER/REPO--> blocks newest
    project first (see project_date). Any date missing: the order stays."""
    def sort(m):
        items = [(i[1], i[0]) for i in ITEM.finditer(m[2])]
        dates = []
        for repo, _ in items:
            try:
                dates.append(project_date(repo, cache))
            except Exception as e:  # keep the order, never break the build
                print(f"warning: {repo}: {e}", file=sys.stderr)
                dates.append(None)
        if not items or None in dates:
            return m[0]
        ordered = [block for _, (_, block) in sorted(zip(dates, items), key=lambda p: p[0], reverse=True)]
        gaps = re.split(r"<!--item [\w.-]+/[\w.-]+-->.*?<!--/item-->", m[2], flags=re.S)
        return m[1] + "".join(g + b for g, b in zip(gaps, ordered)) + gaps[-1] + m[3]
    return LIST.sub(sort, text)


NEW = re.compile(r"<!--new-->(.*?)<!--/new-->", re.S)
FIRST_ISO = re.compile(r'data-view="first-iso">([^<]*)<')
NEW_HOURS = 72


def drop_old_badges(text, now=None):
    """Removes NEW! badges whose project was first released NEW_HOURS or more ago (or has no
    readable time), and the markers from the ones that stay."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    def keep(m):
        found = FIRST_ISO.search(m[1])
        try:
            first = datetime.datetime.fromisoformat(found[1].replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return ""
        return m[1] if now - first < datetime.timedelta(hours=NEW_HOURS) else ""
    return NEW.sub(keep, text)


SITE = "https://composersoftware.net"
NAMES = {"vt-quarantine": "VirusTotal Quarantine", "queenfisher": "Queenfisher"}   # repo -> name in the feed
FEED_SIZE = 20


def feed(folder, repos, cache):
    """feed.xml: the projects' releases, newest first. A project GitHub won't give is left out."""
    found = []
    for repo in sorted(repos):
        try:
            found += [(repo, r) for r in all_releases(repo, cache)]
        except Exception as e:  # never break the build
            print(f"warning: feed: {repo}: {e}", file=sys.stderr)
    found = sorted(found, key=lambda p: p[1]["published_at"], reverse=True)[:FEED_SIZE]
    esc = lambda t: html.escape(t, quote=True)
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entries = []
    for repo, r in found:
        name = NAMES.get(repo.split("/")[1], repo.split("/")[1])
        notes = section(r.get("body") or "")
        body = (bullets(notes) + "\n" if notes else "") + f'<p><a href="{esc(r["html_url"])}">Release notes on GitHub</a></p>'
        entries.append(f"""<entry>
  <title>{esc(name + " " + r["tag_name"])}</title>
  <id>{esc(r["html_url"])}</id>
  <link href="{esc(r["html_url"])}"/>
  <updated>{esc(r["published_at"])}</updated>
  <content type="html">{esc(body)}</content>
</entry>
""")
    updated = found[0][1]["published_at"] if found else now
    text = f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Composer Software releases</title>
<id>{SITE}/feed.xml</id>
<link rel="self" href="{SITE}/feed.xml"/>
<link href="{SITE}/"/>
<updated>{esc(updated)}</updated>
<author><name>Composer Software</name></author>
{"".join(entries)}</feed>
"""
    open(os.path.join(folder, "feed.xml"), "w", encoding="utf-8").write(text)
    print(f"feed: {len(found)} releases")


def main(folder):
    cache, repos = {}, set()
    for root, _, files in os.walk(folder):
        for name in files:
            if not name.endswith(".html"):
                continue
            path = os.path.join(root, name)
            text = open(path, encoding="utf-8").read()
            repos.update(m[2] for m in MARK.finditer(text))

            def fill(m):
                try:
                    new = render(m[2], m[3], cache)
                except Exception as e:  # keep the fallback, never break the build
                    print(f"warning: {m[2]}: {e}", file=sys.stderr)
                    new = None
                return m[1] + (new if new is not None else m[4]) + m[5]

            new_text = drop_old_badges(newest_first(MARK.sub(fill, text), cache))
            if new_text != text:
                open(path, "w", encoding="utf-8").write(new_text)
                print("release info:", os.path.relpath(path, folder))
    feed(folder, repos, cache)


if __name__ == "__main__":
    main(sys.argv[1])
