# composersoftware.net

Static site. No build step.

- `index.html`, `404.html`: pages
- `style.css`: styles, colors at the top
- `site.js`: clock
- `fonts/`: `Px437_IBM_VGA_8x16.woff2`, converted from the TTF in the
  [Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) v2.2 by VileR
  (CC BY-SA 4.0, see `fonts/LICENSE.TXT`)

Hidden projects are commented out in `index.html`.

## Hosting

GitHub Pages from `main`, root folder. Custom domain in `CNAME`.

DNS:

- `A @`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- `AAAA @`: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
- `CNAME www`: ArianARahimi.github.io
