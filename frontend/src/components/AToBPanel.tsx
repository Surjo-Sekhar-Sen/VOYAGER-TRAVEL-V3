import { useState, useCallback, useEffect, useRef } from 'react'
import type { RouteOption, RidePrice, PlaceResult, RouteLeg, MiniPathOptions, MiniPathTransitOption, BuiltRoute, MiniPathSegment, NewsItem, MapRouteGeometry } from '../types'
import { planRoute, getRidePrices, searchPlaces, getMiniPathOptions } from '../services/api'
import { getModeIcon, getModeLabel, formatDuration, formatRupees, getScoreColor, getScoreLabel } from '../utils/helpers'

interface AToBPanelProps {
  sourceLocation: [number, number] | null
  destLocation: [number, number] | null
  onSourceLocationChange: (loc: [number, number] | null) => void
  onDestLocationChange: (loc: [number, number] | null) => void
  onMapCenterChange: (center: [number, number]) => void
  mapRef: React.MutableRefObject<any>
  onRouteGeometry: (geometry: MapRouteGeometry[]) => void
  onNewsUpdate: (news: NewsItem[]) => void
  onWaypointsChange?: (waypoints: { lat: number; lng: number; query: string }[]) => void
}

const SEGMENT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

type RouterView = 'direct' | 'segment'

export default function AToBPanel({
  sourceLocation, destLocation, onSourceLocationChange, onDestLocationChange, onMapCenterChange, mapRef, onRouteGeometry, onNewsUpdate,
  onWaypointsChange,
}: AToBPanelProps) {
  const [sourceQuery, setSourceQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [sourceSuggestions, setSourceSuggestions] = useState<PlaceResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [destLoading, setDestLoading] = useState(false)
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number; query: string }[]>([])
  const [wpSuggestions, setWpSuggestions] = useState<{ idx: number; items: PlaceResult[] } | null>(null)
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null)
  const [travelMode, setTravelMode] = useState<'public' | 'personal' | 'walking'>('public')
  const [routerView, setRouterView] = useState<RouterView>('direct')
  const [prefs, setPrefs] = useState({ budget: undefined as number | undefined, groupSize: 1 })
  const [insights, setInsights] = useState('')
  const [ridePrices, setRidePrices] = useState<RidePrice[]>([])
  const [ridePricesLoading, setRidePricesLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)

  // Mini-path state
  const [miniPathOptions, setMiniPathOptions] = useState<MiniPathOptions | null>(null)
  const [buildingRoute, setBuildingRoute] = useState<MiniPathSegment[]>([])
  const [activeSegment, setActiveSegment] = useState<number>(0)
  const [showPathBuilder, setShowPathBuilder] = useState(false)
  const [hoveredSegmentOption, setHoveredSegmentOption] = useState<MiniPathTransitOption | null>(null)

  const planRef = useRef<() => void>(() => {})
  const prevSrcRef = useRef('')
  const prevDstRef = useRef('')
  const prevWpRef = useRef('')
  const srcAbortRef = useRef<AbortController | null>(null)
  const dstAbortRef = useRef<AbortController | null>(null)
  const wpAbortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-fetch: always fetch when source/dest/waypoints change
  useEffect(() => {
    if (sourceLocation && destLocation) {
      const srcKey = `${sourceLocation[0].toFixed(4)},${sourceLocation[1].toFixed(4)}`
      const dstKey = `${destLocation[0].toFixed(4)},${destLocation[1].toFixed(4)}`
      const wpKey = waypoints.filter(w => w.lat !== 0).map(w => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join('|')
      if (srcKey !== prevSrcRef.current || dstKey !== prevDstRef.current || wpKey !== prevWpRef.current) {
        prevSrcRef.current = srcKey
        prevDstRef.current = dstKey
        prevWpRef.current = wpKey
        planRef.current()
      }
    }
  }, [sourceLocation, destLocation, waypoints])

  // Re-fetch when mode/prefs change
  useEffect(() => {
    if (sourceLocation && destLocation) {
      planRef.current()
    }
  }, [travelMode, prefs.groupSize, prefs.budget, sourceLocation, destLocation, waypoints])

  // Switch between direct/segment views
  useEffect(() => {
    if (routerView === 'segment' && sourceLocation && destLocation && !miniPathOptions) {
      fetchMiniPath()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerView, sourceLocation, destLocation, waypoints])

  // Emit waypoint locations to parent for map markers
  useEffect(() => {
    onWaypointsChange?.(waypoints.filter(w => w.lat !== 0))
  }, [waypoints, onWaypointsChange])

  // News: only fetch after routes are loaded (settled query), then every 30s
  const newsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startNewsFetch = useCallback(async () => {
    if (!sourceQuery && !destQuery) return
    try {
      const src = encodeURIComponent(sourceQuery || 'Current Location')
      const dst = encodeURIComponent(destQuery || 'Destination')
      const resp = await fetch(`/api/routes/news?source_name=${src}&dest_name=${dst}`)
      const data = await resp.json()
      if (data.news) onNewsUpdate(data.news.slice(0, 6))
    } catch { /* ignore */ }
    if (!newsIntervalRef.current) {
      newsIntervalRef.current = setInterval(async () => {
        try {
          const src = encodeURIComponent(sourceQuery || 'Current Location')
          const dst = encodeURIComponent(destQuery || 'Destination')
          const resp = await fetch(`/api/routes/news?source_name=${src}&dest_name=${dst}`)
          const data = await resp.json()
          if (data.news) onNewsUpdate(data.news.slice(0, 6))
        } catch { /* ignore */ }
      }, 30000)
    }
  }, [sourceQuery, destQuery, onNewsUpdate])

  useEffect(() => {
    return () => { if (newsIntervalRef.current) clearInterval(newsIntervalRef.current) }
  }, [])

  // Emit route geometry
  useEffect(() => {
    const geo: MapRouteGeometry[] = []

    if (selectedRoute !== null && sourceLocation && destLocation && routes[selectedRoute]) {
      const route = routes[selectedRoute]
      if (route.geometry?.coordinates?.length > 0) {
        geo.push({
          type: 'route',
          coordinates: route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
          color: '#3b82f6', weight: 5, label: route.type,
        })
      } else if (route.legs?.length > 0) {
        // Build continuous path from leg coordinates
        const pathCoords: [number, number][] = []
        route.legs.forEach((leg) => {
          const lat = (leg as any).from_lat
          const lng = (leg as any).from_lng
          if (lat && lng) pathCoords.push([lat, lng])
        })
        const lastLeg = route.legs[route.legs.length - 1]
        const tLat = (lastLeg as any).to_lat
        const tLng = (lastLeg as any).to_lng
        if (tLat && tLng) pathCoords.push([tLat, tLng])
        if (pathCoords.length >= 2) {
          geo.push({ type: 'route', coordinates: pathCoords, color: '#3b82f6', weight: 5, label: route.type })
        } else {
          geo.push({ type: 'route', coordinates: [sourceLocation, destLocation], color: '#3b82f6', weight: 5, dashArray: '10, 6', label: route.type })
        }
      } else {
        geo.push({
          type: 'route', coordinates: [sourceLocation, destLocation],
          color: '#3b82f6', weight: 5, dashArray: '10, 6', label: route.type,
        })
      }

      const modeColors: Record<string, string> = {
        walk: '#94a3b8', walk_to_bus: '#94a3b8', walk_to_metro: '#94a3b8',
        walk_from_bus: '#94a3b8', walk_from_metro: '#94a3b8',
        bus_ordinary: '#3b82f6', bus_ac_vajra: '#8b5cf6',
        metro: '#22c55e', metro_interchange: '#059669',
        car: '#f97316', cab: '#f59e0b', driving: '#f97316',
      }
      route.legs?.forEach((leg, idx) => {
        const fLat = (leg as any).from_lat || sourceLocation[0]
        const fLng = (leg as any).from_lng || sourceLocation[1]
        const tLat = (leg as any).to_lat || destLocation[0]
        const tLng = (leg as any).to_lng || destLocation[1]
        const color = modeColors[leg.mode] || '#64748b'
        geo.push({ type: 'segment', coordinates: [[fLat, fLng], [tLat, tLng]], color, weight: 3, label: getModeLabel(leg.mode) })
      })
    }

    if (hoveredSegmentOption) {
      const opt = hoveredSegmentOption
      const fLat = opt.from_lat || sourceLocation?.[0]
      const fLng = opt.from_lng || sourceLocation?.[1]
      const tLat = opt.to_lat || destLocation?.[0]
      const tLng = opt.to_lng || destLocation?.[1]
      if (fLat && fLng && tLat && tLng) {
        geo.push({ type: 'hover', coordinates: [[fLat, fLng], [tLat, tLng]], color: '#fbbf24', weight: 6, label: `${getModeLabel(opt.mode)}: ${opt.distance_km}km` })
      }
    }

    if (buildingRoute.some(s => s.selectedOption)) {
      buildingRoute.forEach((seg, idx) => {
        if (!seg.selectedOption) return
        const opt = seg.selectedOption
        const fLat = opt.from_lat || sourceLocation?.[0]
        const fLng = opt.from_lng || sourceLocation?.[1]
        const tLat = opt.to_lat || destLocation?.[0]
        const tLng = opt.to_lng || destLocation?.[1]
        if (fLat && fLng && tLat && tLng) {
          geo.push({ type: 'segment', coordinates: [[fLat, fLng], [tLat, tLng]], color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length], weight: 4, label: seg.selectedOption.mode })
        }
      })
    }

    onRouteGeometry(geo)
  }, [selectedRoute, routes, sourceLocation, destLocation, hoveredSegmentOption, buildingRoute, onRouteGeometry])

  const fetchMiniPath = useCallback(async () => {
    if (!sourceLocation || !destLocation) return
    try {
      const mpData = await getMiniPathOptions(sourceLocation[0], sourceLocation[1], destLocation[0], destLocation[1], prefs.groupSize)
      if (mpData.options) setMiniPathOptions(mpData.options)
    } catch { /* noop */ }
  }, [sourceLocation, destLocation, prefs.groupSize])

  const handleSourceQuery = useCallback(async (value: string) => {
    setSourceQuery(value)
    if (value.length < 2) { setSourceSuggestions([]); setSourceLoading(false); return }
    if (srcAbortRef.current) srcAbortRef.current.abort()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSourceLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      srcAbortRef.current = ctrl
      try {
        const data = await searchPlaces(value, 12.97, 77.59, ctrl.signal)
        setSourceSuggestions((data.results || []).slice(0, 5))
      } catch { if (ctrl.signal.aborted) return; setSourceSuggestions([]) }
      finally { setSourceLoading(false) }
    }, 300)
  }, [])

  const handleDestQuery = useCallback(async (value: string) => {
    setDestQuery(value)
    if (value.length < 2) { setDestSuggestions([]); setDestLoading(false); return }
    if (dstAbortRef.current) dstAbortRef.current.abort()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setDestLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      dstAbortRef.current = ctrl
      try {
        const data = await searchPlaces(value, 12.97, 77.59, ctrl.signal)
        setDestSuggestions((data.results || []).slice(0, 5))
      } catch { if (ctrl.signal.aborted) return; setDestSuggestions([]) }
      finally { setDestLoading(false) }
    }, 300)
  }, [])

  const addWaypoint = useCallback(() => {
    setWaypoints(prev => [...prev, { lat: 0, lng: 0, query: '' }])
  }, [])

  const removeWaypoint = useCallback((idx: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== idx))
    setWpSuggestions(null)
  }, [])

  const handleWpQuery = useCallback(async (idx: number, value: string) => {
    setWaypoints(prev => prev.map((wp, i) => i === idx ? { ...wp, query: value } : wp))
    if (value.length < 2) { setWpSuggestions(null); return }
    if (wpAbortRef.current) wpAbortRef.current.abort()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      wpAbortRef.current = ctrl
      try {
        const data = await searchPlaces(value, 12.97, 77.59, ctrl.signal)
        if (!ctrl.signal.aborted) setWpSuggestions({ idx, items: (data.results || []).slice(0, 5) })
      } catch { if (ctrl.signal.aborted) return; setWpSuggestions(null) }
    }, 300)
  }, [])

  const selectWpSuggestion = useCallback((idx: number, place: PlaceResult) => {
    setWaypoints(prev => prev.map((wp, i) => i === idx ? { lat: place.lat, lng: place.lng, query: place.name } : wp))
    setWpSuggestions(null)
  }, [])

  const handleSourceSelect = useCallback((place: PlaceResult) => {
    setSourceQuery(place.name)
    onSourceLocationChange([place.lat, place.lng])
    setSourceSuggestions([])
    onMapCenterChange([place.lat, place.lng])
    if (newsIntervalRef.current) { clearInterval(newsIntervalRef.current); newsIntervalRef.current = null }
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
    setShowPathBuilder(false)
    setBuildingRoute([])
    setHoveredSegmentOption(null)

    try {
      const mode = travelMode === 'walking' ? 'walking' : travelMode === 'personal' ? 'personal' : 'default'
      const wpData = waypoints.filter(wp => wp.lat !== 0).map(wp => ({ lat: wp.lat, lng: wp.lng, name: wp.query }))
      const data = await planRoute({
        source_lat: sourceLocation[0], source_lng: sourceLocation[1],
        dest_lat: destLocation[0], dest_lng: destLocation[1],
        mode, budget: prefs.budget, group_size: prefs.groupSize,
        waypoints: wpData.length > 0 ? wpData : undefined,
      })

      setRoutes(data.routes || [])
      setRecommendations(data.recommendations || null)
      setWeather(data.weather || null)
      if (data.recommendations?.tips) {
        setInsights(Array.isArray(data.recommendations.tips) ? data.recommendations.tips.join(' · ') : '')
      }

      // Start news fetching now that routes are loaded (queries are settled)
      startNewsFetch()

      if (mapRef.current) {
        mapRef.current.fitBounds([[sourceLocation[0], sourceLocation[1]], [destLocation[0], destLocation[1]]], { padding: [50, 50] })
      }

      if (sourceQuery && destQuery && travelMode !== 'walking') {
        try { const rd = await getRidePrices(sourceQuery, destQuery); setRidePrices(rd.prices || []) } catch { }
      }

      await fetchMiniPath()
    } catch (err) {
      console.error('Route planning failed:', err)
    } finally {
      setLoading(false)
      setRidePricesLoading(false)
    }
  }, [sourceLocation, destLocation, sourceQuery, destQuery, travelMode, prefs, mapRef, fetchMiniPath, startNewsFetch, waypoints])
  planRef.current = handlePlanRoute

  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          onSourceLocationChange(loc)
          setSourceQuery('Current Location')
          onMapCenterChange(loc)
        },
        () => alert('Unable to get your location. Please type a location.')
      )
    }
  }, [onSourceLocationChange, onMapCenterChange])

  const handleStartPathBuilder = useCallback(() => {
    if (!miniPathOptions) return
    const segments: MiniPathSegment[] = []
    if (miniPathOptions.source_walk_options.length > 0) {
      segments.push({ from: 'Your Location', to: 'Destination', selectedOption: null, availableOptions: miniPathOptions.source_walk_options, segmentIndex: 0 })
    }
    miniPathOptions.source_to_transit.bus.forEach((opt, i) => {
      segments.push({ from: opt.from, to: opt.to, selectedOption: null, availableOptions: [opt], segmentIndex: segments.length })
    })
    miniPathOptions.source_to_transit.metro.forEach((opt, i) => {
      segments.push({ from: opt.from, to: opt.to, selectedOption: null, availableOptions: [opt], segmentIndex: segments.length })
    })
    segments.push({
      from: 'Final transit stop', to: destQuery || 'Destination', selectedOption: null,
      availableOptions: [...miniPathOptions.transit_to_dest.bus, ...miniPathOptions.transit_to_dest.metro],
      segmentIndex: segments.length,
    })
    setBuildingRoute(segments)
    setShowPathBuilder(true)
    setActiveSegment(0)
    setRouterView('segment')
  }, [miniPathOptions, destQuery])

  const handleSelectSegmentOption = useCallback((segmentIndex: number, option: MiniPathTransitOption) => {
    setBuildingRoute(prev => { const u = [...prev]; u[segmentIndex] = { ...u[segmentIndex], selectedOption: option }; return u })
    if (segmentIndex < buildingRoute.length - 1) setActiveSegment(segmentIndex + 1)
  }, [buildingRoute.length])

  const handleHoverSegmentOption = useCallback((option: MiniPathTransitOption | null) => {
    setHoveredSegmentOption(option)
  }, [])

  const getBuiltRouteSummary = useCallback((): BuiltRoute | null => {
    if (buildingRoute.length === 0 || buildingRoute.some(s => !s.selectedOption)) return null
    return {
      segments: buildingRoute,
      totalFare: buildingRoute.reduce((sum, s) => sum + (s.selectedOption?.fare || 0), 0),
      totalDuration: buildingRoute.reduce((sum, s) => sum + (s.selectedOption?.duration_minutes || 0), 0),
      totalDistance: buildingRoute.reduce((sum, s) => sum + (s.selectedOption?.distance_km || 0), 0),
    }
  }, [buildingRoute])

  const builtRoute = getBuiltRouteSummary()
  const legColors: Record<string, string> = {
    walk: '#94a3b8', walk_to_bus: '#94a3b8', walk_to_metro: '#94a3b8',
    walk_from_bus: '#94a3b8', walk_from_metro: '#94a3b8',
    bus_ordinary: '#3b82f6', bus_ac_vajra: '#8b5cf6',
    metro: '#22c55e', metro_interchange: '#059669',
    car: '#f97316', cab: '#f59e0b', driving: '#f97316',
  }

  return (
    <div>
      {/* Source/Dest Inputs */}
      <div className="atob-inputs">
        <div className="input-with-icon">
          <span>🟢</span>
          <input type="text" placeholder="Starting point..." value={sourceQuery}
            onChange={(e) => handleSourceQuery(e.target.value)} />
          <button onClick={handleUseCurrentLocation}
            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
            📍 Current
          </button>
        </div>
        {sourceLoading && sourceSuggestions.length === 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {[1,2,3].map(i => (
              <div key={i} className="suggestion-item" style={{ pointerEvents: 'none' }}>
                <span style={{ display: 'inline-block', width: 16, height: 12, background: '#334155', borderRadius: 2 }} />
                <span style={{ display: 'inline-block', width: `${60 + i * 20}px`, height: 12, background: '#334155', borderRadius: 2, marginLeft: 6 }} />
              </div>
            ))}
            <div style={{ padding: '4px 8px', fontSize: 10, color: '#64748b' }}>Searching...</div>
          </div>
        )}
        {!sourceLoading && sourceSuggestions.length > 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {sourceSuggestions.map((place, i) => (
              <div key={i} className="suggestion-item" onClick={() => handleSourceSelect(place)}>
                <span>{getModeIcon(place.place_type)}</span> {place.name}
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
              </div>
            ))}
          </div>
        )}
        {/* Waypoints */}
        {waypoints.map((wp, wi) => (
          <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#f59e0b' }}>📍{wi + 1}</span>
            <input type="text" placeholder={`Stop ${wi + 2}...`} value={wp.query}
              onChange={(e) => handleWpQuery(wi, e.target.value)}
              style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #475569', borderRadius: 6, background: '#1e293b', color: '#e2e8f0', outline: 'none' }} />
            <button onClick={() => removeWaypoint(wi)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>✕</button>
          </div>
        ))}
        {wpSuggestions && wpSuggestions.items.length > 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {wpSuggestions.items.map((place, i) => (
              <div key={i} className="suggestion-item" onClick={() => selectWpSuggestion(wpSuggestions.idx, place)}>
                <span>{getModeIcon(place.place_type)}</span> {place.name}
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={addWaypoint} disabled={waypoints.length >= 5}
          style={{ marginTop: 4, background: '#1e3a5f', border: '1px solid #3b82f6', color: '#60a5fa', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', width: '100%' }}>
          + Add Stop ({waypoints.length}/5)
        </button>
        <div className="input-with-icon" style={{ marginTop: 4 }}>
          <span>🔴</span>
          <input type="text" placeholder="Destination..." value={destQuery}
            onChange={(e) => handleDestQuery(e.target.value)} />
        </div>
        {destLoading && destSuggestions.length === 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {[1,2,3].map(i => (
              <div key={i} className="suggestion-item" style={{ pointerEvents: 'none' }}>
                <span style={{ display: 'inline-block', width: 16, height: 12, background: '#334155', borderRadius: 2 }} />
                <span style={{ display: 'inline-block', width: `${60 + i * 20}px`, height: 12, background: '#334155', borderRadius: 2, marginLeft: 6 }} />
              </div>
            ))}
            <div style={{ padding: '4px 8px', fontSize: 10, color: '#64748b' }}>Searching...</div>
          </div>
        )}
        {!destLoading && destSuggestions.length > 0 && (
          <div className="suggestions-dropdown" style={{ position: 'relative' }}>
            {destSuggestions.map((place, i) => (
              <div key={i} className="suggestion-item" onClick={() => handleDestSelect(place)}>
                <span>{getModeIcon(place.place_type)}</span> {place.name}
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="preferences-panel" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>⚙️ PREFERENCES</div>
        <div className="pref-row">
          <span>👥 Group Size</span>
          <input type="number" min={1} max={20} value={prefs.groupSize}
            onChange={(e) => setPrefs({ ...prefs, groupSize: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="pref-row">
          <span>💰 Budget (₹)</span>
          <input type="number" min={0} placeholder="No limit" value={prefs.budget || ''}
            onChange={(e) => setPrefs({ ...prefs, budget: e.target.value ? parseFloat(e.target.value) : undefined })} />
        </div>
      </div>

      {/* Travel Mode Selector — renamed to Public / Online */}
      <div className="mode-selector" style={{ marginTop: 8 }}>
        <button className={`mode-btn ${travelMode === 'public' ? 'active' : ''}`}
          onClick={() => setTravelMode('public')}>🚌 Public / Online</button>
        <button className={`mode-btn ${travelMode === 'personal' ? 'active' : ''}`}
          onClick={() => setTravelMode('personal')}>🚗 Drive</button>
        <button className={`mode-btn ${travelMode === 'walking' ? 'active' : ''}`}
          onClick={() => setTravelMode('walking')}>🚶 Walk</button>
      </div>

      {/* Direct / Segment sub-tabs — only when Public mode */}
      {travelMode === 'public' && (
        <div style={{ display: 'flex', gap: 0, marginTop: 6 }}>
          <button onClick={() => setRouterView('direct')}
            style={{
              flex: 1, padding: '6px', fontSize: 11, fontWeight: 600,
              borderRadius: '6px 0 0 6px', cursor: 'pointer',
              background: routerView === 'direct' ? '#1e3a5f' : '#0f172a',
              color: routerView === 'direct' ? '#60a5fa' : '#64748b',
              border: routerView === 'direct' ? '1px solid #3b82f6' : '1px solid #334155',
            }}>
            🗺️ Direct Routes
          </button>
          <button onClick={async () => { await fetchMiniPath(); setRouterView('segment'); }}
            style={{
              flex: 1, padding: '6px', fontSize: 11, fontWeight: 600,
              borderRadius: '0 6px 6px 0', cursor: 'pointer',
              background: routerView === 'segment' ? '#1e3a5f' : '#0f172a',
              color: routerView === 'segment' ? '#60a5fa' : '#64748b',
              border: routerView === 'segment' ? '1px solid #3b82f6' : '1px solid #334155',
            }}>
            🔧 Segment Builder
          </button>
        </div>
      )}

      {/* Find Routes button — only for Direct view */}
      {routerView === 'direct' && (
        <button className="go-btn" onClick={handlePlanRoute}
          disabled={!sourceLocation || !destLocation || loading}
          style={{ opacity: (!sourceLocation || !destLocation || loading) ? 0.5 : 1 }}>
          {loading ? '⏳ Analysing Routes...' : '🚀 Find Routes'}
        </button>
      )}

      {/* AI Recommendation */}
      {recommendations && routerView === 'direct' && (
        <div style={{ marginTop: 12, padding: 12, background: '#1e3a5f', borderRadius: 10, border: '1px solid #3b82f6' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginBottom: 6 }}>🤖 AI RECOMMENDATION</div>
          <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
            Recommended: <strong>{recommendations.recommended_mode}</strong>
            {' '}| ₹{recommendations.estimated_cost_min}-{recommendations.estimated_cost_max}
            {' '}| ⏱️ ~{recommendations.estimated_time_minutes}min
            {' '}| Safety: {'🟢'.repeat(Math.floor((recommendations.safety_rating || 5) / 2))}
          </div>
          {recommendations.tips?.length > 0 && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>💡 Tips: {recommendations.tips.slice(0, 3).join(' · ')}</div>
          )}
          {recommendations.current_issues?.length > 0 && (
            <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>⚠️ {recommendations.current_issues.slice(0, 2).join(' · ')}</div>
          )}
        </div>
      )}

      {/* Weather + Insights */}
      {weather && routerView === 'direct' && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#0f172a', borderRadius: 8, fontSize: 11, color: '#94a3b8', display: 'flex', gap: 12 }}>
          <span>🌤️ {weather.condition} | {weather.temperature_celsius}°C</span>
          {weather.traffic_alert && <span>🚦 {weather.traffic_alert}</span>}
          {weather.recommendation && <span>💬 {weather.recommendation}</span>}
        </div>
      )}
      {insights && routerView === 'direct' && (
        <div className="insights-box" style={{ marginTop: 8 }}>💡 {insights}</div>
      )}

      {/* Ride / Cab Prices */}
      {ridePrices.length > 0 && routerView === 'direct' && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 13, marginBottom: 8, color: '#94a3b8' }}>🚗 Ride / Cab Price Estimates</h3>
          {ridePrices.map((rp, i) => (
            <div key={i} style={{ padding: '8px 10px', marginBottom: 4, background: '#0f172a', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>{rp.provider} · {rp.mode.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>⏱️ {rp.eta_minutes} min {rp.note ? `· ${rp.note}` : ''}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>₹{rp.price}</div>
            </div>
          ))}
        </div>
      )}
      {ridePricesLoading && <div className="loading" style={{ marginTop: 12 }}>Fetching ride prices...</div>}

      {/* ===== DIRECT VIEW ===== */}
      {routerView === 'direct' && routes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>🗺️ {routes.length} routes found</h3>
            {miniPathOptions && (
              <button onClick={handleStartPathBuilder} style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                🔧 Build Custom Path
              </button>
            )}
          </div>
          {routes.map((route, i) => (
            <RouteCard key={i} route={route} isSelected={selectedRoute === i} onSelect={() => setSelectedRoute(i)} isRecommended={i === 0} rank={i + 1}
              getLegColor={(m) => legColors[m] || '#64748b'} getModeIcon={getModeIcon} getModeLabel={getModeLabel}
              formatDuration={formatDuration} formatRupees={formatRupees} getScoreColor={getScoreColor} getScoreLabel={getScoreLabel} />
          ))}
        </div>
      )}

      {/* ===== SEGMENT VIEW ===== */}
      {routerView === 'segment' && (
        <div style={{ marginTop: 12 }}>
          {!showPathBuilder ? (
            <div>
              <h3 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>🔧 Segment Builder</h3>
              {miniPathOptions ? (
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                    Total direct distance: {miniPathOptions.direct_distance_km} km
                  </div>
                  <button className="go-btn" onClick={handleStartPathBuilder}
                    style={{ width: '100%' }}>🔧 Open Segment Builder</button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 12 }}>
                  {loading ? '⏳ Loading...' : 'Set source & destination and press "Open Segment Builder" to start'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>🔧 Build Your Custom Path</div>

              {buildingRoute.map((segment, idx) => (
                <div key={idx} style={{
                  marginBottom: 8, padding: 8, borderRadius: 8,
                  background: activeSegment === idx ? '#1e3a5f' : '#0f172a',
                  border: activeSegment === idx ? '1px solid #3b82f6' : '1px solid #334155',
                }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                    Segment {idx + 1}: {segment.from} → {segment.to}
                    {segment.selectedOption && <span style={{ color: '#22c55e', marginLeft: 8 }}>✅ Selected</span>}
                  </div>
                  {segment.selectedOption ? (
                    <div style={{ fontSize: 12, color: '#e2e8f0', padding: '4px 8px', background: '#0f2d1a', borderRadius: 6 }}>
                      {getModeIcon(segment.selectedOption.mode)} {getModeLabel(segment.selectedOption.mode)}
                      {' | '}{formatDuration(segment.selectedOption.duration_minutes)}
                      {segment.selectedOption.distance_km > 0 ? ` | ${segment.selectedOption.distance_km.toFixed(2)}km` : ''}
                      {segment.selectedOption.fare > 0 ? ` | ${formatRupees(segment.selectedOption.fare)}` : ''}
                    </div>
                  ) : (
                    <div>
                      {segment.availableOptions.map((opt, oi) => (
                        <button key={oi}
                          onClick={() => handleSelectSegmentOption(idx, opt)}
                          onMouseEnter={() => handleHoverSegmentOption(opt)}
                          onMouseLeave={() => handleHoverSegmentOption(null)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                            marginBottom: 3, background: '#1e293b', border: '1px solid #334155',
                            borderRadius: 6, color: '#cbd5e1', cursor: 'pointer', fontSize: 11,
                          }}>
                          <span style={{ color: legColors[opt.mode] || '#64748b' }}>{getModeIcon(opt.mode)}</span>
                          {' '}{getModeLabel(opt.mode)}
                          {' | '}{formatDuration(opt.duration_minutes)}
                          {' | '}{opt.distance_km > 0 ? `${opt.distance_km.toFixed(2)}km` : ''}
                          {opt.fare > 0 ? ` | ${formatRupees(opt.fare)}` : ''}
                          {opt.instructions && <span style={{ color: '#94a3b8', marginLeft: 4 }}>💡 {opt.instructions}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {builtRoute && (
                <div style={{ marginTop: 10, padding: 12, background: '#0f2d1a', borderRadius: 8, border: '1px solid #22c55e' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>✅ Your Custom Route</div>
                  <div style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 4 }}>
                    {builtRoute.segments.map((s, i) => (
                      <span key={i}>{i > 0 && <span style={{ color: '#64748b' }}> → </span>}{getModeIcon(s.selectedOption!.mode)}<span style={{ fontSize: 10 }}> {s.selectedOption!.to.slice(0, 15)}</span></span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                    <span>💰 <strong style={{ color: '#fbbf24' }}>{formatRupees(builtRoute.totalFare)}</strong></span>
                    <span>⏱️ <strong style={{ color: '#e2e8f0' }}>{formatDuration(builtRoute.totalDuration)}</strong></span>
                    <span>📏 <strong style={{ color: '#e2e8f0' }}>{builtRoute.totalDistance.toFixed(1)}km</strong></span>
                  </div>
                  <button style={{ marginTop: 8, width: '100%', padding: '10px', background: '#22c55e', border: 'none', borderRadius: 8, color: '#052e16', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    ✅ Confirm & Start
                  </button>
                </div>
              )}

              {!builtRoute && (
                <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Select options for all segments to build your custom route
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!sourceLocation && !destLocation && !loading && routes.length === 0 && (
        <div className="no-data" style={{ marginTop: 20 }}>Enter source and destination to plan your route</div>
      )}
    </div>
  )
}

function RouteCard({ route, isSelected, onSelect, isRecommended, rank, getLegColor, getModeIcon, getModeLabel, formatDuration, formatRupees, getScoreColor, getScoreLabel }: {
  route: RouteOption; isSelected: boolean; onSelect: () => void; isRecommended?: boolean; rank?: number
  getLegColor: (m: string) => string; getModeIcon: (m: string) => string; getModeLabel: (m: string) => string
  formatDuration: (m: number) => string; formatRupees: (v: number) => string
  getScoreColor: (s: number) => string; getScoreLabel: (s: number) => string
}) {
  const totalMin = route.total_duration_minutes || 1
  const [expanded, setExpanded] = useState(isSelected)
  useEffect(() => { if (isSelected) setExpanded(true) }, [isSelected])

  return (
    <div className={`route-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}
      style={{ borderColor: isRecommended ? '#22c55e' : isSelected ? '#3b82f6' : '#334155', borderWidth: isRecommended ? 2 : 1 }}>
      <div className="route-header">
        <div className="route-type">
          {getModeIcon(route.type)} {route.type.replace(/_/g, ' ').toUpperCase()}
          {isRecommended && <span className="recommended-label">⭐ Best</span>}
          {isSelected && <span className="recommended-label">Selected</span>}
          {rank && <span className="recommended-label" style={{ background: '#1e3a5f', color: '#60a5fa' }}>#{rank}</span>}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(route.overall_score) }}>{formatRupees(route.total_fare)}</span>
      </div>

      <div className="route-stats">
        <span>⏱️ {formatDuration(route.total_duration_minutes)}</span>
        <span>📏 {route.total_distance_km.toFixed(1)} km</span>
        <span>🚶 {route.total_walking_km.toFixed(2)} km walk</span>
        <span style={{ color: getScoreColor(route.overall_score) }}>⭐ {getScoreLabel(route.overall_score)} ({route.overall_score})</span>
      </div>

      <div className="score-bar"><div className="score-fill" style={{ width: `${route.overall_score}%`, background: getScoreColor(route.overall_score) }} /></div>

      {route.score_explanation && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
          💡 {route.score_explanation}
        </div>
      )}

      {route.route_numbers?.length > 0 && (
        <div style={{ marginTop: 6, marginBottom: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: '#64748b' }}>🚌 Routes:</span>
          {route.route_numbers.map((rn, i) => (
            <span key={i} style={{ fontSize: 9, background: '#1e293b', padding: '1px 6px', borderRadius: 4, color: '#60a5fa', fontWeight: 600, border: '1px solid #334155' }}>{rn}</span>
          ))}
        </div>
      )}

      {route.legs?.length > 0 && (
        <div style={{ marginTop: 6, marginBottom: 6 }}>
          <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {route.legs.map((leg, j) => {
              const pct = Math.max(5, (leg.duration_minutes / totalMin) * 100)
              return (
                <div key={j} title={`${getModeLabel(leg.mode)}: ${formatDuration(leg.duration_minutes)}`}
                  style={{ width: `${pct}%`, background: getLegColor(leg.mode), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, lineHeight: '16px' }}>{getModeIcon(leg.mode)}</span>
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

      <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} style={{ fontSize: 10, color: '#60a5fa', cursor: 'pointer', marginTop: 4 }}>
        {expanded ? '▲ Hide details' : '▼ Show details'}
      </div>

      {expanded && (
        <div className="route-legs">
          {route.legs?.map((leg, j) => (
            <div key={j} className="route-leg" style={{ padding: '4px 6px', marginBottom: 2, background: '#0f172a', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: getLegColor(leg.mode) }}>{getModeIcon(leg.mode)}</span>
                <span style={{ fontSize: 11, color: '#e2e8f0' }}>{getModeLabel(leg.mode)}</span>
                {leg.line && <span style={{ fontSize: 10, padding: '1px 4px', background: '#1e293b', borderRadius: 3, color: '#94a3b8' }}>{leg.line}</span>}
                <span style={{ fontSize: 10, color: '#64748b' }}>{leg.distance_km > 0 ? `${leg.distance_km.toFixed(1)} km` : ''}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{formatDuration(leg.duration_minutes)}</span>
                {leg.fare > 0 && <span style={{ fontSize: 11, color: '#fbbf24' }}>{formatRupees(leg.fare)}</span>}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{leg.from.slice(0, 25)} → {leg.to.slice(0, 25)}</div>
              {(leg as any).route_numbers?.length > 0 && (
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: '#64748b' }}>Bus:</span>
                  {(leg as any).route_numbers.map((rn: string, ri: number) => (
                    <span key={ri} style={{ fontSize: 8, background: '#1e3a5f', padding: '1px 5px', borderRadius: 3, color: '#60a5fa', fontWeight: 600 }}>{rn}</span>
                  ))}
                </div>
              )}
              {leg.instructions && <div style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic', marginTop: 1 }}>💡 {leg.instructions}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
