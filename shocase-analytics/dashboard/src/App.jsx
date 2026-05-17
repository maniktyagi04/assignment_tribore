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

  const fetchStats = useCallback(async () => {
    if (!demoId.trim()) return
    setLoading(true)
    setError(null)
    setStats(null)
    try {
      const res = await fetch(`${BACKEND}/demos/${demoId.trim()}/stats`)
      if (res.status === 404) {
        setError('No data found for this demo ID.')
        return
      }
      if (!res.ok) throw new Error('Server error')
      setStats(await res.json())
    } catch {
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
              onClick={fetchStats}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Fetch Stats'}
            </button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </section>

        {/* ── Stats cards ──────────────────────────────────────────────────── */}
        {stats && (
          <>
            <section className="cards-row">
              <StatCard label="Total Views"     value={stats.totalViews}                    />
              <StatCard label="Unique Viewers"  value={stats.uniqueViewers}                 />
              <StatCard label="Avg Completion"  value={stats.avgCompletionPct + '%'}        />
              <StatCard label="Demo ID"         value={stats.demoId} mono                   />
            </section>

            {/* ── Drop-off funnel ──────────────────────────────────────────── */}
            <section className="funnel-section">
              <h2 className="funnel-title">Viewer drop-off funnel</h2>
              <div className="funnel-bars">
                {FUNNEL_STAGES.map(({ key, label }) => {
                  const count = stats.funnel[key] ?? 0
                  return (
                    <div className="funnel-row" key={key}>
                      <span className="funnel-label">{label}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: barWidth(count) }}
                        />
                      </div>
                      <span className="funnel-count">
                        {count} <span className="funnel-pct">({pct(count)})</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!stats && !loading && !error && (
          <div className="empty-state">
            <p>Enter a Demo ID above and click <strong>Fetch Stats</strong> to load analytics.</p>
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
