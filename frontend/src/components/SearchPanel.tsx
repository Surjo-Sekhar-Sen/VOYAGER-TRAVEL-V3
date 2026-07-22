import { useState, useCallback, useEffect, useRef } from 'react'
import type { PlaceResult } from '../types'
import { searchPlaces, getNearbyPlaces, getSuggestions } from '../services/api'
import { getPlaceIconName, getPinColor, getScoreLabel } from '../utils/helpers'

interface SearchPanelProps {
  onSelectPlace: (place: PlaceResult) => void
  onNavigateToPlace: (place: PlaceResult) => void
  mapCenter: [number, number]
  userLocation: [number, number] | null
  onSearchResults: (results: PlaceResult[], center?: [number, number]) => void
  onNearbyResults: (results: PlaceResult[]) => void
  onViewOnMap: (place: PlaceResult) => void
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
  onSearchResults, onNearbyResults, onViewOnMap,
  onViewDetails, enrichingName
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
      try { const sugg = await getSuggestions(query); setSuggestions(sugg) }
      catch { setSuggestions([]) }
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
    } catch { setError('Nearby search failed.') }
    finally { setLoading(false) }
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
              <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 6, color: 'var(--text-muted)' }}>location_on</span>
              {s}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="insights-box" style={{ borderLeftColor: 'var(--error)', margin: '8px 0', fontSize: 13 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4, color: 'var(--error)' }}>error</span>
          {error}
        </div>
      )}

      <div className="mode-selector" style={{ marginBottom: 12 }}>
        <button
          className={`mode-btn ${mode === 'search' ? 'active' : ''}`}
          onClick={() => setMode('search')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>search</span>
          Search
        </button>
        <button
          className={`mode-btn ${mode === 'nearby' ? 'active' : ''}`}
          onClick={() => { setMode('nearby'); if (!nearbyResults.length) handleNearby(activeTag) }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>near_me</span>
          Nearby
        </button>
      </div>

      {mode === 'search' && (
        <div>
          {loading && (
            <div className="suggestions-dropdown" style={{ position: 'relative', marginTop: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} className="suggestion-item" style={{ pointerEvents: 'none' }}>
                  <span style={{ display: 'inline-block', width: 16, height: 12, background: 'var(--outline-variant)', borderRadius: 2 }} />
                  <span style={{ display: 'inline-block', width: `${60 + i * 20}px`, height: 12, background: 'var(--outline-variant)', borderRadius: 2, marginLeft: 6 }} />
                </div>
              ))}
              <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)' }}>Searching...</div>
            </div>
          )}

          {results.length > 0 && !loading && (
            <div>
              {results.map((place, i) => (
                <PlaceCard
                  key={i} place={place}
                  onView={() => { onSelectPlace(place); onViewOnMap(place); }}
                  onNavigate={() => onNavigateToPlace(place)}
                  onViewDetails={() => onViewDetails?.(place)}
                  isLoading={enrichingName === place.name}
                />
              ))}
            </div>
          )}

          {results.length === 0 && !loading && !error && (
            <div className="no-data">
              <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, color: 'var(--outline-variant)' }}>search</span>
              {userLocation ? 'Search any place in Bengaluru' : 'Allow location access for better results'}
            </div>
          )}
        </div>
      )}

      {mode === 'nearby' && (
        <div>
          {searchedPlace && (
            <div className="insights-box" style={{ padding: '6px 10px', marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>near_me</span>
              Around: <strong>{searchedPlace.name}</strong>
              <button onClick={() => setSearchedPlace(null)}
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11 }}>
                (Use my location)
              </button>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Radius: {radius} km</span>
              <span>{nearbyResults.length} results</span>
            </div>
            <input type="range" min={0.5} max={10} step={0.5} value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div className="nearby-tags">
            {NEARBY_TAGS.map((tag) => (
              <button key={tag}
                className={`nearby-tag ${activeTag === tag ? 'active' : ''}`}
                onClick={() => handleNearby(tag)}>
                {tag === 'all' ? 'All' : tag.replace('_', ' ')}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ marginTop: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ padding: 12, marginBottom: 8, background: 'var(--surface-container)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, background: 'var(--outline-variant)', borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ display: 'inline-block', width: `${100 + i * 30}px`, height: 14, background: 'var(--outline-variant)', borderRadius: 4 }} />
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

function PlaceCard({ place, onView, onNavigate, onViewDetails, isLoading }: {
  place: PlaceResult
  onView: () => void
  onNavigate: () => void
  onViewDetails?: () => void
  isLoading?: boolean
}) {
  const score = place.reliability_score || 0.5
  const isGood = score > 0.7
  const [imgError, setImgError] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const reviews = place.reviews?.slice(0, 3) || []

  return (
    <div
      className={`place-card${isGood ? ' recommended' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={onView}
    >
      {place.image_url && !imgError && (
        <div style={{ width: '100%', height: 120, overflow: 'hidden', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', marginBottom: 8 }}>
          <img src={place.image_url} alt={place.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)} />
        </div>
      )}

      <div className="place-name">
        <span className="material-symbols-outlined" style={{
          fontSize: 20, color: getPinColor(isGood, score), marginRight: 4
        }}>
          {getPlaceIconName(place.place_type)}
        </span>
        {place.name}
        <span className="place-type-badge">{place.place_type.replace(/_/g, ' ')}</span>
      </div>

      <div className="place-address">
        <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>location_on</span>
        {place.address || place.name}
      </div>

      <div className="place-meta">
        {place.distance_km !== undefined && (
          <span>
            <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>straighten</span>
            {place.distance_km} km
          </span>
        )}
        <span>
          <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>star</span>
          {(place.rating || 0).toFixed(1)}
        </span>
        <span>{((score) * 100).toFixed(0)}% reliable</span>
      </div>

      {place.review_summary && (
        <div className="review-summary">
          <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>rate_review</span>
          {place.review_summary}
        </div>
      )}

      {reviews.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowReviews(!showReviews) }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 500 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>
              {showReviews ? 'expand_less' : 'expand_more'}
            </span>
            {showReviews ? 'Hide' : 'Show'} reviews ({reviews.length})
          </button>
          {showReviews && reviews.map((rv, idx) => (
            <div key={idx} style={{ marginTop: 4, padding: '6px 8px', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 500 }}>{rv.user}</span>
                <span>
                  {Array.from({length: rv.rating}, (_, i) => (
                    <span key={i} className="material-symbols-outlined" style={{ fontSize: 12, color: '#f59e0b' }}>star</span>
                  ))}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>{rv.date}</span>
                </span>
              </div>
              <div style={{ color: 'var(--text)', marginTop: 2, fontStyle: 'italic', fontSize: 11 }}>"{rv.text}"</div>
            </div>
          ))}
        </div>
      )}

      {place.price_info && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#b45309', fontWeight: 500 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>payments</span>
          {place.price_info}
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button className="nearby-tag" onClick={(e) => { e.stopPropagation(); onViewDetails?.() }} disabled={isLoading}>
          {isLoading ? (
            'Loading...'
          ) : (
            <><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>info</span> Details</>
          )}
        </button>
        <button className="nearby-tag" onClick={(e) => { e.stopPropagation(); onNavigate() }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>directions_transit</span>
          Navigate
        </button>
      </div>
    </div>
  )
}
