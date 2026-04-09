# Copilot Executive Dashboard Rebuild

This folder contains a clean-room static rebuild of the executive dashboard pattern you referenced.

## What it is

- Plain static site: `index.html`, `styles.css`, `app.js`
- Client-side charts rendered with Chart.js from CDN
- Safe for GitHub Pages deployment
- Uses illustrative data only

## Preview locally

Open `index.html` directly in a browser, or serve the folder with any static server.

Example:

```bash
cd copilot-exec-dashboard-rebuild
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new GitHub repository under your account.
2. Copy these files into the repository root.
3. Push to `main`.
4. In GitHub, open `Settings` -> `Pages`.
5. Set the source to `Deploy from a branch`.
6. Choose `main` and `/ (root)`.
7. Your site will publish at `https://blackdynomite.github.io/growth-exec-dashboard/`.

## Next upgrades

- Replace illustrative arrays in `app.js` with your own exported metrics.
- Move the data into JSON files if you want a cleaner content pipeline.
- Add automated publish from a GitHub Actions workflow if this becomes a recurring report.
