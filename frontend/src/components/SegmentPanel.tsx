import { useState, useCallback, useRef, useEffect } from 'react'
import type { SegmentStepData, SegmentStepOption, MapRouteGeometry, PlaceResult } from '../types'
import { getSegmentStep, searchPlaces } from '../services/api'
import { getModeIcon, getModeLabel, formatDuration, formatRupees } from '../utils/helpers'

const SEGMENT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4898']
const MODE_COLORS: Record<string, string> = {
  walk: '#22c55e', cab: '#f97316', auto: '#eab308', bike: '#8b5cf6',
  bus_ordinary: '#3b82f6', bus_ac_vajra: '#60a5fa', metro: '#22c55e',
  train: '#a855f7', custom: '#f59e0b',
}

interface ColumnCard {
  stageIdx: number
  fromName: string
  fromLat?: number
  fromLng?: number
  options: (SegmentStepOption & { _viaIndex?: number; _stopName?: string })[]
  label: string
  type: 'reach' | 'from' | 'direct'
  selectedOption?: SegmentStepOption
}

interface SegmentPanelProps {
  sourceLocation: [number, number]
  destLocation: [number, number]
  sourceName: string
  destName: string
  groupSize: number
  budget?: number
  onClose: () => void
  onGeometryChange: (geometry: MapRouteGeometry[]) => void
  onSizeChange?: (width: number) => void
}

export default function SegmentPanel({
  sourceLocation, destLocation, sourceName, destName,
  groupSize, budget, onClose, onGeometryChange, onSizeChange,
}: SegmentPanelProps) {
  const [segmentStep, setSegmentStep] = useState<SegmentStepData | null>(null)
  const [segmentLoading, setSegmentLoading] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<SegmentStepOption | null>(null)
  const [builtPath, setBuiltPath] = useState<SegmentStepOption[]>([])
  const [columns, setColumns] = useState<ColumnCard[]>([])
  const [currentFromName, setCurrentFromName] = useState(sourceName)
  const [phase, setPhase] = useState<'init' | 'from' | 'direct'>('init')

  const [customInput, setCustomInput] = useState('')
  const [customSuggestions, setCustomSuggestions] = useState<PlaceResult[]>([])
  const [customLoading, setCustomLoading] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [selectedColIndex, setSelectedColIndex] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchStepFrom = useCallback(async (fromLat: number, fromLng: number, fromName: string) => {
    setSegmentLoading(true)
    setHoveredOption(null)
    setPhase('init')
    try {
      const res = await getSegmentStep(
        fromLat, fromLng, fromName,
        destLocation[0], destLocation[1], destName,
        groupSize, budget
      )
      if (res.step) setSegmentStep(res.step)
    } catch { /* ignore */ }
    setSegmentLoading(false)
  }, [destLocation, destName, groupSize, budget])

  const handleStartBuilding = useCallback(() => {
    setBuiltPath([])
    setColumns([])
    setCurrentFromName(sourceName)
    setSegmentStep(null)
    setSelectedColIndex(null)
    setPhase('init')
    fetchStepFrom(sourceLocation[0], sourceLocation[1], sourceName)
  }, [sourceLocation, sourceName, fetchStepFrom])

  useEffect(() => { handleStartBuilding() }, [handleStartBuilding])

  // Build columns from segmentStep
  useEffect(() => {
    if (!segmentStep || segmentLoading || phase === 'from') return

    const cols: ColumnCard[] = []

    // Column 0: Direct options
    if (segmentStep.direct_options.length > 0) {
      cols.push({
        stageIdx: 0,
        fromName: currentFromName,
        options: segmentStep.direct_options.map(o => ({ ...o, _stopName: destName })),
        label: '🏁 Direct to Destination',
        type: 'direct',
      })
    }

    // Columns for each via stop: show reach options
    segmentStep.via_stops.forEach((vs, si) => {
      const segColor = si < SEGMENT_COLORS.length ? SEGMENT_COLORS[si] : '#94a3b8'
      if (vs.reach_options.length > 0) {
        cols.push({
          stageIdx: si,
          fromName: currentFromName,
          options: vs.reach_options.map(o => ({ ...o, _viaIndex: si, _stopName: vs.stop.name })),
          label: `🚏 ${vs.stop.type === 'metro' ? '🚇' : vs.stop.type === 'railway' ? '🚆' : '🚌'} ${vs.stop.name}`,
          type: 'reach',
        })
      }
    })

    setColumns(cols)
  }, [segmentStep, segmentLoading, phase, currentFromName])

  // Phase 1: User picked a reach_option → show from_stop_options in a new column
  const handlePickReach = useCallback((vi: number, opt: SegmentStepOption, fromStep: SegmentStepData) => {
    const vs = fromStep.via_stops[vi]
    setBuiltPath(prev => [...prev, opt])
    setCurrentFromName(opt.to)
    setHoveredOption(null)
    setPhase('from')

    // Mark this option as selected in existing column
    setColumns(prev => prev.map(c => {
      if (c.stageIdx === vi && c.type === 'reach') {
        return { ...c, selectedOption: opt }
      }
      return c
    }))

    // Add new column for from_stop_options
    const newCol: ColumnCard = {
      stageIdx: vi,
      fromName: vs.stop.name,
      fromLat: vs.stop.lat,
      fromLng: vs.stop.lng,
      options: vs.from_stop_options.map(o => ({ ...o, _stopName: destName })),
      label: `🚀 From ${vs.stop.name}`,
      type: 'from',
    }
    setColumns(prev => [...prev, newCol])
    setSelectedColIndex(columns.length)
  }, [columns])

  // Phase 2: User picked a from_option
  const handlePickFrom = useCallback((opt: SegmentStepOption, colIdx: number) => {
    setBuiltPath(prev => [...prev, opt])
    setHoveredOption(null)
    setPhase('init')

    // Mark as selected
    setColumns(prev => prev.map((c, i) => i === colIdx ? { ...c, selectedOption: opt } : c))

    if (opt.arrives_at_stop && opt.to_lat && opt.to_lng) {
      setCurrentFromName(opt.to)
      fetchStepFrom(opt.to_lat, opt.to_lng, opt.to)
    } else {
      setCurrentFromName(opt.to)
      setSegmentStep(null)
      setPhase('direct')
    }
    setSelectedColIndex(null)
  }, [fetchStepFrom])

  // Direct option picked
  const handlePickDirect = useCallback((opt: SegmentStepOption) => {
    setBuiltPath(prev => [...prev, opt])
    setHoveredOption(null)
    setCurrentFromName(destName)
    setSegmentStep(null)
    setPhase('direct')
    // Mark in column
    setColumns(prev => prev.map(c => {
      if (c.type === 'direct' && !c.selectedOption) return { ...c, selectedOption: opt }
      return c
    }))
  }, [destName])

  const handleAddCustomWaypoint = useCallback((place: PlaceResult) => {
    const customOpt: SegmentStepOption = {
      mode: 'custom', label: `${place.name}`, icon: '📍',
      from: currentFromName, to: place.name,
      distance_km: 0, duration_minutes: 0, fare: 0, per_person: 0,
      arrives_at_stop: true,
      from_lat: segmentStep?.from.lat || sourceLocation[0],
      from_lng: segmentStep?.from.lng || sourceLocation[1],
      to_lat: place.lat, to_lng: place.lng,
    }
    setBuiltPath(prev => [...prev, customOpt])
    setCurrentFromName(place.name)
    setCustomInput('')
    setCustomSuggestions([])
    setShowCustomInput(false)
    setPhase('init')
    setColumns([])
    setSelectedColIndex(null)
    fetchStepFrom(place.lat, place.lng, place.name)
  }, [currentFromName, segmentStep, sourceLocation, fetchStepFrom])

  const handleCustomInput = useCallback(async (value: string) => {
    setCustomInput(value)
    if (value.length < 2) { setCustomSuggestions([]); return }
    if (abortRef.current) abortRef.current.abort()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setCustomLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const data = await searchPlaces(value, destLocation[0], destLocation[1], ctrl.signal)
        if (!ctrl.signal.aborted) setCustomSuggestions((data.results || []).slice(0, 5))
      } catch { if (ctrl.signal.aborted) return; setCustomSuggestions([]) }
      finally { setCustomLoading(false) }
    }, 300)
  }, [destLocation])

  const totalFare = builtPath.reduce((sum, s) => sum + (s.fare || 0), 0)
  const totalDuration = builtPath.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const totalDistance = builtPath.reduce((sum, s) => sum + (s.distance_km || 0), 0)
  const isComplete = phase === 'direct' && builtPath.length > 0

  // Build map geometry
  useEffect(() => {
    const geo: MapRouteGeometry[] = []

    builtPath.forEach((opt, idx) => {
      const color = idx < SEGMENT_COLORS.length ? SEGMENT_COLORS[idx] : '#94a3b8'
      const p = opt.path
      if (p && p.length >= 2) {
        geo.push({ type: 'segment', coordinates: p as [number, number][], color, weight: 4, label: `${getModeLabel(opt.mode)}: ${opt.distance_km}km` })
      } else if (opt.from_lat && opt.from_lng && opt.to_lat && opt.to_lng) {
        geo.push({ type: 'segment', coordinates: [[opt.from_lat, opt.from_lng], [opt.to_lat, opt.to_lng]], color, weight: 4, label: `${getModeLabel(opt.mode)}: ${opt.distance_km}km` })
      }
      if (opt.to_lat && opt.to_lng) {
        geo.push({ type: 'stop', coordinates: [[opt.to_lat, opt.to_lng]] as [number, number][], color, label: opt.to })
      }
    })

    if (hoveredOption) {
      const hp = hoveredOption.path
      if (hp && hp.length >= 2) {
        geo.push({ type: 'hover', coordinates: hp as [number, number][], color: '#fbbf24', weight: 6, label: `${getModeLabel(hoveredOption.mode)}: ${hoveredOption.distance_km}km` })
      } else if (hoveredOption.from_lat && hoveredOption.from_lng && hoveredOption.to_lat && hoveredOption.to_lng) {
        geo.push({ type: 'hover', coordinates: [[hoveredOption.from_lat, hoveredOption.from_lng], [hoveredOption.to_lat, hoveredOption.to_lng]], color: '#fbbf24', weight: 6, label: `${getModeLabel(hoveredOption.mode)}: ${hoveredOption.distance_km}km` })
      }
    }

    // Show all reachable stops
    columns.forEach(c => {
      if (c.type === 'reach' && !c.selectedOption && c.options.length > 0) {
        geo.push({
          type: 'stop',
          coordinates: [[c.options[0].to_lat || 0, c.options[0].to_lng || 0]] as [number, number][],
          color: '#3b82f6',
          label: `🚏 ${c.label}`,
        })
      }
    })

    onGeometryChange(geo)
  }, [builtPath, hoveredOption, columns, onGeometryChange])

  const optCardStyle = (opt: SegmentStepOption, isSelected?: boolean): React.CSSProperties => ({
    padding: '8px 10px',
    background: isSelected ? '#0f2d1a' : (opt.mode === 'walk' ? '#0f2d1a' : '#1a2332'),
    border: `1px solid ${isSelected ? '#22c55e' : MODE_COLORS[opt.mode] || '#334155'}`,
    borderRadius: 8,
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: 10,
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.15s',
    borderLeft: `4px solid ${MODE_COLORS[opt.mode] || '#64748b'}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  })

  const renderOptionDetail = (opt: SegmentStepOption, idx: number) => {
    const rn = (opt as any).route_numbers
    const busTimes = (opt as any).bus_times
    const subLegs = (opt as any).sub_legs
    const tn = (opt as any).train_number
    const dep = (opt as any).departure_time || (opt as any).departure
    const arr = (opt as any).arrival_time || (opt as any).arrival

    return (
      <div key={idx}>
        {/* Icon + Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>{opt.icon || getModeIcon(opt.mode)}</span>
          <span style={{ fontWeight: 600, fontSize: 11, color: '#e2e8f0' }}>{opt.label || getModeLabel(opt.mode)}</span>
          {rn && rn.length > 0 && (
            <span style={{ fontSize: 8, color: '#60a5fa', background: '#1e3a5f', padding: '1px 4px', borderRadius: 3 }}>
              {rn.slice(0, 3).join(', ')}
            </span>
          )}
          {tn && <span style={{ fontSize: 8, color: '#a855f7' }}>#{tn}</span>}
        </div>

        {/* Route info */}
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {dep && arr && <span style={{ color: '#a855f7' }}>🕐 {dep}→{arr}</span>}
          <span>{formatDuration(opt.duration_minutes)}</span>
          <span>{opt.distance_km.toFixed(2)}km</span>
          <span style={{ color: '#fbbf24' }}>{formatRupees(opt.fare)} {opt.per_person ? `(${formatRupees(opt.per_person)}/pp)` : ''}</span>
        </div>

        {/* Bus timings */}
        {busTimes && busTimes.length > 0 && (
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>
            ⏰ Next buses: {busTimes.slice(0, 4).map((bt: any) => bt.departure_time).join(', ')}
          </div>
        )}

        {/* Sub legs */}
        {subLegs && subLegs.length > 0 && (
          <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
            {subLegs.map((sl: any, si: number) => (
              <span key={si}>
                {getModeIcon(sl.mode)} {sl.from}→{sl.to}
                {sl.fare ? ` ₹${sl.fare}` : ''}
                {si < subLegs.length - 1 ? ' + ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={panelRef} style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      maxHeight: '65vh', background: '#0f172a',
      borderTop: '2px solid #3b82f6', borderRadius: '16px 16px 0 0',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* === HEADER === */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid #1e293b',
        borderRadius: '16px 16px 0 0', background: '#1a2332',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>🔧 Segment Builder</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>📍 {sourceName} → 🏁 {destName}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {builtPath.length > 0 && (
            <button onClick={handleStartBuilding} style={{
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 4, color: '#94a3b8', cursor: 'pointer',
              fontSize: 10, padding: '2px 8px',
            }}>🔄 Reset</button>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#94a3b8',
            fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* === TIMELINE === */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid #1e293b',
        overflowX: 'auto', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '2px solid #60a5fa' }}>📍</div>
            <span style={{ color: '#e2e8f0', fontSize: 7, marginTop: 1, maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceName.slice(0, 6)}</span>
          </div>
          {builtPath.map((opt, idx) => {
            const color = idx < SEGMENT_COLORS.length ? SEGMENT_COLORS[idx] : '#94a3b8'
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <div style={{ width: 14, height: 2, background: color }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1e293b', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                    {opt.icon || getModeIcon(opt.mode)}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 7, marginTop: 1, maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.to.length > 6 ? opt.to.slice(0, 6) + '..' : opt.to}</span>
                  <span style={{ color: '#fbbf24', fontSize: 7 }}>{formatDuration(opt.duration_minutes)}</span>
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <div style={{ width: 14, height: 2, background: isComplete ? '#22c55e' : '#334155' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: isComplete ? '#0f2d1a' : '#1e293b', border: isComplete ? '2px solid #22c55e' : '2px dashed #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🏁</div>
              <span style={{ color: isComplete ? '#22c55e' : '#64748b', fontSize: 7, marginTop: 1, fontWeight: isComplete ? 700 : 400 }}>{destName.length > 6 ? destName.slice(0, 6) + '..' : destName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === SUMMARY BAR === */}
      {builtPath.length > 0 && (
        <div style={{
          display: 'flex', gap: 10, padding: '4px 14px', background: '#1a2332',
          borderBottom: '1px solid #1e293b', fontSize: 9, color: '#94a3b8', flexShrink: 0,
        }}>
          <span>💰 <strong style={{ color: '#fbbf24' }}>{formatRupees(totalFare)}</strong></span>
          <span>⏱️ <strong style={{ color: '#e2e8f0' }}>{formatDuration(totalDuration)}</strong></span>
          <span>📏 <strong style={{ color: '#e2e8f0' }}>{totalDistance.toFixed(1)}km</strong></span>
          <span style={{ fontSize: 8, color: '#64748b' }}>{builtPath.length} step{builtPath.length !== 1 ? 's' : ''}</span>
          {isComplete && <span style={{ color: '#22c55e', marginLeft: 'auto', fontWeight: 700 }}>✅ Journey Complete!</span>}
        </div>
      )}

      {/* === SCROLLABLE COLUMNS === */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '8px 14px' }}>
        {segmentLoading && (
          <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 12 }}>⏳ Loading options...</div>
        )}

        {!segmentLoading && columns.length === 0 && builtPath.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 12 }}>Loading initial options...</div>
        )}

        {/* Columns layout */}
        {columns.length > 0 && !segmentLoading && (
          <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', overflowY: 'visible',
            paddingBottom: 4,
          }}>
            {columns.map((col, colIdx) => {
              const isNext = colIdx > 0 && !columns[colIdx - 1].selectedOption
              if (isNext) return null

              return (
                <div key={colIdx} style={{
                  minWidth: 260, maxWidth: 320,
                  background: '#131e2b',
                  borderRadius: 10,
                  border: `1px solid ${col.selectedOption ? '#22c55e' : '#334155'}`,
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column',
                  maxHeight: '100%',
                }}>
                  {/* Column header */}
                  <div style={{
                    padding: '8px 10px',
                    background: col.selectedOption ? '#0f2d1a' : '#1a2332',
                    borderRadius: '10px 10px 0 0',
                    borderBottom: `1px solid ${col.selectedOption ? '#22c55e' : '#1e293b'}`,
                    fontSize: 10, fontWeight: 700, color: col.selectedOption ? '#22c55e' : '#e2e8f0',
                    display: 'flex', alignItems: 'center', gap: 4,
                    flexShrink: 0,
                  }}>
                    <span>{col.selectedOption ? '✅' : '⬜'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
                    {col.fromName && (
                      <span style={{ fontSize: 8, color: '#64748b', marginLeft: 'auto' }}>
                        📍{col.fromName.slice(0, 12)}
                      </span>
                    )}
                  </div>

                  {/* Options list */}
                  <div style={{
                    padding: '6px 8px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {col.selectedOption ? (
                      <div style={optCardStyle(col.selectedOption, true)}>
                        {renderOptionDetail(col.selectedOption, 0)}
                      </div>
                    ) : (
                      col.options.length > 0 ? (
                        col.options.map((opt, oi) => (
                          <button key={oi}
                            onClick={() => {
                              if (col.type === 'direct') handlePickDirect(opt)
                              else if (col.type === 'reach') handlePickReach(col.stageIdx, opt, segmentStep!)
                              else if (col.type === 'from') handlePickFrom(opt, colIdx)
                            }}
                            onMouseEnter={() => setHoveredOption(opt)}
                            onMouseLeave={() => setHoveredOption(null)}
                            style={optCardStyle(opt)}
                          >
                            {renderOptionDetail(opt, oi)}
                          </button>
                        ))
                      ) : (
                        <div style={{ fontSize: 10, color: '#64748b', padding: 8, textAlign: 'center' }}>
                          No options available
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* === BUILT PATH FULL DISPLAY === */}
        {builtPath.length > 0 && isComplete && (
          <div style={{ marginTop: 8, padding: 10, background: '#1a2332', borderRadius: 8, border: '1px solid #22c55e' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>✅ Full Journey Path</div>
            {builtPath.map((opt, idx) => {
              const color = idx < SEGMENT_COLORS.length ? SEGMENT_COLORS[idx] : '#94a3b8'
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                  marginBottom: 4, background: '#0f172a', borderRadius: 6,
                  borderLeft: `4px solid ${color}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, minWidth: 20 }}>S{idx + 1}</div>
                  <div style={{ fontSize: 12, marginTop: -2 }}>{opt.icon || getModeIcon(opt.mode)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 500 }}>
                      {opt.from} → {opt.to}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{opt.label || getModeLabel(opt.mode)}</span>
                      <span>⏱️ {formatDuration(opt.duration_minutes)}</span>
                      <span>📏 {opt.distance_km.toFixed(2)}km</span>
                      <span>💰 {formatRupees(opt.fare)}</span>
                      {(opt as any).route_numbers && (
                        <span style={{ color: '#60a5fa' }}>🚌 [{(opt as any).route_numbers.join(', ')}]</span>
                      )}
                      {(opt as any).train_number && (
                        <span style={{ color: '#a855f7' }}>🚆 #{(opt as any).train_number}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* === CUSTOM STOP === */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 4, flexShrink: 0 }}>
          {!showCustomInput ? (
            <button onClick={() => setShowCustomInput(true)} style={{
              flex: 1, padding: '8px', background: '#1e293b',
              border: '1px dashed #475569', borderRadius: 6, color: '#94a3b8',
              cursor: 'pointer', fontSize: 11,
            }}>
              ➕ Add Custom Stop
            </button>
          ) : (
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="text" placeholder="Search a place to stop at..." value={customInput}
                onChange={(e) => handleCustomInput(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #475569',
                  borderRadius: 6, background: '#1e293b', color: '#e2e8f0', outline: 'none',
                }} />
              {customLoading && <div style={{ padding: '4px 10px', fontSize: 10, color: '#64748b' }}>Searching...</div>}
              {!customLoading && customSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#1e293b', border: '1px solid #475569', borderRadius: 6, marginTop: 2,
                  maxHeight: 160, overflowY: 'auto',
                }}>
                  {customSuggestions.map((place, i) => (
                    <div key={i} onClick={() => handleAddCustomWaypoint(place)}
                      style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: '#cbd5e1', borderBottom: '1px solid #334155' }}>
                      {getModeIcon(place.place_type)} {place.name}
                      <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{place.address?.slice(0, 30)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
