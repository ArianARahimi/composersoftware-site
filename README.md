# composersoftware.net

Static site, deployed by GitHub Actions (`.github/workflows/deploy.yml`).

- `index.html`, `projects.html`, `404.html`: pages, each with the same header and footer
- `style.css`: styles, ZealOS colors at the top
- `site.js`: typing over the tagline on the home page (desktop only), and closing the download window on a click outside it
- `fonts/`: `Px437_IBM_VGA_8x16.woff2`, converted from the TTF in the
  [Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) v2.2 by VileR
  (CC BY-SA 4.0, see `fonts/LICENSE.TXT`)

Links use clean addresses (`/projects`, not `projects.html`). GitHub Pages serves
those; a local preview server may need the `.html` typed in.

When `style.css` or `site.js` changes, raise the `?v=` number in the HTML files
so browsers don't mix a cached old file with the new pages.

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
