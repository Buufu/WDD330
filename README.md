# MovieFInder

A responsive movie and TV discovery site with trending titles, multi-criteria filters, title details, regional streaming lookup, trailers, and a persistent watchlist.

## Run locally

Open `index.html` in a browser, or use a local static server such as the VS Code Live Server extension. The site works without API keys using its clearly labeled preview catalog. The watchlist and selected region are saved in browser local storage.

## Connect live data

Open **API settings** from the gear icon or footer, then add:

- **TMDB API key** to load trending and search results, title details, cast, posters, trailers, and regional provider data.
- **Watchmode API key** (optional) to retrieve streaming sources and service links when opening a title.

Keys are stored in this browser's local storage. This is convenient for a class project, but it is **not secure for a public deployment**: client-side keys can be inspected by visitors. For a public site, move API requests behind a server-side proxy and keep credentials on the server. API rate limits and availability are controlled by TMDB and Watchmode.

## Main files

- `index.html` — discovery page and dialogs.
- `watchlist.html` — saved titles.
- `css/styles.css` — responsive dark-cinema styling.
- `js/data.js` — preview catalog and genre mappings.
- `js/api.js` — TMDB and Watchmode request helpers.
- `js/storage.js` — local storage persistence.
- `js/app.js` — search, filters, cards, details, trailer, and page interactions.
