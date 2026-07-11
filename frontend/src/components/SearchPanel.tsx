import { useState, useCallback, useEffect, useRef } from 'react'
import type { PlaceResult } from '../types'
import { searchPlaces, getNearbyPlaces, getSuggestions } from '../services/api'

interface SearchPanelProps {
  onSelectPlace: (place: PlaceResult) => void
  onNavigateToPlace: (place: PlaceResult) => void
  mapCenter: [number, number]
  userLocation: [number, number] | null
  onSearchResults: (results: PlaceResult[], center?: [number, number]) => void
  onNearbyResults: (results: PlaceResult[]) => void
  onViewOnMap: (place: PlaceResult) => void
  onNearbyAroundPlace: (place: PlaceResult) => void
  onMapCenterChange?: (center: [number, number]) => void
  onViewDetails?: (place: PlaceResult) => void
  enrichingName?: string | null
}

const NEARBY_TAGS = [
  'all', 'mall', 'hospital', 'restaurant', 'hotel', 'lodge',
  'temple', 'mosque', 'school', 'park', 'atm', 'bank', 'petrol_pump',
  'charging_station', 'bus_stop', 'metro_station', 'airport',
  'railway_station', 'police', 'cafe', 'pharmacy', 'supermarket',
  'gym', 'cinema', 'clinic', 'church'
]

export default function SearchPanel({
  onSelectPlace, onNavigateToPlace, mapCenter, userLocation,
  onSearchResults, onNearbyResults, onViewOnMap, onNearbyAroundPlace,
  onMapCenterChange, onViewDetails, enrichingName
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [radius, setRadius] = useState(2)
  const [activeTag, setActiveTag] = useState('all')
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([])
  const [mode, setMode] = useState<'search' | 'nearby'>('search')
  const [searchedPlace, setSearchedPlace] = useState<PlaceResult | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    if (searchAbortRef.current) searchAbortRef.current.abort()
    const ctrl = new AbortController()
    searchAbortRef.current = ctrl
    setLoading(true)
    setError('')
    try {
      const lat = userLocation ? userLocation[0] : mapCenter[0]
      const lng = userLocation ? userLocation[1] : mapCenter[1]
      const data = await searchPlaces(q, lat, lng, ctrl.signal)
      if (ctrl.signal.aborted) return
      const places = data.results || []
      setResults(places)
      setSuggestions([])
      onSearchResults(places, mapCenter)

      if (places.length === 0) {
        setError(`No results found for "${q}". Try a different search term.`)
      } else {
        setSearchedPlace(places[0])
        onSelectPlace(places[0])
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [query, mapCenter, userLocation, onSelectPlace, onSearchResults])

  useEffect(() => {
    if (!query || query.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const sugg = await getSuggestions(query)
        setSuggestions(sugg)
      } catch { setSuggestions([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion)
    setSuggestions([])
  }, [])

  const handleNearby = useCallback(async (tag: string) => {
    setActiveTag(tag)
    setLoading(true)
    setError('')
    try {
      const centerLat = searchedPlace ? searchedPlace.lat : (userLocation ? userLocation[0] : mapCenter[0])
      const centerLng = searchedPlace ? searchedPlace.lng : (userLocation ? userLocation[1] : mapCenter[1])
      const data = await getNearbyPlaces(centerLat, centerLng, radius, tag === 'all' ? undefined : tag)
      const places = data.results || []
      setNearbyResults(places)
      onNearbyResults(places)

      if (places.length === 0) {
        setError(`No ${tag} found within ${radius}km. Try increasing radius.`)
      }
    } catch (err) {
      setError('Nearby search failed.')
    } finally {
      setLoading(false)
    }
  }, [radius, searchedPlace, userLocation, mapCenter, onNearbyResults])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  return (
    <div>
      <div className="search-input-group">
        <input
          className="search-input"
          type="text"
          placeholder="Search any place in Bengaluru..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((s, i) => (
            <div key={i} className="suggestion-item" onClick={() => handleSuggestionClick(s)}>
              {s}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: 10, margin: '8px 0', background: '#2d1b1b', borderRadius: 8, border: '1px solid #ef4444', fontSize: 13, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`mode-btn ${mode === 'search' ? 'active' : ''}`}
          onClick={() => setMode('search')}
        >
          🔍 Search Specific
        </button>
        <button
          className={`mode-btn ${mode === 'nearby' ? 'active' : ''}`}
          onClick={() => { setMode('nearby'); if (!nearbyResults.length) handleNearby(activeTag) }}
        >
          📍 Nearby
        </button>
      </div>

      {mode === 'search' && (
        <div>
          {loading && (
          <div className="suggestions-dropdown" style={{ position: 'relative', marginTop: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} className="suggestion-item" style={{ pointerEvents: 'none' }}>
                <span style={{ display: 'inline-block', width: 16, height: 12, background: '#334155', borderRadius: 2 }} />
                <span style={{ display: 'inline-block', width: `${60 + i * 20}px`, height: 12, background: '#334155', borderRadius: 2, marginLeft: 6 }} />
              </div>
            ))}
            <div style={{ padding: '4px 8px', fontSize: 10, color: '#64748b' }}>Searching...</div>
          </div>
        )}

          {results.length > 0 && !loading && (
            <div>
              {searchedPlace && (
                <div onClick={() => { setMode('nearby'); handleNearby(activeTag) }}
                  style={{ padding: 8, marginBottom: 10, background: '#1e3a5f', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12 }}>
                  📍 Search nearby around "{searchedPlace.name}" →
                </div>
              )}
              {results.map((place, i) => (
                <PlaceCard
                  key={i} place={place}
                  onView={() => { onSelectPlace(place); onViewOnMap(place); }}
                  onNavigate={() => onNavigateToPlace(place)}
                  onNearbyHere={() => { setSearchedPlace(place); setMode('nearby'); handleNearby(activeTag); }}
                  onViewDetails={() => onViewDetails?.(place)}
                  isLoading={enrichingName === place.name}
                />
              ))}
            </div>
          )}

          {results.length === 0 && !loading && !error && (
            <div className="no-data">
              {userLocation ? '🔍 Search any place in Bengaluru' : '📍 Allow location access for better results'}
            </div>
          )}
        </div>
      )}

      {mode === 'nearby' && (
        <div>
          {searchedPlace && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, padding: '4px 8px', background: '#1e293b', borderRadius: 6 }}>
              📍 Around: <strong>{searchedPlace.name}</strong>
              <button onClick={() => setSearchedPlace(null)}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11 }}>
                (Use my location)
              </button>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              <span>Radius: {radius} km</span>
              <span>{nearbyResults.length} results</span>
            </div>
            <input
              type="range" min={0.5} max={10} step={0.5}
              value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="nearby-options">
            {NEARBY_TAGS.map((tag) => (
              <button
                key={tag}
                className={`nearby-tag ${activeTag === tag ? 'active' : ''}`}
                onClick={() => handleNearby(tag)}
              >
                {tag === 'all' ? 'All' : tag.replace('_', ' ')}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ marginTop: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ padding: 12, marginBottom: 8, background: '#1e293b', borderRadius: 8, pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, background: '#334155', borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ display: 'inline-block', width: `${100 + i * 30}px`, height: 14, background: '#334155', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginTop: 6, width: '70%', height: 10, background: '#334155', borderRadius: 4 }} />
                  <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                    <span style={{ width: 50, height: 10, background: '#334155', borderRadius: 4, display: 'inline-block' }} />
                    <span style={{ width: 60, height: 10, background: '#334155', borderRadius: 4, display: 'inline-block' }} />
                    <span style={{ width: 70, height: 10, background: '#334155', borderRadius: 4, display: 'inline-block' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {nearbyResults.map((place, i) => (
              <PlaceCard
                key={i} place={place}
                onView={() => { onSelectPlace(place); onViewOnMap(place); }}
                onNavigate={() => onNavigateToPlace(place)}
                onNearbyHere={() => { setSearchedPlace(place); }}
                onViewDetails={() => onViewDetails?.(place)}
                isLoading={enrichingName === place.name}
              />
            ))}
            {nearbyResults.length === 0 && !loading && !error && (
              <div className="no-data">Click a tag above to find nearby places</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PlaceCard({ place, onView, onNavigate, onNearbyHere, onViewDetails, isLoading }: {
  place: PlaceResult
  onView: () => void
  onNavigate: () => void
  onNearbyHere: () => void
  onViewDetails?: () => void
  isLoading?: boolean
}) {
  const score = place.reliability_score || 0.5
  const isGood = score > 0.7
  const borderColor = isGood ? '#22c55e' : '#ef4444'
  const bgColor = isGood ? '#0f2d1a' : '#2d1b1b'
  const [imgError, setImgError] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const reviews = place.reviews?.slice(0, 3) || []

  return (
    <div
      className="place-card"
      style={{ borderColor, background: bgColor, cursor: 'pointer' }}
      onClick={onView}
    >
      {place.image_url && !imgError && (
        <div style={{ width: '100%', height: 120, overflow: 'hidden', borderRadius: '6px 6px 0 0', marginBottom: 8 }}>
          <img
            src={place.image_url}
            alt={place.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="place-name">
        <span style={{ fontSize: 18 }}>{isGood ? '🟢' : '🔴'}</span>
        {place.name}
        <span className="place-type-badge">{place.place_type}</span>
      </div>

      <div className="place-address">{place.address || place.name}</div>

      <div className="place-meta">
        {place.distance_km !== undefined && (
          <span>📏 {place.distance_km} km</span>
        )}
        <span>⭐ {(place.rating || 0).toFixed(1)}</span>
        <span>✅ {((score) * 100).toFixed(0)}% reliable</span>
      </div>

      {place.review_summary && (
        <div className="review-summary">💬 {place.review_summary}</div>
      )}

      {reviews.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowReviews(!showReviews) }}
            style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            📝 {showReviews ? 'Hide' : 'Show'} reviews ({reviews.length})
          </button>
          {showReviews && reviews.map((rv, idx) => (
            <div key={idx} style={{ marginTop: 4, padding: '4px 6px', background: '#0f172a', borderRadius: 6, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>{rv.user}</span>
                <span>{'⭐'.repeat(rv.rating)} <span style={{ color: '#64748b' }}>{rv.date}</span></span>
              </div>
              <div style={{ color: '#cbd5e1', marginTop: 2, fontStyle: 'italic' }}>"{rv.text}"</div>
            </div>
          ))}
        </div>
      )}

      {place.price_info && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#fbbf24' }}>
          💰 {place.price_info}
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="nearby-tag" onClick={(e) => { e.stopPropagation(); onViewDetails?.() }} disabled={isLoading}>
          {isLoading ? '⏳ Loading...' : '🔍 View Details'}
        </button>
        <button className="nearby-tag" onClick={(e) => { e.stopPropagation(); onNavigate() }}>
          🗺️ Navigate
        </button>
        <button className="nearby-tag" onClick={(e) => { e.stopPropagation(); onNearbyHere() }}>
          📍 Nearby here
        </button>
      </div>
    </div>
  )
}
