const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());          // allow all origins (frontend lives on a different port)
app.use(express.json());  // parse JSON request bodies

// ── Prepared statements (compiled once, reused on every call) ─────────────────
const insertEvent = db.prepare(`
  INSERT INTO events (demo_id, viewer_id, event_type, timestamp)
  VALUES (@demo_id, @viewer_id, @event_type, @timestamp)
`);

const selectEventsByDemo = db.prepare(`
  SELECT viewer_id, event_type
  FROM   events
  WHERE  demo_id = ?
`);

// ── ENDPOINT 1: POST /events ──────────────────────────────────────────────────
app.post('/events', (req, res) => {
  const { demoId, viewerId, event, timestamp } = req.body;

  if (!demoId || !viewerId || !event || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  insertEvent.run({
    demo_id:    demoId,
    viewer_id:  viewerId,
    event_type: event,
    timestamp:  timestamp,
  });

  return res.status(201).json({ success: true });
});

// ── ENDPOINT 2: GET /demos/:demoId/stats ──────────────────────────────────────
app.get('/demos/:demoId/stats', (req, res) => {
  const { demoId } = req.params;
  const rows = selectEventsByDemo.all(demoId);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Demo not found' });
  }

  // Map quartile event names → completion percentage value
  const quartileValue = {
    progress_25: 25,
    progress_50: 50,
    progress_75: 75,
    ended:       100,
  };

  // Funnel event types we care about (in order)
  const funnelEvents = ['play', 'progress_25', 'progress_50', 'progress_75', 'ended'];

  // Aggregate per viewer
  // viewerData[viewerId] = { events: Set<eventType> }
  const viewerData = {};

  for (const { viewer_id, event_type } of rows) {
    if (!viewerData[viewer_id]) {
      viewerData[viewer_id] = { events: new Set() };
    }
    viewerData[viewer_id].events.add(event_type);
  }

  const allViewerIds = Object.keys(viewerData);
  const uniqueViewers = allViewerIds.length;

  // totalViews = distinct viewer_ids who fired "play"
  const totalViews = allViewerIds.filter(v => viewerData[v].events.has('play')).length;

  // avgCompletionPct:
  //   For each viewer, find their max quartile reached as %.
  //   Viewers who played but hit no quartile count as 0.
  //   Only viewers who fired "play" are included in the average.
  const playViewers = allViewerIds.filter(v => viewerData[v].events.has('play'));

  let completionSum = 0;
  for (const v of playViewers) {
    let maxPct = 0;
    for (const [eventName, pct] of Object.entries(quartileValue)) {
      if (viewerData[v].events.has(eventName) && pct > maxPct) {
        maxPct = pct;
      }
    }
    completionSum += maxPct;
  }

  const avgCompletionPct =
    playViewers.length > 0
      ? Math.round((completionSum / playViewers.length) * 10) / 10
      : 0;

  // Funnel: unique viewers per event type
  const funnel = {};
  for (const eventType of funnelEvents) {
    funnel[eventType] = allViewerIds.filter(v =>
      viewerData[v].events.has(eventType)
    ).length;
  }

  return res.status(200).json({
    demoId,
    totalViews,
    uniqueViewers,
    avgCompletionPct,
    funnel,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
