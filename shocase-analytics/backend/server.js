const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());          // allow all origins (frontend lives on a different port)
app.use(express.json());  // parse JSON request bodies

// Allowed tracking event types
const ALLOWED_EVENTS = new Set([
  'play',
  'pause',
  'progress_25',
  'progress_50',
  'progress_75',
  'ended'
]);

// ── Prepared statements (compiled once, reused on every call) ─────────────────
const insertEvent = db.prepare(`
  INSERT INTO events (demo_id, viewer_id, session_id, event_type, timestamp)
  VALUES (@demo_id, @viewer_id, @session_id, @event_type, @timestamp)
`);

const selectEventsByDemo = db.prepare(`
  SELECT viewer_id, session_id, event_type, timestamp
  FROM   events
  WHERE  demo_id = ?
  ORDER BY timestamp ASC
`);

// ── ENDPOINT 1: POST /events ──────────────────────────────────────────────────
app.post('/events', (req, res) => {
  const { demoId, viewerId, sessionId, event, timestamp } = req.body;

  // 1. Presence & primitive type validation (lightweight validation)
  if (
    typeof demoId !== 'string' || !demoId.trim() ||
    typeof viewerId !== 'string' || !viewerId.trim() ||
    typeof sessionId !== 'string' || !sessionId.trim() ||
    typeof event !== 'string' || !event.trim() ||
    typeof timestamp !== 'string' || !timestamp.trim()
  ) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  // 2. Domain logic: validate event constraints
  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: `Invalid event type. Must be one of: ${Array.from(ALLOWED_EVENTS).join(', ')}` });
  }

  insertEvent.run({
    demo_id:    demoId.trim(),
    viewer_id:  viewerId.trim(),
    session_id: sessionId.trim(),
    event_type: event,
    timestamp:  timestamp.trim(),
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

  // Group events by session_id to maintain session-aware isolated context
  const sessions = {};
  const uniqueViewersSet = new Set();

  for (const row of rows) {
    const { viewer_id, session_id, event_type } = row;
    uniqueViewersSet.add(viewer_id);

    // If session_id is empty, fall back to viewer_id for backwards compatibility
    const sessionKey = session_id || viewer_id;

    if (!sessions[sessionKey]) {
      sessions[sessionKey] = {
        viewerId: viewer_id,
        events: new Set()
      };
    }
    sessions[sessionKey].events.add(event_type);
  }

  const allSessions = Object.values(sessions);

  // ── ANALYTICS REASONING & PROGRESSION VALIDATION ────────────────────────────
  //
  // 1. Session-Aware Engagement:
  //    Rather than grouping raw events only by viewerId, we segregate tracking
  //    into individual viewing sessions. A single viewer returning later should
  //    count as a fresh play session to accurately reflect total viewing loops.
  //
  // 2. Ordered Quartile Progression Validation:
  //    To prevent reporting false completions (e.g., a viewer skipping directly 
  //    to the end of a video without playing the middle), we validate the 
  //    quartiles sequentially. A higher quartile is only credited if all previous 
  //    predecessors (play -> 25% -> 50% -> 75% -> ended) are present in the session.
  //
  // 3. Better Completion Estimation:
  //    Average completion is calculated specifically across sessions that actually 
  //    registered a 'play' event, preventing empty/corrupt sessions from skewing 
  //    the average down to zero.
  // ────────────────────────────────────────────────────────────────────────────

  let activePlaySessionsCount = 0;
  let totalValidatedCompletionSum = 0;

  // Funnel count trackers (strictly sequential validated states)
  const funnel = {
    play: 0,
    progress_25: 0,
    progress_50: 0,
    progress_75: 0,
    ended: 0
  };

  for (const session of allSessions) {
    const events = session.events;
    
    // Evaluate ordered quartile chain
    let validatedCompletion = 0;
    let hasPlayed = false;

    if (events.has('play')) {
      hasPlayed = true;
      funnel.play++;
      activePlaySessionsCount++;
      
      if (events.has('progress_25')) {
        validatedCompletion = 25;
        funnel.progress_25++;
        
        if (events.has('progress_50')) {
          validatedCompletion = 50;
          funnel.progress_50++;
          
          if (events.has('progress_75')) {
            validatedCompletion = 75;
            funnel.progress_75++;
            
            if (events.has('ended')) {
              validatedCompletion = 100;
              funnel.ended++;
            }
          }
        }
      }
      
      totalValidatedCompletionSum += validatedCompletion;
    }
  }

  // Calculate session-aware average completion pct
  const avgCompletionPct =
    activePlaySessionsCount > 0
      ? Math.round((totalValidatedCompletionSum / activePlaySessionsCount) * 10) / 10
      : 0;

  // totalViews = count of play events (grouped session-aware plays)
  const totalViews = funnel.play;
  const uniqueViewers = uniqueViewersSet.size;

  // ── DYNAMIC INSIGHTS ENGINE ──────────────────────────────────────────────────
  let biggestDropOffPoint = 'No significant drop-off';
  let engagementQuality = 'Low';
  let retentionSummary = 'High early abandonment';

  if (totalViews > 0) {
    // 1. Determine Biggest Drop-off Point
    const dropPlayTo25 = funnel.play - funnel.progress_25;
    const drop25to50 = funnel.progress_25 - funnel.progress_50;
    const drop50to75 = funnel.progress_50 - funnel.progress_75;
    const drop75toEnd = funnel.progress_75 - funnel.ended;

    const drops = [
      { key: 'At the start (Play to 25%)', val: dropPlayTo25 },
      { key: 'In the early phase (25% to 50%)', val: drop25to50 },
      { key: 'In the mid phase (50% to 75%)', val: drop50to75 },
      { key: 'Near the end (75% to Completion)', val: drop75toEnd }
    ];

    // Find the label of the largest absolute drop
    drops.sort((a, b) => b.val - a.val);
    if (drops[0].val > 0) {
      biggestDropOffPoint = drops[0].key;
    }

    // 2. Determine Engagement Quality based on average completion percentage
    if (avgCompletionPct >= 70) {
      engagementQuality = 'High';
    } else if (avgCompletionPct >= 40) {
      engagementQuality = 'Medium';
    } else {
      engagementQuality = 'Low';
    }

    // 3. Determine Retention Summary using funnel conversion ratios
    const startDropRatio = dropPlayTo25 / funnel.play;
    const endCompletionRatio = funnel.ended / funnel.play;

    if (startDropRatio > 0.5) {
      retentionSummary = 'High early abandonment — viewers lose interest in the first 25%';
    } else if (endCompletionRatio >= 0.6) {
      retentionSummary = 'Strong viewer retention — most viewers complete the demo';
    } else if (endCompletionRatio >= 0.3) {
      retentionSummary = 'Moderate retention — typical drop-off curve';
    } else {
      retentionSummary = 'Gradual decline — viewer interest steadily decays throughout';
    }
  } else {
    biggestDropOffPoint = 'No views recorded yet';
    engagementQuality = 'N/A';
    retentionSummary = 'No data available';
  }

  return res.status(200).json({
    demoId,
    totalViews,
    uniqueViewers,
    avgCompletionPct,
    funnel,
    insights: {
      biggestDropOffPoint,
      engagementQuality,
      retentionSummary
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
