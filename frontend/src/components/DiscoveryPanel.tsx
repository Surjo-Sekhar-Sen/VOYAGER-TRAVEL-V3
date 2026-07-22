import { useState } from 'react'
import type { PlaceResult } from '../types'

interface Props {
  place: PlaceResult
  onClose: () => void
}

export default function DiscoveryPanel({ place, onClose }: Props) {
  const score = place.reliability_score || 0.5
  const isGood = score > 0.7
  const isWeb = place.review_source === 'web'
  const reviews = place.reviews?.slice(0, 4) || []
  const [imgError, setImgError] = useState(false)

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      width: 340,
      maxHeight: 'calc(100vh - 40px)',
      overflowY: 'auto',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid rgba(198,197,212,0.3)',
      boxShadow: '0 8px 32px rgba(0,6,102,0.15)',
      zIndex: 2000,
      padding: 0,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid var(--outline-variant)'
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--primary)' }}>Place Details</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', width: 28, height: 28,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {place.image_url && !imgError && (
          <div style={{ width: '100%', height: 140, borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12 }}>
            <img src={place.image_url} alt={place.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 24 }}>{isGood ? '🟢' : '🔴'}</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{place.name}</div>
            {place.place_type && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--primary-container)', color: 'var(--primary)',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {place.place_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 80, padding: '8px 10px', background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)', textAlign: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>star</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{(place.rating || 0).toFixed(1)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Rating</div>
          </div>
          <div style={{
            flex: 1, minWidth: 80, padding: '8px 10px', background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)', textAlign: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: isGood ? 'var(--secondary)' : 'var(--error)' }}>verified</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{((score) * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Reliable</div>
          </div>
          {place.distance_km !== undefined && (
            <div style={{
              flex: 1, minWidth: 80, padding: '8px 10px', background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-lg)', textAlign: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>straighten</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{place.distance_km.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>km away</div>
            </div>
          )}
        </div>

        {place.address && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
            <span>{place.address}</span>
          </div>
        )}

        {place.review_summary && (
          <div className="review-summary" style={{ marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }}>rate_review</span>
            {place.review_summary}
          </div>
        )}

        <div className="score-bar" style={{ marginTop: 4, marginBottom: 10 }}>
          <div className="score-fill" style={{
            width: `${score * 100}%`,
            background: isGood ? 'var(--secondary)' : 'var(--error)',
          }} />
        </div>

        {isWeb && (
          <div style={{ fontSize: 11, color: 'var(--secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>public</span>
            Real reviews from web
          </div>
        )}

        {place.price_info && (
          <div style={{
            padding: '8px 10px', background: 'var(--secondary-container)',
            borderRadius: 'var(--radius-lg)', marginBottom: 8,
            fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--secondary)' }}>payments</span>
            {place.price_info}
          </div>
        )}

        {place.hotel_prices && place.hotel_prices.avg_price > 0 && (
          <div style={{
            padding: '8px 10px', background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-lg)', marginBottom: 8, fontSize: 12
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Hotel Price Info</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Avg: ₹{place.hotel_prices.avg_price}/night</span>
              <span>Range: ₹{place.hotel_prices.min_price}-₹{place.hotel_prices.max_price}</span>
            </div>
            {place.hotel_prices.review_score && (
              <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>
                Review Score: {place.hotel_prices.review_score}/10
              </div>
            )}
            {place.hotel_prices.brief_summary && (
              <div style={{ marginTop: 2, fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                "{place.hotel_prices.brief_summary}"
              </div>
            )}
          </div>
        )}

        {reviews.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Reviews</div>
            {reviews.map((rv, idx) => (
              <div key={idx} style={{
                padding: '8px 10px', marginBottom: 6,
                background: 'var(--surface-container-low)',
                borderRadius: 'var(--radius-md)', fontSize: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{rv.user}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {Array.from({length: rv.rating}, (_, i) => (
                      <span key={i} className="material-symbols-outlined" style={{ fontSize: 11, color: '#f59e0b' }}>star</span>
                    ))}
                    <span style={{ marginLeft: 4 }}>{rv.date}</span>
                  </span>
                </div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', lineHeight: 1.4 }}>"{rv.text}"</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
