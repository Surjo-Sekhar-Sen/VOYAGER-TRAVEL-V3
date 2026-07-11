export interface PlaceResult {
  name: string
  address?: string
  lat: number
  lng: number
  place_type: string
  reliability_score?: number
  rating?: number
  review_summary?: string
  price_info?: string
  is_recommended: boolean
  distance_km?: number
  image_url?: string
  hotel_prices?: HotelPriceInfo
  reviews?: PlaceReview[]
}

export interface HotelPriceInfo {
  min_price: number
  max_price: number
  avg_price: number
  currency: string
  source: string
  review_score?: number
  brief_summary?: string
}

export interface RidePrice {
  provider: string
  mode: string
  price: number
  eta_minutes: number
  note?: string
  source?: string
}

export interface RidePriceResponse {
  status: string
  source: string
  destination: string
  prices: RidePrice[]
}

export interface RouteLeg {
  from: string
  to: string
  mode: string
  distance_km: number
  duration_minutes: number
  fare: number
  line?: string
  instructions?: string
}

export interface RouteOption {
  type: string
  total_fare: number
  total_duration_minutes: number
  total_distance_km: number
  total_walking_km: number
  overall_score: number
  legs: RouteLeg[]
  geometry?: any
}

export interface RoutePlanResponse {
  status: string
  source: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  routes: RouteOption[]
  total_options: number
  travel_insights?: string
}

export interface SearchResponse {
  status: string
  results: PlaceResult[]
  total: number
}

export interface NearbyResponse {
  status: string
  center: { lat: number; lng: number }
  radius_km: number
  results: PlaceResult[]
  total: number
}

export interface MetroStation {
  name: string
  line: string
  lat: number
  lng: number
  distance_from_prev_km?: number
}

export type AppMode = 'search' | 'atob' | 'trip'

export interface PlaceReview {
  user: string
  rating: number
  text: string
  date: string
}

export interface EnrichSingleResponse {
  status: string
  place: PlaceResult
}

export interface UserPreferences {
  budget?: number
  groupSize: number
  priority: 'cost' | 'time' | 'comfort' | 'balanced'
}
