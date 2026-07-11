import { useState, useCallback, useRef, useEffect } from 'react'
import MainPage from './pages/MainPage'
import type { AppMode, PlaceResult } from './types'

function App() {
  const [mode, setMode] = useState<AppMode>('search')
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946])
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [sourceLocation, setSourceLocation] = useState<[number, number] | null>(null)
  const [destLocation, setDestLocation] = useState<[number, number] | null>(null)
  const [allMarkers, setAllMarkers] = useState<PlaceResult[]>([])
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
          setUserLocation(loc)
          setMapCenter(loc)
          if (mapRef.current) {
            mapRef.current.flyTo(loc, 14)
          }
        },
        () => {
          console.log('Geolocation denied, using default Bangalore center')
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [])

  const handleSelectPlace = useCallback((place: PlaceResult) => {
    setSelectedPlace(place)
    setMapCenter([place.lat, place.lng])
    if (mapRef.current) {
      mapRef.current.flyTo([place.lat, place.lng], 15)
    }
  }, [])

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode)
  }, [])

  const handleNavigateToPlace = useCallback((place: PlaceResult) => {
    setMode('atob')
    setSourceLocation(userLocation)
    setDestLocation([place.lat, place.lng])
  }, [userLocation])

  const handleMarkersUpdate = useCallback((markers: PlaceResult[]) => {
    setAllMarkers(markers)
  }, [])

  const handleMapCenterChange = useCallback((center: [number, number]) => {
    setMapCenter(center)
    if (mapRef.current) {
      mapRef.current.flyTo(center, 14)
    }
  }, [])

  return (
    <MainPage
      mode={mode}
      onModeChange={handleModeChange}
      selectedPlace={selectedPlace}
      onSelectPlace={handleSelectPlace}
      mapCenter={mapCenter}
      onMapCenterChange={handleMapCenterChange}
      userLocation={userLocation}
      sourceLocation={sourceLocation}
      onSourceLocationChange={setSourceLocation}
      destLocation={destLocation}
      onDestLocationChange={setDestLocation}
      onNavigateToPlace={handleNavigateToPlace}
      mapRef={mapRef}
      allMarkers={allMarkers}
      onMarkersUpdate={handleMarkersUpdate}
    />
  )
}

export default App
