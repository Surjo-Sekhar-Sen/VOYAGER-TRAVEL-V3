import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PlaceResult, MapRouteGeometry, NewsItem } from '../types'

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
  routeGeometry?: MapRouteGeometry[]
  onMapClick?: (latlng: [number, number]) => void
  newsItems?: NewsItem[]
  waypoints?: { lat: number; lng: number; query: string }[]
  liveTrackingPos?: [number, number] | null
  trackingActive?: boolean
}

function createColoredPin(color: string, icon: string, size: number = 28, glow: boolean = false, isMaterial: boolean = true) {
  const glowStyle = glow ? `filter: drop-shadow(0 0 8px ${color}) brightness(1.3);` : ''
  const content = isMaterial
    ? `<span class="material-symbols-outlined" style="font-size:${size}px;color:${color};${glowStyle}">${icon}</span>`
    : `<div style="font-size:${size}px;${glowStyle}">${icon}</div>`
  return L.divIcon({
    className: '',
    html: content,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

function MapController({ center, mapRef, onMapClick }: {
  center: [number, number]
  mapRef?: React.MutableRefObject<any>
  onMapClick?: (latlng: [number, number]) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (mapRef) mapRef.current = map
  }, [map, mapRef])

  useEffect(() => {
    if (!onMapClick) return
    const handler = (e: L.LeafletMouseEvent) => onMapClick([e.latlng.lat, e.latlng.lng])
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onMapClick])

  return null
}

interface TrafficRoad {
  geometry: { type: string; coordinates: [number, number][] }
  properties: { highway: string; color: string; name: string }
}
function TrafficLayer() {
  const map = useMap()
  const [roads, setRoads] = useState<TrafficRoad[]>([])
  const [congestion, setCongestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTraffic = useCallback(async () => {
    const b = map.getBounds()
    try {
      setLoading(true)
      const resp = await fetch(`/api/routes/traffic-overlay?north=${b.getNorth()}&south=${b.getSouth()}&east=${b.getEast()}&west=${b.getWest()}`)
      const data = await resp.json()
      if (data.features) setRoads(data.features)
      if (data.congestion) setCongestion(data.congestion)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [map])

  useEffect(() => {
    if (!enabled) { setRoads([]); return }
    fetchTraffic()
    const handler = () => {
      if (moveTimer.current) clearTimeout(moveTimer.current)
      moveTimer.current = setTimeout(fetchTraffic, 800)
    }
    map.on('moveend', handler)
    return () => { map.off('moveend', handler); if (moveTimer.current) clearTimeout(moveTimer.current) }
  }, [enabled, map, fetchTraffic])

  return (
    <>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => setEnabled(!enabled)}
          style={{
            padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius-md)',
            background: enabled ? 'var(--primary-container)' : 'rgba(255,255,255,0.8)',
            color: enabled ? 'var(--primary)' : 'var(--text-muted)',
            border: 'none',
            transition: 'all 0.2s', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px var(--shadow-primary)',
          }}>
          <span className="material-symbols-outlined" style={{fontSize: 14, verticalAlign: 'middle'}}>traffic</span> Traffic {enabled ? 'ON' : 'OFF'} {loading ? '...' : congestion ? `(${congestion})` : ''}
        </button>
      </div>
      {enabled && roads.map((road, i) => (
        <Polyline
          key={`tr-${i}`}
          positions={road.geometry.coordinates.map(c => [c[1], c[0]] as [number, number])}
          pathOptions={{
            color: road.properties.color,
            weight: road.properties.highway === 'motorway' || road.properties.highway === 'trunk' ? 4 : road.properties.highway === 'primary' || road.properties.highway === 'secondary' ? 3 : 2,
            opacity: road.properties.highway === 'motorway' || road.properties.highway === 'trunk' ? 0.8 : 0.5,
          }}
        />
      ))}
    </>
  )
}

function getPlaceMaterialIcon(placeType: string): string {
  const icons: Record<string, string> = {
    mall: 'local_mall', hospital: 'local_hospital', airport: 'flight',
    railway_station: 'train', bus_stand: 'directions_bus', park: 'park',
    it_hub: 'business_center', metro_station: 'subway', bus_stop: 'directions_bus',
    atm: 'account_balance', bank: 'account_balance', restaurant: 'restaurant',
    hotel: 'hotel', lodge: 'lodging', temple: 'temple_hindu', mosque: 'mosque',
    church: 'church', school: 'school', petrol_pump: 'local_gas_station',
    charging_station: 'ev_station', police_station: 'local_police', cafe: 'local_cafe',
    clinic: 'local_hospital', pharmacy: 'local_pharmacy', supermarket: 'local_grocery_store',
    gym: 'fitness_center', library: 'local_library', cinema: 'theater_comedy',
    post_office: 'mark_as_unread', place: 'location_on',
  }
  return icons[placeType] || 'location_on'
}

export default function MapView({
  center, selectedPlace, userLocation, sourceLocation,
  destLocation, mapRef, allMarkers, onMarkerClick,
  routeGeometry, onMapClick, newsItems, waypoints,
  liveTrackingPos, trackingActive,
}: MapViewProps) {
  const userIcon = useMemo(() => createColoredPin('var(--primary)', 'my_location', 32, true), [])
  const sourceIcon = useMemo(() => createColoredPin('var(--secondary)', 'trip_origin', 28), [])
  const destIcon = useMemo(() => createColoredPin('var(--error)', 'location_on', 28), [])

  const polylineColors: Record<string, string> = {
    metro: '#22c55e', metro_interchange: '#059669',
    walk: '#94a3b8', walk_to_bus: '#94a3b8', walk_to_metro: '#94a3b8',
    walk_from_bus: '#94a3b8', walk_from_metro: '#94a3b8',
    bus_ordinary: '#3b82f6', bus_ac_vajra: '#8b5cf6',
    car: '#f97316', driving: '#f97316',
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <MapController center={center} mapRef={mapRef} onMapClick={onMapClick} />
      <TrafficLayer />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polylines - white outline */}
      {routeGeometry?.map((rg, i) => {
        const coords = rg.coordinates.map(c => [c[0], c[1]] as [number, number])
        const isMain = rg.type === 'route'
        const isWalk = rg.label?.toLowerCase().includes('walk') || rg.dashArray === '8, 6'
        const w = rg.weight || (rg.type === 'hover' ? 7 : isMain ? 6 : 4)
        return (
          <Polyline
            key={`route-outline-${i}`}
            positions={coords}
            pathOptions={{
              color: '#ffffff',
              weight: w + (isMain ? 4 : 2),
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )
      })}
      {/* Route polylines - colored fill (solid for transit, dashed for walking) */}
      {routeGeometry?.filter(rg => rg.type !== 'stop').map((rg, i) => {
        const coords = rg.coordinates.map(c => [c[0], c[1]] as [number, number])
        const isMain = rg.type === 'route'
        const isWalk = rg.label?.toLowerCase().includes('walk') || rg.dashArray === '10, 6'
        const w = rg.weight || (rg.type === 'hover' ? 7 : isMain ? 6 : 4)
        return (
          <Polyline
            key={`route-color-${i}`}
            positions={coords}
            pathOptions={{
              color: rg.color,
              weight: w,
              opacity: rg.type === 'hover' ? 0.95 : 0.85,
              dashArray: isWalk ? '10, 6' : rg.dashArray,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )
      })}

      {/* Transit stop markers */}
      {routeGeometry?.filter(rg => rg.type === 'stop').map((rg, i) => (
        <CircleMarker key={`stop-${i}`}
          center={[rg.coordinates[0][0], rg.coordinates[0][1]]}
          radius={6}
          pathOptions={{ color: '#22c55e', fillColor: '#22c55e33', fillOpacity: 0.6, weight: 2 }}
        >
          {rg.label && <Popup>{rg.label}</Popup>}
        </CircleMarker>
      ))}

      {/* News affected-area markers */}
      {newsItems?.map((item, i) => {
        if (!item.lat || !item.lng) return null
        const bgColor = item.impact === 'negative' ? 'var(--error)' : item.impact === 'positive' ? 'var(--secondary)' : 'var(--primary)'
        const iconName = item.impact === 'negative' ? 'warning' : item.impact === 'positive' ? 'check_circle' : 'info'
        return (
          <Marker
            key={`news-${i}`}
            position={[item.lat, item.lng]}
            icon={L.divIcon({
              className: '',
              html: `<span class="material-symbols-outlined" style="font-size:18px;color:${bgColor};filter:drop-shadow(0 0 6px ${bgColor})">${iconName}</span>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>
              <div style={{ fontFamily: 'var(--font)', minWidth: 160 }}>
                <strong>{item.title}</strong><br />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description}</span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{item.timestamp}</div>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {userLocation && !trackingActive && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>
            <div style={{ fontFamily: 'var(--font)' }}>
              <strong>Your Location</strong><br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </span>
            </div>
          </Popup>
        </Marker>
      )}

      {liveTrackingPos && (
        <Marker position={liveTrackingPos} icon={createColoredPin('var(--secondary)', 'radio_button_checked', 36, true)}>
          <Popup>
            <div style={{ fontFamily: 'var(--font)' }}>
              <strong>Live Position</strong><br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {liveTrackingPos[0].toFixed(4)}, {liveTrackingPos[1].toFixed(4)}
              </span><br />
              <span style={{ fontSize: 11, color: 'var(--secondary)' }}>Tracking active</span>
            </div>
          </Popup>
        </Marker>
      )}

      {sourceLocation && (
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
        const iconName = getPlaceMaterialIcon(place.place_type)
        const isSelected = selectedPlace &&
          Math.abs(place.lat - selectedPlace.lat) < 0.001 &&
          Math.abs(place.lng - selectedPlace.lng) < 0.001

        const icon = L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;gap:2px;font-size:${isSelected ? 34 : 24}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
            <span class="material-symbols-outlined" style="font-size:${isSelected ? 14 : 10}px;color:${isGood ? 'var(--secondary)' : 'var(--error)'}">${isGood ? 'check_circle' : 'cancel'}</span>
            <span class="material-symbols-outlined" style="font-size:${isSelected ? 22 : 16}px">${iconName}</span>
          </div>`,
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
              <div style={{ fontFamily: 'var(--font)', minWidth: 180 }}>
                <strong>{place.name}</strong><br />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{place.address}</span>
                <div style={{ marginTop: 6, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span><span className="material-symbols-outlined" style={{fontSize:12, verticalAlign:'middle'}}>star</span> {place.rating?.toFixed(1) || 'N/A'}</span>
                  <span><span className="material-symbols-outlined" style={{fontSize:12, verticalAlign:'middle'}}>verified</span> {((place.reliability_score || 0.5) * 100).toFixed(0)}%</span>
                </div>
                {place.review_summary && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {place.review_summary}
                  </div>
                )}
                {place.price_info && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                    <span className="material-symbols-outlined" style={{fontSize:12, verticalAlign:'middle'}}>payments</span> {place.price_info}
                  </div>
                )}
                <button
                  onClick={() => onMarkerClick?.(place)}
                  style={{
                    marginTop: 8, padding: '6px 14px',
                    background: 'var(--primary)', color: 'var(--on-primary)',
                    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    boxShadow: '0 2px 8px var(--shadow-primary)',
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
            html: `<span class="material-symbols-outlined" style="font-size:32px;color:var(--primary);filter:drop-shadow(0 2px 8px var(--shadow-primary))">${getPlaceMaterialIcon(selectedPlace.place_type)}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          })}
        >
          <Popup>
            <div style={{ fontFamily: 'var(--font)' }}>
              <strong>{selectedPlace.name}</strong><br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPlace.address}</span>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Waypoint markers (multi-stop) */}
      {waypoints?.map((wp, i) => (
        <Marker
          key={`wp-${i}`}
          position={[wp.lat, wp.lng]}
          icon={L.divIcon({
            className: '',
            html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px">
              <span class="material-symbols-outlined" style="font-size:24px;color:#f59e0b;filter:drop-shadow(0 2px 6px rgba(245,158,11,0.8))">radio_button_checked</span>
              <span style="position:absolute;top:-2px;right:-4px;background:#f59e0b;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;line-height:14px;min-width:16px;text-align:center">${i+1}</span>
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 28],
          })}
        >
          <Popup>
            <div style={{ fontFamily: 'var(--font)' }}>
              <strong>Stop {i + 1}</strong><br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wp.query || `Waypoint ${i + 1}`}</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}