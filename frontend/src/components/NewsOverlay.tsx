import { useState } from 'react'
import type { NewsItem } from '../types'

interface NewsOverlayProps {
  news: NewsItem[]
  loading: boolean
  onLocateNews?: (item: NewsItem) => void
}

export default function NewsOverlay({ news, loading, onLocateNews }: NewsOverlayProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'info' | 'positive'>('all')

  if (news.length === 0) return null

  const filtered = activeTab === 'all' ? news : news.filter(n => n.impact === activeTab)
  const counts = {
    all: news.length,
    alerts: news.filter(n => n.impact === 'negative').length,
    info: news.filter(n => n.impact === 'info').length,
    positive: news.filter(n => n.impact === 'positive').length,
  }

  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1000, width: 'min(600px, 90vw)',
      background: 'rgba(15, 23, 42, 0.95)', borderRadius: 12,
      border: '1px solid #334155', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderBottom: collapsed ? 'none' : '1px solid #1e293b',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📰</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
            LIVE TRAVEL UPDATES
          </span>
          {loading && <span style={{ fontSize: 14, color: '#60a5fa', animation: 'spin 1s linear infinite' }}>⟳</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!collapsed && (
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {counts.alerts > 0 && <span style={{ color: '#ef4444', marginRight: 4 }}>⚠️{counts.alerts}</span>}
              {counts.positive > 0 && <span style={{ color: '#22c55e' }}>✅{counts.positive}</span>}
            </span>
          )}
          <span style={{ fontSize: 14, color: '#64748b' }}>{collapsed ? '▾' : '▴'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, padding: '4px 8px', borderBottom: '1px solid #1e293b' }}>
            {(['all', 'alerts', 'info', 'positive'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 10, border: 'none',
                  background: activeTab === tab ? '#1e3a5f' : 'transparent',
                  color: activeTab === tab ? '#60a5fa' : '#64748b',
                  borderRadius: 6, cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400,
                }}>
                {tab === 'all' ? 'ALL' : tab === 'alerts' ? `⚠️ ${counts.alerts}` : tab === 'info' ? `ℹ️ ${counts.info}` : `✅ ${counts.positive}`}
              </button>
            ))}
          </div>

          {/* News items */}
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.slice(0, 5).map((item, i) => (
              <div key={i} onClick={() => onLocateNews?.(item)}
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '6px 10px', margin: '2px 6px', borderRadius: 8, cursor: 'pointer',
                  background: item.impact === 'positive' ? 'rgba(34,197,94,0.08)' :
                    item.impact === 'negative' ? 'rgba(239,68,68,0.08)' : 'rgba(96,165,250,0.08)',
                  border: '1px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.impact === 'negative' ? '#ef4444' : '#334155' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
              >
                <span style={{ fontSize: 16, lineHeight: '18px', marginTop: 1 }}>
                  {item.impact === 'positive' ? '✅' : item.impact === 'negative' ? '⚠️' : 'ℹ️'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    {item.title}
                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 400 }}>{item.timestamp}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.description}</div>
                  {item.lat && item.lng && (
                    <span style={{ fontSize: 9, color: '#60a5fa', marginTop: 2, display: 'inline-block' }}>
                      📍 {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
