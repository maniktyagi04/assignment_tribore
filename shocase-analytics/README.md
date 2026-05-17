# Shocase Analytics — Demo Take-Home

## What this is
A stripped-down demo video analytics service. A vanilla JS tracker snippet embeds on any page with a `<video>` element and fires watch events (play, pause, quartile progress, ended) to a Node/Express backend. The backend stores events in SQLite and computes aggregated stats. A React dashboard lets you enter a demoId and see total views, unique viewers, avg completion %, and a drop-off funnel.

## How to run

### Backend (Terminal 1)
```bash
cd backend
npm install
npm run dev
```
Runs on http://localhost:3001

### Sample test page (Terminal 2)
```bash
cd sample
npx serve .
```
Open http://localhost:3000 — play the video to generate tracking events

### Dashboard (Terminal 3)
```bash
cd dashboard
npm install
npm run dev
```
Open http://localhost:5173 — enter `demo_001` to see stats

## Project structure

```
shocase-analytics/
├── backend/
│   ├── server.js      — Express API with POST /events and GET /demos/:id/stats
│   ├── db.js          — SQLite setup and table creation via better-sqlite3
│   └── data/          — SQLite database file lives here (gitignored)
├── tracker/
│   └── tracker.js     — Embeddable vanilla JS snippet, no dependencies
├── sample/
│   └── index.html     — Test page with Big Buck Bunny video + live event log
└── dashboard/
    └── src/
        └── App.jsx    — Single React page: search bar, stat cards, CSS funnel chart
```

## What I'd do with more time

- **Authentication and demo isolation** — right now anyone who knows a demoId can see its stats. Adding JWT auth and scoping demos to users would make this production-ready.
- **PostgreSQL instead of SQLite** — SQLite is fine for local dev but won't handle concurrent writes at scale. Swap the db layer to pg with the same query interface.
- **Real-time dashboard via Server-Sent Events** — the dashboard currently requires a manual refresh. SSE would push new event counts to connected clients as they arrive.
- **Per-second heatmap data** — instead of just quartile events, store a timestamp for every 5-second interval. This enables a scrubber-style heatmap showing exactly where viewers rewatch or drop off.
- **Shareable public stats page** — a read-only route like `/share/:demoId` that renders stats without needing the dashboard app, so creators can share a link directly.

## What I used AI for

- Claude Code scaffolded the Express server structure and the two endpoint handlers
- Claude Code wrote the SQLite aggregate queries for totalViews, uniqueViewers, avgCompletionPct, and the funnel calculation
- Claude Code generated the quartile tracking logic in tracker.js (the timeupdate listener + firedQuartiles Set pattern)
- Claude Code built the CSS-only horizontal bar chart for the funnel in the React dashboard
- All decisions about the event schema, the stats response shape, and the funnel calculation method were made manually before prompting
- Every generated file was read and debugged by hand after generation
