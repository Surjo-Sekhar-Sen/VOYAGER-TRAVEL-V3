export function getModeIcon(mode: string): string {
  const icons: Record<string, string> = {
    walk: '🚶',
    bus_ordinary: '🚌',
    bus_ac_vajra: '🚍',
    metro: '🚇',
    car: '🚗',
    bike: '🏍️',
    auto: '🛺',
    cab: '🚕',
    interchange: '🔄',
    driving: '🚗',
  }
  return icons[mode] || '📍'
}

export function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    walk: 'Walk',
    bus_ordinary: 'BMTC Ordinary Bus',
    bus_ac_vajra: 'BMTC AC Vajra',
    metro: 'Namma Metro',
    car: 'Personal Car',
    bike: 'Bike',
    auto: 'Auto Rickshaw',
    cab: 'Cab/Taxi',
    interchange: 'Interchange',
    driving: 'Driving',
  }
  return labels[mode] || mode
}

export function getPlaceIcon(placeType: string, isRecommended: boolean): string {
  if (!isRecommended) return '⬜'
  const icons: Record<string, string> = {
    malls: '🛍️',
    hospitals: '🏥',
    airport: '✈️',
    railway_stations: '🚉',
    bus_stands: '🚏',
    parks: '🌳',
    it_hubs: '🏢',
    metro_stations: '🚇',
    bus_stops: '🚏',
    atm: '🏧',
    bank: '🏦',
    restaurant: '🍽️',
    hotel: '🏨',
    temple: '🛕',
    school: '📚',
    petrol_pump: '⛽',
  }
  return icons[placeType] || '📍'
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

export function getPinColor(isRecommended: boolean, score?: number): string {
  if (score !== undefined) {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    return '#ef4444'
  }
  return isRecommended ? '#22c55e' : '#ef4444'
}
