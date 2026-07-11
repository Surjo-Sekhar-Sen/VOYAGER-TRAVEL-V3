import { useState, useCallback } from 'react'
import type { RouteOption, RoutePlanResponse, UserPreferences, RidePrice, PlaceResult } from '../types'
import { planRoute, getRidePrices, searchPlaces } from '../services/api'
import { getModeIcon, getModeLabel, formatDuration, formatRupees, getScoreColor } from '../utils/helpers'

interface AToBPanelProps {
  sourceLocation: [number, number] | null
  destLocation: [number, number] | null
  onSourceLocationChange: (loc: [number, number] | null) => void
  onDestLocationChange: (loc: [number, number] | null) => void
  onMapCenterChange: (center: [number, number]) => void
  mapRef: React.MutableRefObject<any>
}

export default function AToBPanel({
  sourceLocation,
  destLocation,
  onSourceLocationChange,
  onDestLocationChange,
  onMapCenterChange,
  mapRef,
}: AToBPanelProps) {
  const [sourceQuery, setSourceQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [sourceSuggestions, setSourceSuggestions] = useState<PlaceResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null)
  const [travelMode, setTravelMode] = useState<'public' | 'personal' | 'walking'>('public')
  const [prefs, setPrefs] = useState<UserPreferences>({
    budget: undefined,
    groupSize: 1,
    priority: 'balanced'
  })
  const [insights, setInsights] = useState('')
  const [ridePrices, setRidePrices] = useState<RidePrice[]>([])
  const [ridePricesLoading, setRidePricesLoading] = useState(false)

  let searchTimer: any = null

  const handleSourceQuery = useCallback(async (value: string) => {
    setSourceQuery(value)
    if (value.length < 2) { setSourceSuggestions([]); return }
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      try {
        const data = await searchPlaces(value, 12.97, 77.59)
        setSourceSuggestions((data.results || []).slice(0, 5))
      } catch { setSourceSuggestions([]) }
    }, 300)
  }, [])

  const handleDestQuery = useCallback(async (value: string) => {
    setDestQuery(value)
    if (value.length < 2) { setDestSuggestions([]); return }
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      try {
        const data = await searchPlaces(value, 12.97, 77.59)
        setDestSuggestions((data.results || []).slice(0, 5))
      } catch { setDestSuggestions([]) }
    }, 300)
  }, [])

  const handleSourceSelect = useCallback((place: PlaceResult) => {
    setSourceQuery(place.name)
    onSourceLocationChange([place.lat, place.lng])
    setSourceSuggestions([])
    onMapCenterChange([place.lat, place.lng])
  }, [onSourceLocationChange, onMapCenterChange])

  const handleDestSelect = useCallback((place: PlaceResult) => {
    setDestQuery(place.name)
    onDestLocationChange([place.lat, place.lng])
    setDestSuggestions([])
    onMapCenterChange([place.lat, place.lng])
  }, [onDestLocationChange, onMapCenterChange])

  const handlePlanRoute = useCallback(async () => {
    if (!sourceLocation || !destLocation) return

    setLoading(true)
    setRoutes([])
    setSelectedRoute(null)
    setRidePrices([])
    setRidePricesLoading(true)

    try {
      const mode = travelMode === 'walking' ? 'walking' : travelMode === 'personal' ? 'personal' : 'default'
      const data = await planRoute({
        source_lat: sourceLocation[0],
        source_lng: sourceLocation[1],
        dest_lat: destLocation[0],
        dest_lng: destLocation[1],
        mode,
        budget: prefs.budget,
        group_size: prefs.groupSize,
      })

      setRoutes(data.routes || [])
      setInsights(data.travel_insights || '')

      if (mapRef.current) {
        const bounds = [
          [sourceLocation[0], sourceLocation[1]],
          [destLocation[0], destLocation[1]],
        ]
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      }

      if (sourceQuery && destQuery && travelMode !== 'walking') {
        try {
          const rideData = await getRidePrices(sourceQuery, destQuery)
          setRidePrices(rideData.prices || [])
        } catch { /* ride prices are optional */ }
      }
    } catch (err) {
      console.error('Route planning failed:', err)
    } finally {
      setLoading(false)
      setRidePricesLoading(false)
    }
  }, [sourceLocation, destLocation, sourceQuery, destQuery, travelMode, prefs, mapRef])

  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          onSourceLocationChange(loc)
          setSourceQuery('Current Location')
          onMapCenterChange(loc)
        },
        (err) => {
          console.error('Geolocation error:', err)
          alert('Unable to get your location. Please type a location.')
        }
      )
    }
  }, [onSourceLocationChange, onMapCenterChange])

  return (
    <div>
      <div className="atob-inputs">
        <div className="input-with-icon">
          <span>🟢</span>
          <input
            type="text"
            placeholder="Starting point..."
            value={sourceQuery}
            onChange={(e) => handleSourceQuery(e.target.value)}
          />
          <button
            onClick={handleUseCurrentLocation}
            style={{
              background: 'none', border: 'none', color: '#60a5fa',
              cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap'
            }}
          >
            📍 Current
          </button>
        </div>

        {sourceSuggestions.length > 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {sourceSuggestions.map((place, i) => (
              <div
                key={i}
                className="suggestion-item"
                onClick={() => handleSourceSelect(place)}
              >
                <span>{getModeIcon(place.place_type)}</span> {place.name}
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="input-with-icon">
          <span>🔴</span>
          <input
            type="text"
            placeholder="Destination..."
            value={destQuery}
            onChange={(e) => handleDestQuery(e.target.value)}
          />
        </div>

        {destSuggestions.length > 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {destSuggestions.map((place, i) => (
              <div
                key={i}
                className="suggestion-item"
                onClick={() => handleDestSelect(place)}
              >
                <span>{getModeIcon(place.place_type)}</span> {place.name}
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="preferences-panel">
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>⚙️ TRAVEL PREFERENCES</div>
        <div className="pref-row">
          <span>👥 Group Size</span>
          <input
            type="number" min={1} max={20}
            value={prefs.groupSize}
            onChange={(e) => setPrefs({ ...prefs, groupSize: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="pref-row">
          <span>💰 Budget (₹)</span>
          <input
            type="number" min={0} placeholder="No limit"
            value={prefs.budget || ''}
            onChange={(e) => setPrefs({
              ...prefs, budget: e.target.value ? parseFloat(e.target.value) : undefined
            })}
          />
        </div>
        <div className="pref-row">
          <span>🎯 Priority</span>
          <select value={prefs.priority}
            onChange={(e) => setPrefs({
              ...prefs, priority: e.target.value as UserPreferences['priority']
            })}>
            <option value="balanced">Balanced</option>
            <option value="cost">Lowest Cost</option>
            <option value="time">Fastest</option>
            <option value="comfort">Most Comfortable</option>
          </select>
        </div>
      </div>

      <div className="mode-selector">
        <button
          className={`mode-btn ${travelMode === 'public' ? 'active' : ''}`}
          onClick={() => setTravelMode('public')}
        >
          🚌 Public Transit
        </button>
        <button
          className={`mode-btn ${travelMode === 'personal' ? 'active' : ''}`}
          onClick={() => setTravelMode('personal')}
        >
          🚗 Drive
        </button>
        <button
          className={`mode-btn ${travelMode === 'walking' ? 'active' : ''}`}
          onClick={() => setTravelMode('walking')}
        >
          🚶 Walk
        </button>
      </div>

      <button
        className="go-btn"
        onClick={handlePlanRoute}
        disabled={!sourceLocation || !destLocation || loading}
        style={{ opacity: (!sourceLocation || !destLocation || loading) ? 0.5 : 1 }}
      >
        {loading ? 'Planning Route...' : '🚀 Plan Route'}
      </button>

      {insights && (
        <div className="insights-box">
          🤖 {insights}
        </div>
      )}

      {ridePricesLoading && (
        <div className="loading" style={{ marginTop: 12 }}>Fetching ride prices...</div>
      )}

      {ridePrices.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10, color: '#94a3b8' }}>
            🚗 Ride Price Estimates (Uber/Ola/Rapido)
          </h3>
          {ridePrices.map((rp, i) => (
            <div key={i} style={{
              padding: '8px 10px', marginBottom: 6, background: '#0f172a',
              borderRadius: 8, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>
                  {rp.provider} · {rp.mode.replace('_', ' ')}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  ⏱️ {rp.eta_minutes} min {rp.note ? `· ${rp.note}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>
                ₹{rp.price}
              </div>
            </div>
          ))}
        </div>
      )}

      {routes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10, color: '#94a3b8' }}>
            {routes.length} route options found
          </h3>
          {routes.map((route, i) => (
            <RouteCard
              key={i}
              route={route}
              isSelected={selectedRoute === i}
              onSelect={() => setSelectedRoute(i)}
            />
          ))}
        </div>
      )}

      {!sourceLocation && !destLocation && !loading && (
        <div className="no-data">
          Enter source and destination to plan your route
        </div>
      )}
    </div>
  )
}

function RouteCard({ route, isSelected, onSelect }: {
  route: RouteOption
  isSelected: boolean
  onSelect: () => void
}) {
  const totalMin = route.total_duration_minutes || 1

  return (
    <div className={`route-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="route-header">
        <div className="route-type">
          {getModeIcon(route.type)} {route.type.replace('_', ' ').toUpperCase()}
          {isSelected && <span className="recommended-label">Selected</span>}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(route.overall_score) }}>
          {formatRupees(route.total_fare)}
        </span>
      </div>

      <div className="route-stats">
        <span>⏱️ {formatDuration(route.total_duration_minutes)}</span>
        <span>📏 {route.total_distance_km.toFixed(1)} km</span>
        <span>🚶 {route.total_walking_km.toFixed(2)} km walk</span>
        <span>⭐ Score: {route.overall_score}</span>
      </div>

      <div className="score-bar">
        <div
          className="score-fill"
          style={{
            width: `${route.overall_score}%`,
            background: getScoreColor(route.overall_score)
          }}
        />
      </div>

      {route.legs && route.legs.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
            {route.legs.map((leg, j) => {
              const pct = Math.max(5, (leg.duration_minutes / totalMin) * 100)
              const colors: Record<string, string> = {
                walk: '#94a3b8',
                bus_ordinary: '#3b82f6',
                bus_ac_vajra: '#8b5cf6',
                metro: '#22c55e',
                car: '#f97316',
                cab: '#f59e0b',
              }
              return (
                <div
                  key={j}
                  title={`${getModeLabel(leg.mode)}: ${formatDuration(leg.duration_minutes)}`}
                  style={{
                    width: `${pct}%`,
                    background: colors[leg.mode] || '#64748b',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 8, lineHeight: '10px' }}>{getModeIcon(leg.mode)}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', marginTop: 2 }}>
            <span>{route.legs[0].from.slice(0, 12)}</span>
            <span>{route.legs[route.legs.length - 1].to.slice(0, 12)}</span>
          </div>
        </div>
      )}

      <div className="route-legs">
        {route.legs?.map((leg, j) => (
          <div key={j} className="route-leg">
            <span>{getModeIcon(leg.mode)}</span>
            <span>{getModeLabel(leg.mode)}{leg.line ? ` (${leg.line})` : ''}</span>
            <span>{leg.distance_km > 0 ? `${leg.distance_km.toFixed(1)} km` : ''}</span>
            <span>{formatDuration(leg.duration_minutes)}</span>
            {leg.fare > 0 && <span>{formatRupees(leg.fare)}</span>}
            <span style={{ color: '#94a3b8', fontSize: 11 }}>
              {leg.from.slice(0, 20)} → {leg.to.slice(0, 20)}
            </span>
            {leg.instructions && (
              <span style={{ color: '#64748b', fontSize: 10, fontStyle: 'italic', marginTop: 2 }}>
                💡 {leg.instructions}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}