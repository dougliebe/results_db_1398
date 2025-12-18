# DFS Contest Dashboard (JS-only)

Static web app that runs entirely on GitHub Pages. Upload a DFS contest CSV and explore:

- Lineup leaderboard (rank, points, lineup)
- Player summaries (% drafted, FPTS)
- Entry inspector (search by entry)

## Usage

1. Open `index.html` (or deploy via GitHub Pages).
2. Drag-and-drop your CSV or use the file picker.
3. Use the tabs to navigate between views.

## CSV Format

The CSV contains two logical tables interleaved:

- Lineups: `Rank, EntryId, EntryName, TimeRemaining, Points, Lineup` (we ignore the blank column after `Lineup`)
- Player summaries: `Player, Roster Position, %Drafted, FPTS`

We parse and normalize both in the browser with PapaParse.

## Development

No build tools needed. Files:

- `index.html` — shell, tabs, uploader
- `styles.css` — layout and tables
- `parse.js` — CSV parsing and normalization
- `views/leaderboard.js` — leaderboard view
- `views/players.js` — players view
- `views/entries.js` — entries view
- `app.js` — state management and wiring

## Deploy (GitHub Pages)

1. Commit to a GitHub repo.
2. In repo Settings → Pages, choose source (e.g. `main` branch `/ (root)`).
3. Save. After a minute, your site will be live at the Pages URL.


