import { useState } from 'react'
import type { AppMode, PlaceResult } from '../types'
import { enrichPlace } from '../services/api'
import MapView from '../components/MapView'
import SearchPanel from '../components/SearchPanel'
import AToBPanel from '../components/AToBPanel'
import TripPanel from '../components/TripPanel'
import DiscoveryPanel from '../components/DiscoveryPanel'

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
}

export default function MainPage({
  mode,
  onModeChange,
  selectedPlace,
  onSelectPlace,
  mapCenter,
  onMapCenterChange,
  userLocation,
  sourceLocation,
  onSourceLocationChange,
  destLocation,
  onDestLocationChange,
  onNavigateToPlace,
  mapRef,
  allMarkers,
  onMarkersUpdate,
}: MainPageProps) {
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [discoveryPlace, setDiscoveryPlace] = useState<PlaceResult | null>(null)
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([])
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null)
  const [enrichingName, setEnrichingName] = useState<string | null>(null)

  const handleSearchResults = (results: PlaceResult[], center?: [number, number]) => {
    setSearchResults(results)
    onMarkersUpdate(results)
    if (center) setSearchCenter(center)
  }

  const handleNearbyResults = (results: PlaceResult[]) => {
    setNearbyResults(results)
    onMarkersUpdate(results)
  }

  const handleViewOnMap = (place: PlaceResult) => {
    setDiscoveryPlace(place)
    setShowDiscovery(true)
    onSelectPlace(place)
  }

  const handleNearbyAroundPlace = (place: PlaceResult) => {
    setSearchCenter([place.lat, place.lng])
    onSelectPlace(place)
  }

  const handleViewDetails = async (place: PlaceResult) => {
    setShowDiscovery(false)
    setEnrichingName(place.name)
    try {
      const data = await enrichPlace(place)
      handleViewOnMap(data.place)
    } catch {
      handleViewOnMap(place)
    } finally {
      setEnrichingName(null)
    }
  }

  const renderPanel = () => {
    switch (mode) {
      case 'search':
        return (
          <SearchPanel
            onSelectPlace={onSelectPlace}
            onNavigateToPlace={onNavigateToPlace}
            mapCenter={searchCenter || mapCenter}
            userLocation={userLocation}
            onSearchResults={handleSearchResults}
            onNearbyResults={handleNearbyResults}
            onViewOnMap={handleViewOnMap}
            onNearbyAroundPlace={handleNearbyAroundPlace}
            onMapCenterChange={onMapCenterChange}
            onViewDetails={handleViewDetails}
            enrichingName={enrichingName}
          />
        )
      case 'atob':
        return (
          <AToBPanel
            sourceLocation={sourceLocation || userLocation}
            destLocation={destLocation}
            onSourceLocationChange={onSourceLocationChange}
            onDestLocationChange={onDestLocationChange}
            onMapCenterChange={onMapCenterChange}
            mapRef={mapRef}
          />
        )
      case 'trip':
        return <TripPanel />
    }
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <span style={{ fontSize: 28 }}>🧭</span>
          <h1>VOYAGER</h1>
          {userLocation && (
            <div onClick={() => onMapCenterChange(userLocation)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#1e3a5f', border: '2px solid #3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', marginLeft: 'auto',
                fontSize: 18, transition: 'all 0.2s',
              }}
              title="Jump to my location"
              onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#1e3a5f')}
            >
              📍
            </div>
          )}
        </div>

        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'search' ? 'active' : ''}`}
            onClick={() => onModeChange('search')}
          >
            🔍 SEARCH
          </button>
          <button
            className={`mode-tab ${mode === 'atob' ? 'active' : ''}`}
            onClick={() => onModeChange('atob')}
          >
            🗺️ A-TO-B
          </button>
          <button
            className={`mode-tab ${mode === 'trip' ? 'active' : ''}`}
            onClick={() => onModeChange('trip')}
          >
            📋 TRIP
          </button>
        </div>

        <div className="sidebar-content scrollable-content">
          {renderPanel()}
        </div>
      </div>

      <div className="map-container">
        <MapView
          center={mapCenter}
          onCenterChange={onMapCenterChange}
          selectedPlace={selectedPlace}
          userLocation={userLocation}
          sourceLocation={sourceLocation}
          destLocation={destLocation}
          mapRef={mapRef}
          allMarkers={allMarkers}
          onMarkerClick={handleViewOnMap}
        />

        {showDiscovery && discoveryPlace && (
          <DiscoveryPanel
            place={discoveryPlace}
            onClose={() => setShowDiscovery(false)}
          />
        )}
      </div>
    </div>
  )
}
