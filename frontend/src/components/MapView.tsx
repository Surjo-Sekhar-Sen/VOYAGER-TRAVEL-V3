import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PlaceResult } from '../types'

interface MapViewProps {
  center: [number, number]
  onCenterChange?: (center: [number, number]) => void
  selectedPlace: PlaceResult | null
  userLocation: [number, number] | null
  sourceLocation: [number, number] | null
  destLocation: [number, number] | null
  mapRef?: React.MutableRefObject<any>
  allMarkers: PlaceResult[]
  onMarkerClick?: (place: PlaceResult) => void
}

function createColoredPin(color: string, emoji: string, size: number = 28, glow: boolean = false) {
  const glowStyle = glow ? `filter: drop-shadow(0 0 8px ${color}) brightness(1.3);` : ''
  return L.divIcon({
    className: '',
    html: `<div style="font-size:${size}px;${glowStyle}">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

function MapController({ center, mapRef }: { center: [number, number]; mapRef?: React.MutableRefObject<any> }) {
  const map = useMap()
  useEffect(() => {
    if (mapRef) mapRef.current = map
  }, [map, mapRef])
  return null
}

function getPlaceEmoji(placeType: string): string {
  const emojis: Record<string, string> = {
    mall: '🛍️', hospital: '🏥', airport: '✈️', railway_station: '🚉',
    bus_stand: '🚏', park: '🌳', it_hub: '🏢', metro_station: '🚇',
    bus_stop: '🚏', atm: '🏧', bank: '🏦', restaurant: '🍽️',
    hotel: '🏨', lodge: '🏨', temple: '🛕', mosque: '🕌', church: '⛪',
    school: '📚', petrol_pump: '⛽', charging_station: '🔋',
    police_station: '🚔', cafe: '☕', clinic: '🏥', pharmacy: '💊',
    supermarket: '🛒', gym: '🏋️', library: '📖', cinema: '🎬',
    post_office: '📮', place: '📍',
  }
  return emojis[placeType] || '📍'
}

export default function MapView({
  center, selectedPlace, userLocation, sourceLocation,
  destLocation, mapRef, allMarkers, onMarkerClick
}: MapViewProps) {
  const userIcon = useMemo(() => createColoredPin('#3b82f6', '📍', 32, true), [])
  const sourceIcon = useMemo(() => createColoredPin('#3b82f6', '🟢', 24), [])
  const destIcon = useMemo(() => createColoredPin('#ef4444', '🔴', 24), [])

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <MapController center={center} mapRef={mapRef} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>
            <strong>📍 Your Location</strong>
            <br />
            <span style={{ fontSize: 12, color: '#666' }}>
              {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
            </span>
          </Popup>
        </Marker>
      )}

      {sourceLocation && !userLocation && (
        <Marker position={sourceLocation} icon={sourceIcon}>
          <Popup>Source</Popup>
        </Marker>
      )}

      {destLocation && (
        <Marker position={destLocation} icon={destIcon}>
          <Popup>Destination</Popup>
        </Marker>
      )}

      {allMarkers.map((place, i) => {
        const score = place.reliability_score || 0.5
        const isGood = score > 0.7
        const emoji = getPlaceEmoji(place.place_type)
        const isSelected = selectedPlace &&
          Math.abs(place.lat - selectedPlace.lat) < 0.001 &&
          Math.abs(place.lng - selectedPlace.lng) < 0.001

        const icon = L.divIcon({
          className: '',
          html: `<div style="font-size:${isSelected ? 34 : 24}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${isGood ? '🟢' : '🔴'}${emoji}</div>`,
          iconSize: [isSelected ? 34 : 24, isSelected ? 34 : 24],
          iconAnchor: [isSelected ? 17 : 12, isSelected ? 34 : 24],
          popupAnchor: [0, isSelected ? -34 : -24],
        })

        return (
          <Marker
            key={`marker-${i}`}
            position={[place.lat, place.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onMarkerClick?.(place),
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{place.name}</strong><br />
                <span style={{ fontSize: 12, color: '#666' }}>{place.address}</span>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  ⭐ {place.rating?.toFixed(1) || 'N/A'} | ✅ {((place.reliability_score || 0.5) * 100).toFixed(0)}%
                </div>
                {place.review_summary && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                    {place.review_summary}
                  </div>
                )}
                {place.price_info && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#f59e0b' }}>
                    💰 {place.price_info}
                  </div>
                )}
                <button
                  onClick={() => onMarkerClick?.(place)}
                  style={{
                    marginTop: 8, padding: '4px 12px',
                    background: '#2563eb', color: 'white',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {selectedPlace && allMarkers.length === 0 && (
        <Marker
          position={[selectedPlace.lat, selectedPlace.lng]}
          icon={L.divIcon({
            className: '',
            html: `<div style="font-size:32px;filter:drop-shadow(0 2px 8px rgba(37,99,235,0.5))">🔵${getPlaceEmoji(selectedPlace.place_type)}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          })}
        >
          <Popup>
            <strong>{selectedPlace.name}</strong><br />
            <span style={{ fontSize: 12, color: '#666' }}>{selectedPlace.address}</span>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
