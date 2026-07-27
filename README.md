# Sumo Bounce

**Play now: <https://rainforest-0305.github.io/sumo-bounce/>**

Charge up, aim, and shove your rival out of the shrinking ring. Arcade tournament, local 2-player versus and free practice, with 10 fighters, 12 arenas and 8 special rules.

## About this repository

`Sumo Bounce` is an installable Progressive Web App (PWA). The whole game is a single
self-contained HTML file with an offline service worker - there are no runtime
network calls, no accounts, no ads and no tracking. It runs fully offline once
installed.

* Live URL: <https://rainforest-0305.github.io/sumo-bounce/>
* Web app manifest: <https://rainforest-0305.github.io/sumo-bounce/manifest.json>
* Service worker: <https://rainforest-0305.github.io/sumo-bounce/sw.js>
* Display mode: `standalone`
* Languages: English, Espanol, Francais, Portugues, Russian, Deutsch, Japanese, Turkce, Korean (9)
* Offline: yes (service worker precaches the app shell and all icons)

## Ownership

**This repository and the GitHub account `Rainforest-0305` are owned by me, the
author and publisher of Sumo Bounce.** The game, its source code, artwork and icons
were created by the owner of this account, and this repository is the
authoritative public source of the published web build. It is referenced as
proof of ownership for app store submissions.

## Contents

| Path | Purpose |
| --- | --- |
| `index.html` | The complete game (single file, 9 languages) |
| `manifest.json` | Web app manifest - name, icons, start_url, scope |
| `sw.js` | Service worker - network-first for navigation, cache-first for assets |
| `icons/` | 11 `any` icons (48-1024px) + 3 `maskable` icons (192/512/1024px) |
| `screenshots/` | Store/manifest screenshots (wide + narrow form factors) |

## Local run

Any static file server works, e.g.:

```
python -m http.server 8080
```

Then open <http://localhost:8080/>.

## License

Copyright (c) 2026 Rainforest-0305. All rights reserved.
