export function getModeIcon(mode: string): string {
  const icons: Record<string, string> = {
    walk: '🚶',
    walk_to_bus: '🚶➡️🚌',
    walk_to_metro: '🚶➡️🚇',
    walk_from_bus: '🚌➡️🚶',
    walk_from_metro: '🚇➡️🚶',
    bus_ordinary: '🚌',
    bus_ac_vajra: '🚍',
    metro: '🚇',
    metro_interchange: '🔀🚇',
    car: '🚗',
    bike: '🏍️',
    auto: '🛺',
    cab: '🚕',
    cab_economy: '🚕',
    cab_premium: '🚙',
    bike_taxi: '🏍️',
    interchange: '🔄',
    driving: '🚗',
    kia_bus: '🚍',
    bus_to_metro: '🚌➡️🚇',
    metro_to_bus: '🚇➡️🚌',
  }
  return icons[mode] || '📍'
}

export function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    walk: 'Walk',
    walk_to_bus: 'Walk to Bus Stop',
    walk_to_metro: 'Walk to Metro',
    walk_from_bus: 'Walk from Bus Stop',
    walk_from_metro: 'Walk from Metro',
    bus_ordinary: 'BMTC Ordinary Bus',
    bus_ac_vajra: 'BMTC AC Vajra',
    metro: 'Namma Metro',
    metro_interchange: 'Metro (Interchange)',
    car: 'Personal Car',
    bike: 'Bike',
    auto: 'Auto Rickshaw',
    cab: 'Cab/Taxi',
    cab_economy: 'Cab Economy',
    cab_premium: 'Cab Premium',
    bike_taxi: 'Bike Taxi',
    interchange: 'Interchange',
    driving: 'Driving',
    kia_bus: 'KIA Vayu Vajra',
    bus_to_metro: 'Bus → Metro',
    metro_to_bus: 'Metro → Bus',
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
  if (!minutes || minutes < 0) return '0 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

export function formatRupees(amount: number): string {
  if (!amount && amount !== 0) return '₹0'
  return `₹${amount.toFixed(2)}`
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Poor'
  return 'Avoid'
}

export function getPinColor(isRecommended: boolean, score?: number): string {
  if (score !== undefined) {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    return '#ef4444'
  }
  return isRecommended ? '#22c55e' : '#ef4444'
}
