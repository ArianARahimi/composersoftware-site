#!/usr/bin/env python3
"""Security policy (CSP) for every page.

Usage: python3 tools/csp.py <site folder> [--fix]

Each page gets a <meta http-equiv="Content-Security-Policy"> right after its charset:
only the site's own scripts, styles, fonts and images, plus the page's own inline
<script> and <style> blocks by hash. style="" in markup is blocked, so set styles
from scripts with .style. Without --fix it only checks and fails on a stale policy;
the deploy runs it with --fix on the finished build.
A build step that adds something a page's policy must allow writes csp-extra.txt
in the site folder, lines of "page directive source"; it is read, then removed.
"""
import base64
import hashlib
import os
import re
import sys

BASE = {
    "default-src": ["'none'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'"],
    "font-src": ["'self'"],
    "connect-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
}
META = re.compile(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">\n')
BLOCK = re.compile(r"<(script|style)>(.*?)</\1>", re.S)


def sha(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"


def extras(folder):
    """page -> {directive: [sources]} from csp-extra.txt, which is then removed."""
    path, found = os.path.join(folder, "csp-extra.txt"), {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if line.strip():
                page, directive, source = line.split()
                if directive not in BASE:
                    sys.exit(f"csp-extra.txt: unknown directive {directive}")
                found.setdefault(page, {}).setdefault(directive, []).append(source)
        os.remove(path)
    return found


def kept(text):
    """Extras already in the page's policy, so running this again keeps them."""
    found, m = {}, re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', text)
    for part in (m[1].split(";") if m else []):
        directive, *sources = part.split()
        extra = [s for s in sources if s not in BASE.get(directive, []) and not s.startswith("'sha256-")]
        if extra and directive in BASE:
            found[directive] = extra
    return found


def policy(text, extra):
    p = {k: list(v) for k, v in BASE.items()}
    for k, v in extra.items():
        p[k] = [s for s in p[k] if s != "'none'"] + [s for s in dict.fromkeys(v)]
    for kind, body in BLOCK.findall(text):
        p[kind + "-src"].append(sha(body))
    return "; ".join(k + " " + " ".join(v) for k, v in p.items())


def main(folder, fix):
    stale, extra = [], extras(folder)
    for root, dirs, files in os.walk(folder):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("_site", "private", "tools")]
        for name in sorted(files):
            if not name.endswith(".html"):
                continue
            path = os.path.join(root, name)
            page = os.path.relpath(path, folder)
            text = open(path, encoding="utf-8").read()
            bare = META.sub("", text)
            if '<meta charset="utf-8">\n' not in bare:
                sys.exit(f"{page}: no <meta charset> line to put the policy after")
            mine = kept(text)
            for k, v in extra.get(page, {}).items():
                mine[k] = mine.get(k, []) + v
            meta = f'<meta http-equiv="Content-Security-Policy" content="{policy(bare, mine)}">\n'
            new = bare.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + meta, 1)
            if new != text:
                stale.append(page)
                if fix:
                    open(path, "w", encoding="utf-8").write(new)
    for page in stale:
        print(("updated: " if fix else "stale policy: ") + page)
    if stale and not fix:
        sys.exit("run: python3 tools/csp.py . --fix")


if __name__ == "__main__":
    main(sys.argv[1], "--fix" in sys.argv[2:])
