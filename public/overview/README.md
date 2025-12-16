Public Overview Site

This folder contains the public, static overview site for SproutMC. It is intentionally isolated from the wrapper UI (the admin interface under `public/index.html`).

Serve at: `/overview/`

Files:
- `index.html` — main public overview page
- `styles.css` — theme (green/black gradient, dark mode forced)
- `app.js` — small script for status placeholder and year

Notes:
- Replace the placeholder server address in `index.html` with the real IP/host.
- If you want a live server-status, wire a real API endpoint into `app.js`.
- This site is intentionally **isolated**: all CSS is scoped under the `.overview-root` container and scripts use local scope so it will not conflict with the wrapper UI or global assets.
- Serve at `/overview/` (keep files together in this directory to maintain isolation).

Local testing

- From the repository root you can run the overview site locally with:

  ```bash
  npm run serve:overview
  ```

- The script serves the site at http://localhost:8081 by default. If you prefer a different port, adjust the `-l` argument in the script or use `npx serve public/overview -l <port>` directly.

Overview server via wrapper

- The wrapper now optionally starts a lightweight static server for the overview site when you run `npm start`.
- Defaults:
  - Wrapper main app: PORT=3000
  - Overview static site: OVERVIEW_PORT=3005
- To change these, set the environment variables before running `npm start`:

  ```bash
  PORT=3000 OVERVIEW_PORT=3005 npm start
  ```

- To disable the overview server (start only the wrapper):

  ```bash
  OVERVIEW_ENABLED=false npm start
  ```

This setup uses an internal static server (not the `npx serve` one) so both services start together with the same command and remain isolated.