import { useState, useCallback, useEffect } from 'react'
import SearchPanel from '../components/SearchPanel'
import AToBPanel from '../components/AToBPanel'
import TripPanel from '../components/TripPanel'
import SegmentPanel from '../components/SegmentPanel'
import DiscoveryPanel from '../components/DiscoveryPanel'
import NewsOverlay from '../components/NewsOverlay'
import MapView from '../components/MapView'
import type { PlaceResult, AppMode, NewsItem, MapRouteGeometry, NavTab } from '../types'
import { enrichPlace } from '../services/api'

interface MainPageProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  selectedPlace: PlaceResult | null
  onSelectPlace: (place: PlaceResult) => void
  mapCenter: [number, number]
  onMapCenterChange: (center: [number, number]) => void
  userLocation: [number, number] | null
  sourceLocation: [number, number] | null
  onSourceLocationChange: (loc: [number, number] | null) => void
  destLocation: [number, number] | null
  onDestLocationChange: (loc: [number, number] | null) => void
  onNavigateToPlace: (place: PlaceResult) => void
  mapRef: React.MutableRefObject<any>
  allMarkers: PlaceResult[]
  onMarkersUpdate: (markers: PlaceResult[]) => void
  tabs: NavTab[]
}

export default function MainPage({
  mode, onModeChange, selectedPlace, onSelectPlace,
  mapCenter, onMapCenterChange, userLocation,
  sourceLocation, onSourceLocationChange, destLocation, onDestLocationChange,
  onNavigateToPlace, mapRef, allMarkers, onMarkersUpdate, tabs,
}: MainPageProps) {
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [discoveryPlace, setDiscoveryPlace] = useState<PlaceResult | null>(null)
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([])
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null)
  const [enrichingName, setEnrichingName] = useState<string | null>(null)
  const [routeGeometry, setRouteGeometry] = useState<any>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [mapWaypoints, setMapWaypoints] = useState<{ lat: number; lng: number; query: string }[]>([])
  const [segmentPanelOpen, setSegmentPanelOpen] = useState(false)
  const [segmentSourceName, setSegmentSourceName] = useState('')
  const [segmentDestName, setSegmentDestName] = useState('')
  const [segmentGroupSize, setSegmentGroupSize] = useState(1)
  const [segmentBudget, setSegmentBudget] = useState<number | undefined>(undefined)
  const [segmentGeometry, setSegmentGeometry] = useState<MapRouteGeometry[] | null>(null)
  const [liveTrackingPos, setLiveTrackingPos] = useState<[number, number] | null>(null)
  const [trackingActive, setTrackingActive] = useState(false)
  const [trackingWatcherRef] = useState<React.MutableRefObject<number | null>>({ current: null } as any)

  const handleSearchResults = useCallback((results: PlaceResult[], center?: [number, number]) => {
    setSearchResults(results)
    setNearbyResults([])
    if (center) setSearchCenter(center)
  }, [])

  const handleNearbyResults = useCallback((results: PlaceResult[], center: [number, number]) => {
    setNearbyResults(results)
    setSearchResults([])
    setSearchCenter(center)
  }, [])

  const handleViewOnMap = useCallback((place: PlaceResult) => {
    onSelectPlace(place)
    setShowDiscovery(true)
    setDiscoveryPlace(place)
  }, [onSelectPlace])

  const handleViewDetails = useCallback(async (place: PlaceResult) => {
    setEnrichingName(place.name)
    try {
      const enriched = await enrichPlace(place)
      if (enriched?.status === 'success' && enriched.place) {
        const fullPlace = { ...place, ...enriched.place }
        onSelectPlace(fullPlace)
        setDiscoveryPlace(fullPlace)
      } else {
        onSelectPlace(place)
        setDiscoveryPlace(place)
      }
    } catch {
      onSelectPlace(place)
      setDiscoveryPlace(place)
    }
    setEnrichingName(null)
    setShowDiscovery(true)
  }, [onSelectPlace])

  const handleCloseDiscovery = useCallback(() => {
    setShowDiscovery(false)
    setDiscoveryPlace(null)
  }, [])

  const handleRouteGeometry = useCallback((geo: any) => {
    setRouteGeometry(geo)
  }, [])

  const handleOpenSegmentPanel = useCallback((sourceName: string, destName: string, groupSize: number, budget?: number) => {
    setSegmentSourceName(sourceName)
    setSegmentDestName(destName)
    setSegmentGroupSize(groupSize)
    setSegmentBudget(budget)
    setSegmentPanelOpen(true)
    setSegmentGeometry(null)
    setTimeout(() => { mapRef.current?.invalidateSize?.() }, 100)
  }, [mapRef])

  const handleCloseSegmentPanel = useCallback(() => {
    setSegmentPanelOpen(false)
    setSegmentGeometry(null)
    if (trackingWatcherRef.current !== null) {
      navigator.geolocation.clearWatch(trackingWatcherRef.current)
      trackingWatcherRef.current = null
    }
    setTrackingActive(false)
    setLiveTrackingPos(null)
    setTimeout(() => { mapRef.current?.invalidateSize?.() }, 100)
  }, [mapRef, trackingWatcherRef])

  const handleStartJourney = useCallback(() => {
    if (!navigator.geolocation) return
    setTrackingActive(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => setLiveTrackingPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    )
    trackingWatcherRef.current = navigator.geolocation.watchPosition(
      (pos) => setLiveTrackingPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }, [trackingWatcherRef])

  const handleSegmentGeometry = useCallback((geo: MapRouteGeometry[] | null) => {
    setSegmentGeometry(geo)
  }, [])

  const handleLocateNews = useCallback((item: NewsItem) => {
    if (item.lat && item.lng) {
      onMapCenterChange([item.lat, item.lng])
    }
  }, [onMapCenterChange])

  const handleModeChange = useCallback((newMode: AppMode) => {
    onModeChange(newMode)
    setShowDiscovery(false)
    setDiscoveryPlace(null)
    setSearchResults([])
    setNearbyResults([])
    setSegmentPanelOpen(false)
    setRouteGeometry(null)
  }, [onModeChange])

  const renderPanel = () => {
    switch (mode) {
      case 'search':
        return (
          <SearchPanel
            onSelectPlace={onSelectPlace}
            onViewOnMap={handleViewOnMap}
            onViewDetails={handleViewDetails}
            onNavigateToPlace={onNavigateToPlace}
            onSearchResults={handleSearchResults}
            onNearbyResults={(results) => handleNearbyResults(results, mapCenter)}
            userLocation={userLocation}
            mapCenter={searchCenter || mapCenter}
            enrichingName={enrichingName}
          />
        )
      case 'atob':
        return (
          <AToBPanel
            sourceLocation={sourceLocation}
            onSourceLocationChange={onSourceLocationChange}
            destLocation={destLocation}
            onDestLocationChange={onDestLocationChange}
            onMapCenterChange={onMapCenterChange}
            onRouteGeometry={handleRouteGeometry}
            onOpenSegmentPanel={handleOpenSegmentPanel}
            onWaypointsChange={setMapWaypoints}
            mapRef={mapRef}
            onNewsUpdate={setNewsItems}
          />
        )
      case 'trip':
        return <TripPanel />
      default:
        return null
    }
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="material-symbols-outlined brand-icon">explore</span>
          <h1>VOYAGER</h1>
        </div>
        <div className="pill-nav">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`pill-tab${mode === tab.key ? ' active' : ''}`}
              onClick={() => handleModeChange(tab.key)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-content">
          {renderPanel()}
        </div>
      </div>
      <div className="map-container">
        <MapView
          mapRef={mapRef}
          center={mapCenter}
          userLocation={userLocation}
          allMarkers={mode === 'search' ? allMarkers : []}
          selectedPlace={selectedPlace}
          onMarkerClick={onSelectPlace}
          routeGeometry={routeGeometry}
          sourceLocation={sourceLocation}
          destLocation={destLocation}
          waypoints={mapWaypoints}
          liveTrackingPos={liveTrackingPos}
          newsItems={newsItems}
          onCenterChange={onMapCenterChange}
        />
        {showDiscovery && discoveryPlace && mode === 'search' && (
          <DiscoveryPanel
            place={discoveryPlace}
            onClose={handleCloseDiscovery}
          />
        )}
        <NewsOverlay
          news={newsItems}
          loading={false}
          onLocateNews={handleLocateNews}
        />
      </div>
      <div className="bottom-pill-nav">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`bottom-pill-tab${mode === tab.key ? ' active' : ''}`}
            onClick={() => handleModeChange(tab.key)}
          >
            <span className={`material-symbols-outlined${mode === tab.key ? ' fill' : ''}`}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {segmentPanelOpen && (
        <SegmentPanel
          sourceName={segmentSourceName}
          destName={segmentDestName}
          groupSize={segmentGroupSize}
          budget={segmentBudget}
          sourceLocation={sourceLocation ?? userLocation ?? mapCenter}
          destLocation={destLocation ?? (userLocation ? [userLocation[0] + 0.01, userLocation[1] + 0.01] : mapCenter)}
          onClose={handleCloseSegmentPanel}
          onStartJourney={handleStartJourney}
          onGeometryChange={handleSegmentGeometry}
        />
      )}
    </div>
  )
}
