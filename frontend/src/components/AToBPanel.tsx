import { useState, useCallback, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import type { PlaceResult, RouteOption, RouteLeg, MapRouteGeometry, RidePrice, NewsItem } from '../types'
import { searchPlaces, getSuggestions, planRoute, getRidePrices } from '../services/api'
import { getModeLabel, formatDuration, formatRupees, getScoreColor } from '../utils/helpers'

interface AToBPanelProps {
  onRouteGeometry: (geo: MapRouteGeometry[] | null) => void
  onNewsUpdate: (news: NewsItem[]) => void
}

type SubMode = 'transport' | 'drive' | 'walk'
type TransportType = 'direct' | 'segment'

export default function AToBPanel({ onRouteGeometry, onNewsUpdate }: AToBPanelProps) {
  const {
    sourceLocation, setSourceLocation, destLocation, setDestLocation,
    sourceQuery, setSourceQuery, destQuery, setDestQuery,
    groupSize, setGroupSize, budget, setBudget,
    mapRef, startJourney,
  } = useApp()

  const [sourceSuggestions, setSourceSuggestions] = useState<string[]>([])
  const [destSuggestions, setDestSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subMode, setSubMode] = useState<SubMode>('transport')
  const [transportType, setTransportType] = useState<TransportType>('segment')
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null)
  const [ridePrices, setRidePrices] = useState<RidePrice[]>([])
  const [showPrices, setShowPrices] = useState(false)
  const [expandedLegs, setExpandedLegs] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!sourceQuery || sourceQuery.length < 2) { setSourceSuggestions([]); return }
    const t = setTimeout(async () => {
      try { setSourceSuggestions(await getSuggestions(sourceQuery)) }
      catch { setSourceSuggestions([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [sourceQuery])

  useEffect(() => {
    if (!destQuery || destQuery.length < 2) { setDestSuggestions([]); return }
    const t = setTimeout(async () => {
      try { setDestSuggestions(await getSuggestions(destQuery)) }
      catch { setDestSuggestions([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [destQuery])

  const pickSource = useCallback(async (q: string) => {
    setSourceQuery(q); setSourceSuggestions([])
    const data = await searchPlaces(q, 12.9716, 77.5946)
    if (data.results?.[0]) setSourceLocation([data.results[0].lat, data.results[0].lng])
  }, [setSourceLocation, setSourceQuery])

  const pickDest = useCallback(async (q: string) => {
    setDestQuery(q); setDestSuggestions([])
    const data = await searchPlaces(q, 12.9716, 77.5946)
    if (data.results?.[0]) {
      setDestLocation([data.results[0].lat, data.results[0].lng])
      if (mapRef.current) mapRef.current.flyTo([data.results[0].lat, data.results[0].lng], 13)
    }
  }, [setDestLocation, setDestQuery, mapRef])

  const handleFindRoutes = useCallback(async () => {
    if (!sourceLocation || !destLocation) { setError('Please set both source and destination'); return }
    setLoading(true); setError(''); setRoutes([]); setSelectedRouteIdx(null)
    onRouteGeometry(null)
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      if (subMode === 'drive') {
        const data = await planRoute({
          source_lat: sourceLocation[0], source_lng: sourceLocation[1],
          dest_lat: destLocation[0], dest_lng: destLocation[1],
          mode: 'personal', group_size: groupSize, budget: budget,
        })
        if (ctrl.signal.aborted) return
        if (data?.routes) setRoutes(data.routes)
      } else if (subMode === 'walk') {
        const data = await planRoute({
          source_lat: sourceLocation[0], source_lng: sourceLocation[1],
          dest_lat: destLocation[0], dest_lng: destLocation[1],
          mode: 'walking', group_size: groupSize, budget: budget,
        })
        if (ctrl.signal.aborted) return
        if (data?.routes) setRoutes(data.routes)
      } else {
        const data = await planRoute({
          source_lat: sourceLocation[0], source_lng: sourceLocation[1],
          dest_lat: destLocation[0], dest_lng: destLocation[1],
          mode: 'public', group_size: groupSize, budget: budget,
        })
        if (ctrl.signal.aborted) return
        if (data?.routes) setRoutes(data.routes || [])
        if (data?.weather) {
          try {
            const prices = await getRidePrices(sourceQuery || 'Source', destQuery || 'Destination')
            if (!ctrl.signal.aborted && prices?.prices) setRidePrices(prices.prices)
          } catch {}
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setError('Failed to find routes. Please try again.')
    } finally { if (!ctrl.signal.aborted) setLoading(false) }
  }, [sourceLocation, destLocation, subMode, groupSize, budget, sourceQuery, destQuery, onRouteGeometry])

  useEffect(() => {
    if (selectedRouteIdx === null || !routes[selectedRouteIdx]) {
      onRouteGeometry(null); return
    }
    const route = routes[selectedRouteIdx]
    const geo: MapRouteGeometry[] = []
    if (route.geometry?.coordinates) {
      geo.push({
        type: 'route', color: '#3b82f6', weight: 5,
        coordinates: route.geometry.coordinates.map((c: any) => [c[1], c[0]]),
      })
    }
    route.legs?.forEach((leg, i) => {
      if (leg.path && leg.path.length > 0) {
        geo.push({
          type: 'segment', color: leg.mode === 'walk' ? '#22c55e' : '#3b82f6',
          weight: leg.mode === 'walk' ? 3 : 4,
          dashArray: leg.mode === 'walk' ? '8, 4' : undefined,
          coordinates: leg.path as [number, number][],
          label: `${leg.from} → ${leg.to}`,
        })
      }
    })
    onRouteGeometry(geo)
  }, [selectedRouteIdx, routes, onRouteGeometry])

  const swapLocations = useCallback(() => {
    setSourceQuery(destQuery); setDestQuery(sourceQuery)
    setSourceLocation(destLocation); setDestLocation(sourceLocation)
  }, [sourceQuery, destQuery, sourceLocation, destLocation, setSourceQuery, setDestQuery, setSourceLocation, setDestLocation])

  const getTopRoutes = () => {
    const sorted = [...routes].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
    return { top5: sorted.slice(0, 5), all: sorted }
  }

  const { top5, all } = getTopRoutes()

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 6, borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#22c55e' }}>my_location</span>
            <input type="text" placeholder="Current Location..."
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--text)' }}
            />
            {sourceQuery && (
              <button onClick={() => { setSourceQuery(''); setSourceLocation(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
          {sourceSuggestions.length > 0 && (
            <div className="glass" style={{ position: 'absolute', left: 0, right: 0, top: 48, zIndex: 100, borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px var(--shadow-primary)', maxHeight: 160, overflowY: 'auto' }}>
              {sourceSuggestions.map((s, i) => (
                <div key={i} onClick={() => pickSource(s)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < sourceSuggestions.length - 1 ? '1px solid var(--outline-variant)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>location_on</span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ef4444' }}>location_on</span>
            <input type="text" placeholder="Where to?"
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--text)' }}
            />
            {destQuery && (
              <button onClick={() => { setDestQuery(''); setDestLocation(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
          <button onClick={swapLocations}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--outline-variant)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>swap_vert</span>
          </button>
        </div>
        {destSuggestions.length > 0 && (
          <div className="glass" style={{ position: 'absolute', left: 16, right: 60, zIndex: 100, borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px var(--shadow-primary)', maxHeight: 160, overflowY: 'auto' }}>
            {destSuggestions.map((s, i) => (
              <div key={i} onClick={() => pickDest(s)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: i < destSuggestions.length - 1 ? '1px solid var(--outline-variant)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>location_on</span>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mode-selector" style={{ marginBottom: 10 }}>
        {([
          { key: 'transport', icon: 'directions_transit', label: 'Public / Online' },
          { key: 'drive', icon: 'directions_car', label: 'Drive' },
          { key: 'walk', icon: 'directions_walk', label: 'Walk' },
        ] as { key: SubMode; icon: string; label: string }[]).map(m => (
          <button key={m.key}
            onClick={() => setSubMode(m.key)}
            className={`mode-btn${subMode === m.key ? ' active' : ''}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {subMode === 'transport' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {([
            { key: 'segment', icon: 'layers', label: 'Multi-Hop Transit' },
            { key: 'direct', icon: 'local_taxi', label: 'Direct Ride' },
          ] as { key: TransportType; icon: string; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTransportType(t.key)}
              className={`mode-btn${transportType === t.key ? ' active' : ''}`}
              style={{ fontSize: 12, padding: '8px 10px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="preferences-panel">
        <div className="pref-row">
          <span><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>group</span> Group Size</span>
          <input type="number" min={1} max={20} value={groupSize}
            onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value) || 1))} />
        </div>
        <div className="pref-row">
          <span><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>payments</span> Budget (₹)</span>
          <input type="number" min={0} placeholder="No limit" value={budget || ''}
            onChange={(e) => setBudget(e.target.value ? parseInt(e.target.value) : undefined)} />
        </div>
      </div>

      <button onClick={handleFindRoutes} disabled={loading || !sourceLocation || !destLocation} className="go-btn">
        {loading ? (
          <span>Finding routes<span className="loading">...</span></span>
        ) : (
          <><span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>route</span> Find Routes</>
        )}
      </button>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--error-container)', color: 'var(--error)', fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      {transportType === 'direct' && subMode === 'transport' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>local_taxi</span>
            <span className="text-headline-sm">Ride Options</span>
            <button onClick={() => setShowPrices(!showPrices)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12 }}>
              {showPrices ? 'Hide' : 'Show prices'}
            </button>
          </div>
          {showPrices && ridePrices.length > 0 && ridePrices.map((p, i) => (
            <div key={i} className="scale-in" style={{
              padding: '10px 14px', marginBottom: 6, borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)', border: '1px solid var(--outline-variant)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.provider}</span>
                  <span className="text-body-sm" style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{p.mode}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>₹{p.price}</div>
              </div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                ETA: {p.eta_minutes} min {p.note ? `• ${p.note}` : ''}
              </div>
            </div>
          ))}
          {showPrices && ridePrices.length === 0 && (
            <div className="text-body-md" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
              Click "Find Routes" to see ride prices
            </div>
          )}
        </div>
      )}

      {top5.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>route</span>
            <span className="text-headline-sm">{subMode === 'transport' ? 'Recommended Routes' : subMode === 'drive' ? 'Driving Options' : 'Walking Routes'}</span>
          </div>

          {top5.map((route, idx) => {
            const isBest = idx === 0
            const isSelected = selectedRouteIdx === all.indexOf(route)
            return (
              <div key={idx} onClick={() => setSelectedRouteIdx(all.indexOf(route))}
                className={`route-card${isSelected ? ' selected' : ''}`} style={{
                  borderLeft: `4px solid ${getScoreColor(route.overall_score)}`,
                  padding: 12, marginBottom: 8,
                }}>
                {isBest && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <span className="badge-best">Best Match</span>
                    <span className="reliability-pill" style={{ background: getScoreColor(route.overall_score), color: 'white' }}>
                      Score: {route.overall_score}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="text-headline-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 4 }}>
                      {route.type === 'car' || route.type === 'drive' ? 'directions_car' :
                       route.type === 'walk' ? 'directions_walk' : 'directions_transit'}
                    </span>
                    {route.provider || getModeLabel(route.type)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{formatRupees(route.total_fare)}</span>
                </div>

                <div className="route-stats">
                  <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>schedule</span> {formatDuration(route.total_duration_minutes)}</span>
                  <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>straighten</span> {route.total_distance_km} km</span>
                  {route.total_walking_km > 0 && <span>🚶 {route.total_walking_km} km walk</span>}
                  {route.route_numbers?.length ? <span>🚌 {route.route_numbers.join(', ')}</span> : null}
                </div>

                <div className="score-bar" style={{ marginTop: 6, height: 5, borderRadius: 3 }}>
                  <div className="score-fill" style={{ width: `${route.overall_score}%`, background: getScoreColor(route.overall_score) }} />
                </div>

                {route.score_explanation && (
                  <div className="text-body-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    {route.score_explanation}
                  </div>
                )}

                <button onClick={(e) => { e.stopPropagation(); setExpandedLegs(expandedLegs === all.indexOf(route) ? null : all.indexOf(route)) }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, marginTop: 4, padding: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>{expandedLegs === all.indexOf(route) ? 'expand_less' : 'expand_more'}</span>
                  {expandedLegs === all.indexOf(route) ? 'Hide' : 'Show'} details
                </button>

                {expandedLegs === all.indexOf(route) && route.legs?.map((leg, li) => (
                  <div key={li} style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.5)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        {leg.mode === 'walk' ? 'directions_walk' : leg.mode === 'car' || leg.mode === 'drive' ? 'directions_car' : 'directions_bus'}
                      </span>
                      <span style={{ fontWeight: 500 }}>{leg.from}</span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ fontWeight: 500 }}>{leg.to}</span>
                    </div>
                    <div className="text-body-sm" style={{ color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12 }}>
                      <span>{formatDuration(leg.duration_minutes)}</span>
                      <span>{leg.distance_km} km</span>
                      <span>₹{leg.fare}</span>
                    </div>
                    {leg.instructions && (
                      <div className="text-body-sm" style={{ fontStyle: 'italic', marginTop: 2 }}>{leg.instructions}</div>
                    )}
                    {leg.route_numbers && leg.route_numbers.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {leg.route_numbers.map((rn, ri) => (
                          <span key={ri} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--primary-container)', color: 'var(--primary)', fontWeight: 600 }}>
                            {rn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isSelected && (
                  <button onClick={(e) => { e.stopPropagation(); startJourney() }}
                    style={{
                      width: '100%', padding: '10px', marginTop: 8, border: 'none',
                      borderRadius: 'var(--radius-md)', background: 'var(--secondary)',
                      color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                    Start Journey
                  </button>
                )}
              </div>
            )
          })}

          {all.length > 5 && (
            <details style={{ marginTop: 4 }}>
              <summary>Show all {all.length} options</summary>
              {all.slice(5).map((route, idx) => {
                const isSelected = selectedRouteIdx === idx + 5
                return (
                  <div key={idx + 5} onClick={() => setSelectedRouteIdx(idx + 5)}
                    className={`route-card${isSelected ? ' selected' : ''}`}
                    style={{ borderLeft: `3px solid ${getScoreColor(route.overall_score)}`, padding: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {route.provider || getModeLabel(route.type)}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>{formatRupees(route.total_fare)}</span>
                    </div>
                    <div className="route-stats">
                      <span>{formatDuration(route.total_duration_minutes)}</span>
                      <span>{route.total_distance_km} km</span>
                    </div>
                    <div className="score-bar" style={{ marginTop: 4 }}>
                      <div className="score-fill" style={{ width: `${route.overall_score}%`, background: getScoreColor(route.overall_score) }} />
                    </div>
                  </div>
                )
              })}
            </details>
          )}
        </div>
      )}
    </div>
  )
}
