import { useState } from 'react'
import type { PlaceResult } from '../types'
import { getScoreLabel } from '../utils/helpers'

interface DiscoveryPanelProps {
  place: PlaceResult
  onClose: () => void
}

export default function DiscoveryPanel({ place, onClose }: DiscoveryPanelProps) {
  const score = place.reliability_score || 0.5
  const isGood = score >= 0.7
  const isMid = score >= 0.4 && score < 0.7
  const reviews = place.reviews?.slice(0, 5) || []
  const [imgError, setImgError] = useState(false)

  return (
    <div className="fade-in glass-strong" style={{
      position: 'absolute', top: 16, right: 16, width: 380, maxHeight: 'calc(100vh - 100px)',
      borderRadius: 'var(--radius-xl)', zIndex: 2000, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(198,197,212,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: isGood ? '#16a34a' : isMid ? '#ca8a04' : '#dc2626' }}>discover</span>
        <span className="text-headline-sm" style={{ flex: 1 }}>Discovery Results</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: '50%' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {place.image_url && !imgError && (
          <div style={{ width: '100%', height: 160, overflow: 'hidden', borderRadius: 'var(--radius-lg)', marginBottom: 12 }}>
            <img src={place.image_url} alt={place.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="text-headline-md">{place.name}</span>
            <span className={`reliability-pill ${isGood ? 'good' : isMid ? 'mid' : 'bad'}`} style={{ fontSize: 12, padding: '3px 12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 2 }}>{isGood ? 'verified' : 'warning'}</span>
              {(score * 100).toFixed(0)}%
            </span>
          </div>
          <span className="text-body-sm" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
            {place.place_type.replace(/_/g, ' ')}
          </span>
        </div>

        {place.address && (
          <div className="text-body-md" style={{ color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
            {place.address}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          {place.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b' }}>star</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{place.rating.toFixed(1)}</span>
              <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>rating</span>
            </div>
          )}
          <div className={`reliability-pill ${isGood ? 'good' : isMid ? 'mid' : 'bad'}`}>
            {getScoreLabel(score)}
          </div>
          {place.distance_km !== undefined && (
            <div className="text-body-md" style={{ color: 'var(--text-muted)' }}>
              📍 {place.distance_km} km away
            </div>
          )}
        </div>

        {place.hotel_prices && place.hotel_prices.avg_price > 0 && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 12,
            background: 'var(--primary-fixed)', borderLeft: '3px solid var(--primary)',
          }}>
            <div className="text-headline-sm" style={{ color: 'var(--primary)', marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>payments</span>
              ₹{place.hotel_prices.min_price} - ₹{place.hotel_prices.max_price} / night
            </div>
            <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Avg: ₹{place.hotel_prices.avg_price}</div>
            {place.hotel_prices.brief_summary && (
              <div className="text-body-sm" style={{ marginTop: 4 }}>{place.hotel_prices.brief_summary}</div>
            )}
          </div>
        )}

        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 12,
          background: isGood ? 'var(--secondary-container)' : isMid ? '#fffbeb' : 'var(--error-container)',
          borderLeft: `3px solid ${isGood ? 'var(--secondary)' : isMid ? '#eab308' : 'var(--error)'}`,
        }}>
          <div className="text-body-sm" style={{ fontWeight: 600, marginBottom: 2 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>auto_awesome</span>
            AI Review Summary
          </div>
          <div className="text-body-md">{place.review_summary || 'No reviews available yet.'}</div>
          {place.concerns && (
            <div className="text-body-sm" style={{ color: 'var(--error)', marginTop: 4 }}>
              ⚠️ {place.concerns}
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <div>
            <div className="text-headline-sm" style={{ marginBottom: 8 }}>Recent Reviews</div>
            {reviews.map((rv, idx) => (
              <div key={idx} style={{
                padding: '8px 10px', marginBottom: 6, borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container-low)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{rv.user}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {'⭐'.repeat(Math.min(rv.rating || 3, 5))} {rv.date}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: '#555' }}>"{rv.text}"</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(place.name)}`, '_blank')}
            style={{ flex: 1, padding: '10px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>map</span>
            View on Maps
          </button>
          <button onClick={() => {
            const evt = new CustomEvent('navigate-to-place', { detail: place })
            window.dispatchEvent(evt)
          }}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--primary)', color: 'var(--on-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>directions_transit</span>
            Navigate Here
          </button>
        </div>
      </div>
    </div>
  )
}
