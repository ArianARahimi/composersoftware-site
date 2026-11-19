#!/usr/bin/env python3
"""Short and old addresses that lead to a project page.

Usage: python3 tools/redirects.py <site folder>

GitHub Pages can't redirect, so each address becomes <address>/index.html, a tiny page that
sends the browser on at once (so /vtq and /vtq/ both work). Search engines are told to skip
them and to credit the real page. Addresses are case-sensitive: list them in lowercase.
"""
import html
import os
import sys

SITE = "https://composersoftware.net"
# real page -> (name for the page title, addresses that lead to it)
REDIRECTS = {
    "/projects/vt-quarantine": ("VirusTotal Quarantine", [
        "vt-quarantine", "vtq", "vtquarantine", "virustotalquarantine", "virustotal-quarantine",
        "virus-total-quarantine",
        "projects/vtq", "projects/vtquarantine", "projects/virustotalquarantine",
        "projects/virustotal-quarantine", "projects/virus-total-quarantine",
    ]),
    "/projects/queenfisher": ("Queenfisher", [
        "queenfisher", "queen-fisher", "qfisher", "qf",
        "projects/queen-fisher", "projects/qfisher", "projects/qf",
        "yt-dlp-wrapper", "projects/yt-dlp-wrapper",   # its old name
    ]),
}

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>html{{background:#000}}</style>
<title>{name} - Composer Software</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="{site}{target}">
<meta http-equiv="refresh" content="0; url={target}">
</head>
<body>
<p><a href="{target}">{name}</a></p>
</body>
</html>
"""


def main(folder):
    count = 0
    for target, (name, addresses) in REDIRECTS.items():
        for address in addresses:
            assert address == address.lower() and not address.startswith("/"), address
            path = os.path.join(folder, address, "index.html")
            if os.path.exists(path) or os.path.exists(os.path.join(folder, address + ".html")):
                sys.exit(f"redirects: {address} is already a page")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(PAGE.format(name=html.escape(name), site=SITE, target=target))
            count += 1
    print(f"redirects: {count} addresses")


if __name__ == "__main__":
    main(sys.argv[1])
