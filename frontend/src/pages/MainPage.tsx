import { useCallback, useState } from 'react'
import { useApp } from '../context/AppContext'
import SearchPanel from '../components/SearchPanel'
import AToBPanel from '../components/AToBPanel'
import TripPanel from '../components/TripPanel'
import DiscoveryPanel from '../components/DiscoveryPanel'
import MapView from '../components/MapView'
import type { PlaceResult, MapRouteGeometry } from '../types'
import { enrichPlace } from '../services/api'

export default function MainPage() {
  const {
    mode, setMode, tabs,
    mapCenter, setMapCenter, mapRef,
    selectedPlace, setSelectedPlace,
    allMarkers, setAllMarkers,
    sourceLocation, destLocation,
    userLocation, trackingActive, liveTrackingPos,
    routeGeometry, setRouteGeometry,
    newsItems, setNewsItems,
    openDiscovery, showDiscovery, discoveryPlace,
  } = useApp()

  const [enrichingName, setEnrichingName] = useState<string | null>(null)

  const handleViewOnMap = useCallback((place: PlaceResult) => {
    setSelectedPlace(place)
    setMapCenter([place.lat, place.lng])
    if (mapRef.current) mapRef.current.flyTo([place.lat, place.lng], 15)
  }, [setSelectedPlace, setMapCenter, mapRef])

  const handleViewDetails = useCallback(async (place: PlaceResult) => {
    setEnrichingName(place.name)
    try {
      const enriched = await enrichPlace(place)
      if (enriched?.status === 'success' && enriched.place) {
        const fullPlace = { ...place, ...enriched.place }
        setSelectedPlace(fullPlace)
        openDiscovery(fullPlace)
      } else {
        setSelectedPlace(place)
        openDiscovery(place)
      }
    } catch {
      setSelectedPlace(place)
      openDiscovery(place)
    }
    setEnrichingName(null)
  }, [setSelectedPlace, openDiscovery])

  const {
    setSourceLocation: setSrcLoc,
    setDestLocation: setDstLoc,
    closeDiscovery,
  } = useApp()

  const handleNavigateToPlace = useCallback((place: PlaceResult) => {
    setMode('atob')
    setSrcLoc(userLocation)
    setDstLoc([place.lat, place.lng])
  }, [setMode, userLocation, setSrcLoc, setDstLoc])

  const handleModeChange = useCallback((newMode: 'search' | 'atob' | 'trip') => {
    setMode(newMode)
    setRouteGeometry(null)
  }, [setMode, setRouteGeometry])

  const handleMarkerClick = useCallback((place: PlaceResult) => {
    setSelectedPlace(place)
    setMapCenter([place.lat, place.lng])
  }, [setSelectedPlace, setMapCenter])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      <div className="sidebar glass-strong" style={{
        width: 420, minWidth: 420, display: 'flex', flexDirection: 'column', zIndex: 1000,
        borderRight: '1px solid rgba(198,197,212,0.3)', position: 'relative',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(198,197,212,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>explore</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>VOYAGER</span>
        </div>

        <div style={{ display: 'flex', padding: '8px 16px', gap: 4, borderBottom: '1px solid rgba(198,197,212,0.2)' }}>
          {tabs.map(tab => (
            <button key={tab.key}
              onClick={() => handleModeChange(tab.key)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 'var(--radius-full)',
                background: mode === tab.key ? 'var(--primary)' : 'transparent',
                color: mode === tab.key ? 'var(--on-primary)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: mode === 'search' ? 0 : '14px 16px' }}>
          {mode === 'search' && (
            <SearchPanel
              onSelectPlace={(place) => { setSelectedPlace(place); handleViewOnMap(place) }}
              onViewOnMap={handleViewOnMap}
              onViewDetails={handleViewDetails}
              onNavigateToPlace={handleNavigateToPlace}
              enrichingName={enrichingName}
            />
          )}
          {mode === 'atob' && (
            <AToBPanel
              onRouteGeometry={setRouteGeometry}
              onNewsUpdate={setNewsItems}
            />
          )}
          {mode === 'trip' && <TripPanel />}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapView
          mapRef={mapRef}
          center={mapCenter}
          onCenterChange={setMapCenter}
          userLocation={userLocation}
          allMarkers={allMarkers}
          selectedPlace={selectedPlace}
          onMarkerClick={handleMarkerClick}
          routeGeometry={routeGeometry}
          sourceLocation={sourceLocation}
          destLocation={destLocation}
          liveTrackingPos={liveTrackingPos}
          trackingActive={trackingActive}
          newsItems={newsItems}
        />

        {showDiscovery && discoveryPlace && mode === 'search' && (
          <DiscoveryPanel
            place={discoveryPlace}
            onClose={closeDiscovery}
          />
        )}
      </div>

      <div className="bottom-pill-nav">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => handleModeChange(tab.key)}
            className={`bottom-pill-tab${mode === tab.key ? ' active' : ''}`}>
            <span className={`material-symbols-outlined${mode === tab.key ? ' fill' : ''}`} style={{ fontSize: 18 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
