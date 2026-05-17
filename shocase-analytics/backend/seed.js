const db = require('./db');

// Clear existing events to start fresh and clean
console.log('🧹 Clearing old events table...');
db.prepare('DELETE FROM events').run();

// Helper to compile timestamps (relative times in ISO format)
const getTimeString = (offsetSeconds) => {
  return new Date(Date.now() - offsetSeconds * 1000).toISOString();
};

const insertStmt = db.prepare(`
  INSERT INTO events (demo_id, viewer_id, session_id, event_type, timestamp)
  VALUES (?, ?, ?, ?, ?)
`);

console.log('🌱 Seeding mock viewer session events...');

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEMO_001: high-engagement onboarding video (Medium/High retention)
// ─────────────────────────────────────────────────────────────────────────────
const demo1 = 'demo_001';
// Session 1: completed all the way
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 300);
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 280);
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 260);
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 240);
// Session 2: paused in the middle, then finished
createSession(demo1, [ 'play', 'pause', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 200);
// Session 3: dropped at 75%
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75' ], 180);
createSession(demo1, [ 'play', 'progress_25', 'progress_50', 'progress_75' ], 160);
// Session 4: dropped at 50%
createSession(demo1, [ 'play', 'progress_25', 'progress_50' ], 140);
createSession(demo1, [ 'play', 'progress_25', 'progress_50' ], 120);
// Session 5: abandoned early
createSession(demo1, [ 'play', 'progress_25' ], 100);
createSession(demo1, [ 'play' ], 80);
createSession(demo1, [ 'play' ], 60);

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEMO_002: low-engagement developer guide (High early drop-off)
// ─────────────────────────────────────────────────────────────────────────────
const demo2 = 'demo_002';
// 15 sessions play the video, but 10 drop immediately after starting (high early drop)
for (let i = 0; i < 10; i++) {
  createSession(demo2, [ 'play' ], 400 + i * 10);
}
// 3 sessions drop at 25%
createSession(demo2, [ 'play', 'progress_25' ], 300);
createSession(demo2, [ 'play', 'progress_25' ], 280);
createSession(demo2, [ 'play', 'progress_25' ], 260);
// Only 2 sessions finish it
createSession(demo2, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 200);
createSession(demo2, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 100);

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEMO_003: high mid-point drop-off (largest drop between 50% and 75%)
// ─────────────────────────────────────────────────────────────────────────────
const demo3 = 'demo_003';
// 12 sessions play, progress through 25% and 50%, but then drop heavily before 75%
for (let i = 0; i < 4; i++) {
  createSession(demo3, [ 'play', 'progress_25', 'progress_50', 'progress_75', 'ended' ], 500 + i * 10);
}
for (let i = 0; i < 6; i++) {
  createSession(demo3, [ 'play', 'progress_25', 'progress_50' ], 300 + i * 10);
}
createSession(demo3, [ 'play', 'progress_25' ], 200);
createSession(demo3, [ 'play' ], 100);

console.log('✅ Successfully seeded events database!');
process.exit(0);

// Helper function to insert a full sequence-correct mock viewing session
function createSession(demoId, eventList, baseOffsetSeconds) {
  const viewerId = 'viewer_' + Math.random().toString(36).substr(2, 9);
  const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);

  eventList.forEach((event, index) => {
    // stagger events slightly in order of playback ticks
    const timestamp = getTimeString(baseOffsetSeconds - index * 5);
    insertStmt.run(demoId, viewerId, sessionId, event, timestamp);
  });
}
