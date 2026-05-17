import { useState, useCallback } from 'react'
import './App.css'

const BACKEND = ''   // Vite proxy forwards /demos/* and /events → localhost:3001

const FUNNEL_STAGES = [
  { key: 'play',        label: 'Play'  },
  { key: 'progress_25', label: '25%'   },
  { key: 'progress_50', label: '50%'   },
  { key: 'progress_75', label: '75%'   },
  { key: 'ended',       label: 'Ended' },
]


export default function App() {
  const [demoId,  setDemoId]  = useState('demo_001')
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetchStats = useCallback(async (targetId) => {
    const id = (typeof targetId === 'string' ? targetId : demoId).trim()
    if (!id) return
    setLoading(true)
    setError(null)
    setStats(null)
    try {
      const res = await fetch(`${BACKEND}/demos/${id}/stats`)
      if (res.status === 404) {
        setError('No data found for this demo ID.')
        return
      }
      if (!res.ok) throw new Error('Server error')
      setStats(await res.json())
    } catch (e) {
      setError('Failed to fetch stats. Is the backend running on port 3001?')
    } finally {
      setLoading(false)
    }
  }, [demoId])

  const handleKey = (e) => { if (e.key === 'Enter') fetchStats() }

  const playCount = stats?.funnel?.play ?? 0
  const pct = (count) =>
    playCount === 0 ? '0%' : Math.round((count / playCount) * 100) + '%'
  const barWidth = (count) =>
    playCount === 0 ? '0%' : (count / playCount * 100) + '%'

  return (
    <div className="app">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-dot" />
            <span className="logo-text">Shocase <span className="logo-accent">Analytics</span></span>
          </div>
          <p className="header-sub">Demo video insights</p>
        </div>
      </header>

      <main className="main">

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <section className="search-section">
          <label className="search-label" htmlFor="demo-input">Demo ID</label>
          <div className="search-row">
            <input
              id="demo-input"
              className="search-input"
              type="text"
              value={demoId}
              onChange={(e) => setDemoId(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. demo_001"
              spellCheck={false}
            />
            <button
              className="search-btn"
              onClick={() => fetchStats()}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Fetch Stats'}
            </button>
          </div>

          {error && <p className="error-msg">{error}</p>}
        </section>

        {/* ── Stats cards ──────────────────────────────────────────────────── */}
        {stats && !loading && (
          <>
            <section className="cards-row">
              <StatCard label="Total Views"     value={stats.totalViews}                    />
              <StatCard label="Unique Viewers"  value={stats.uniqueViewers}                 />
              <StatCard label="Avg Completion"  value={stats.avgCompletionPct + '%'}        />
              <StatCard label="Demo ID"         value={stats.demoId} mono                   />
            </section>

            {/* ── Insights Section ─────────────────────────────────────────── */}
            {stats.insights && (
              <section className="insights-section">
                <h2 className="insights-title">Performance Insights</h2>
                <div className="insights-grid">
                  <div className="insight-card">
                    <span className="insight-label">📉 Biggest Drop-off</span>
                    <span className="insight-value highlight-drop">{stats.insights.biggestDropOffPoint}</span>
                  </div>
                  <div className="insight-card">
                    <span className="insight-label">💎 Engagement Quality</span>
                    <span className={`insight-value highlight-quality-${stats.insights.engagementQuality.toLowerCase()}`}>
                      {stats.insights.engagementQuality}
                    </span>
                  </div>
                  <div className="insight-card">
                    <span className="insight-label">📊 Retention Summary</span>
                    <span className="insight-value">{stats.insights.retentionSummary}</span>
                  </div>
                </div>
              </section>
            )}

            {/* ── Drop-off funnel ──────────────────────────────────────────── */}
            <section className="funnel-section">
              <h2 className="funnel-title">Viewer drop-off funnel</h2>
              <div className="funnel-bars">
                {FUNNEL_STAGES.map(({ key, label }) => {
                  const count = stats.funnel[key] ?? 0
                  return (
                    <div className="funnel-row" key={key}>
                      <div className="funnel-meta">
                        <span className="funnel-stage">{label}</span>
                        <span className="funnel-stats">
                          <strong className="funnel-count">{count}</strong>
                          <span className="funnel-pct"> viewers ({pct(count)})</span>
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: barWidth(count) }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Loading State ────────────────────────────────────────────────── */}
        {loading && (
          <div className="loading-state-card">
            <div className="pulse-loader" />
            <p className="loading-text">Analyzing video retention logs...</p>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!stats && !loading && (
          <div className="empty-state-card">
            <div className="empty-icon">📊</div>
            <h3 className="empty-title">Ready to Fetch</h3>
            <p className="empty-text">
              Enter a Demo ID above (such as <code>demo_001</code>) or click a quick-select chip to query its performance.
            </p>
            <div className="guidance-box">
              <h4 className="guidance-title">💡 How to generate test events:</h4>
              <ol className="guidance-list">
                <li>Make sure the backend is active, then launch your test page at <code>http://localhost:3000</code>.</li>
                <li>Play, pause, or fast-forward the demo video to trigger tracking points.</li>
                <li>The upgraded tracker will queue, buffer, and batch-dispatch events within 2 seconds.</li>
                <li>Search that Demo ID here to view live, session-aware retention insights!</li>
              </ol>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="footer">
        No auth · local only · data resets when backend restarts
      </footer>
    </div>
  )
}

function StatCard({ label, value, mono }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  )
}
