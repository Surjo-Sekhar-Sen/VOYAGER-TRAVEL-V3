import { useState } from 'react'
import type { PlaceResult } from '../types'

interface DiscoveryPanelProps {
  place: PlaceResult
  onClose: () => void
}

export default function DiscoveryPanel({ place, onClose }: DiscoveryPanelProps) {
  const score = place.reliability_score || 0.5
  const isGood = score > 0.7
  const scorePercent = Math.round(score * 100)
  const [imgError, setImgError] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const hp = place.hotel_prices
  const reviews = place.reviews?.slice(0, 4) || []

  return (
    <div style={{
      position: 'absolute',
      top: 16, right: 16,
      width: 340,
      maxHeight: 'calc(100vh - 40px)',
      overflowY: 'auto',
      background: '#1e293b',
      border: `2px solid ${isGood ? '#22c55e' : '#ef4444'}`,
      borderRadius: 12,
      zIndex: 10000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {place.image_url && !imgError && (
        <div style={{ width: '100%', height: 180, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
          <img
            src={place.image_url}
            alt={place.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div style={{
        padding: '16px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
            {isGood ? '🟢' : '🔴'} {place.name}
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px',
            background: isGood ? '#166534' : '#7f1d1d',
            color: isGood ? '#86efac' : '#fca5a5',
            borderRadius: 4, fontWeight: 600, textTransform: 'uppercase'
          }}>
            {isGood ? '✅ Recommended' : '⚠️ Not Recommended'}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#94a3b8',
          fontSize: 20, cursor: 'pointer', padding: '0 4px'
        }}>✕</button>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>
              {place.rating?.toFixed(1) || '-'}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Rating</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: isGood ? '#22c55e' : '#ef4444' }}>
              {scorePercent}%
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Reliability</div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>📍 ADDRESS</div>
          <div style={{ fontSize: 13, color: '#e2e8f0' }}>{place.address || place.name}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>📂 TYPE</div>
          <span style={{ fontSize: 12, padding: '2px 8px', background: '#334155', borderRadius: 4, color: '#cbd5e1', textTransform: 'capitalize' }}>
            {place.place_type?.replace('_', ' ')}
          </span>
        </div>

        {place.review_summary && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>💬 REVIEW SUMMARY</div>
            <div style={{ fontSize: 13, color: '#e2e8f0', fontStyle: 'italic', padding: 8, background: '#0f172a', borderRadius: 8 }}>
              {place.review_summary}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              📝 REVIEWS ({reviews.length})
              <button onClick={() => setShowReviews(!showReviews)}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11 }}>
                {showReviews ? 'Hide' : 'Show'}
              </button>
            </div>
            {showReviews && reviews.map((rv, i) => (
              <div key={i} style={{ padding: 8, marginBottom: 6, background: '#0f172a', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{rv.user}</span>
                  <span style={{ fontSize: 11 }}>{'⭐'.repeat(rv.rating)} <span style={{ color: '#64748b' }}>{rv.date}</span></span>
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>"{rv.text}"</div>
              </div>
            ))}
          </div>
        )}

        {place.price_info && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>💰 PRICE INFO</div>
            <div style={{ fontSize: 13, color: '#fbbf24', padding: 8, background: '#0f172a', borderRadius: 8 }}>
              {place.price_info}
            </div>
          </div>
        )}

        {hp && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>🏨 HOTEL PRICES</div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Avg/Night</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>₹{hp.avg_price}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Range</span>
                <span style={{ fontSize: 13, color: '#e2e8f0' }}>₹{hp.min_price} - ₹{hp.max_price}</span>
              </div>
              {hp.review_score && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Review Score</span>
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>⭐ {hp.review_score}/5</span>
                </div>
              )}
              {hp.brief_summary && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                  {hp.brief_summary}
                </div>
              )}
            </div>
          </div>
        )}

        {place.distance_km !== undefined && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>📏 DISTANCE</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{place.distance_km} km away</div>
          </div>
        )}

        <div style={{
          width: '100%', height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginTop: 8
        }}>
          <div style={{
            width: `${scorePercent}%`, height: '100%',
            background: isGood ? '#22c55e' : '#ef4444',
            borderRadius: 3, transition: 'width 0.5s'
          }} />
        </div>

        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
          Reliability Score: {scorePercent}/100
        </div>
      </div>
    </div>
  )
}
