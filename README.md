# composersoftware.net

Static site, deployed by GitHub Actions (`.github/workflows/deploy.yml`).

- `robots.txt`, `sitemap.xml`: for search engines (a new page goes in the sitemap too)
- `index.html`, `projects/`, `about/index.html`, `404.html`: pages, each with the same header and footer
  (a new page also goes in the header and footer nav of every other page)
- `style.css`: styles, ZealOS colors at the top
- `site.js`: typing over the tagline on the home page (desktop only), closing the download window on a click outside it, clickable project windows, and starting the title intro
- `backdrop.js`: the moving pattern behind the top of a page, on the home page only, fading in once the title intro is over
- `intro/`: the home page title intros. `core.js` holds the shared parts, every other file is one effect.
  The home page downloads `core.js` and the one effect it picks; other pages download none of it.
  `index.html` picks the effect in its first script and starts those downloads at once, next to `site.js`.
  A new effect is a new file (`INTROS.<name> = (heading, done) => ...`) plus its name in that script's list.
- `fonts/`: `Px437_IBM_VGA_8x16.woff2`, converted from the TTF in the
  [Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) v2.2 by VileR
  (CC BY-SA 4.0, see `fonts/LICENSE.TXT`)
- `fonts/PxPlus_IBM_VGA_8x16-copyright.woff2`: only the © sign from PxPlus_IBM_VGA_8x16
  (same pack and license), since Px437 has no ©
- `fonts/PxPlus_IBM_VGA_8x16-cyrillic.woff2`: only the Cyrillic letters from PxPlus_IBM_VGA_8x16
  (same pack and license), for the glitch title intro

Links use clean addresses (`/projects`, not `projects.html`). GitHub Pages serves
those; a local preview server may need the `.html` typed in.

When `style.css`, `site.js`, `backdrop.js` or anything in `intro/` changes, raise the `?v=` number in the HTML files
so browsers don't mix a cached old file with the new pages.

Every page has a security policy (CSP) meta tag: only the site's own files, plus its inline
`<script>`/`<style>` blocks by hash. After changing an inline block, run `python3 tools/csp.py . --fix`
(the deploy checks it, then reapplies it to the finished build). `style=""` in markup is blocked;
set styles from scripts with `.style`.

Every page has share tags (`og:`, `twitter:card`) for link previews; a project page also names its
screenshot. A new page gets the same.

## Projects

`projects/index.html` lists every project as a window that links to its own page
(`projects/<name>.html`, served as `/projects/<name>`). The home page shows the
latest one under Latest.

Release info comes from GitHub when the site is built (on every push and once a
day): `tools/releases.py` fills in any element marked
`<span class="release" data-repo="OWNER/REPO" data-view="tag">…</span><!--/release-->`
(`tag` = version and date, `notes` = what's new with a link). What's new is the
release notes' "What's new" section if there is one, otherwise the commit titles
since the previous release. For a new project, add the same markers, and its name in
`NAMES` in `tools/releases.py` for the feed. The build also writes `feed.xml`, an Atom feed of
every project's releases (linked from each page's head). The Projects page and the home
page's Latest are put newest project first the same way (`<!--latest-->`/`<!--item-->` markers).

## Download icons

The download window has a 32x32 slot per system. Put the pixel art in
`icons/windows.png`, `icons/macos.png` and `icons/linux.png`. Draw at 32x32 so
one art pixel is one screen pixel, like the font (16x16 also works, doubled).

## Hosting

GitHub Pages, deployed by the workflow on every push to `main`. Custom domain in `CNAME`.

DNS:

- `A @`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- `AAAA @`: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
- `CNAME www`: ArianARahimi.github.io
