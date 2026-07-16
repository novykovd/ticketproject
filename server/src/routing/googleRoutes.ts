// The transit-routing data source. Two modes behind one interface:
//   - live:   POST to Google Routes API computeRoutes (needs GOOGLE_MAPS_API_KEY)
//   - canned: read the saved fixture (no key, no network)
// Both return the same JSON shape, which parseTransitRoute consumes. Going live
// is just "have a key set" — no code change downstream.
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

export interface LatLng { lat: number; lon: number }

const here = dirname(fileURLToPath(import.meta.url))

export function loadFixture() {
    return JSON.parse(fs.readFileSync(join(here, 'sample-response.json'), 'utf8'))
}

export async function fetchTransitRoute(origin: LatLng, destination: LatLng) {
    const key = process.env['GOOGLE_MAPS_API_KEY']
    if (!key) throw new Error('GOOGLE_MAPS_API_KEY not set')

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            // Field mask is required by Google AND is the cost lever — we only
            // ask for (and pay for) the transit fields the parser reads.
            'X-Goog-FieldMask': 'routes.legs.steps.transitDetails',
        },
        body: JSON.stringify({
            origin:      { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
            destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
            travelMode: 'TRANSIT',
        }),
    })

    if (!res.ok) {
        throw new Error(`Routes API ${res.status}: ${await res.text()}`)
    }
    return res.json()
}

// Which data source to use. 'auto' = live when a key exists, else canned.
export type RoutesSource = 'canned' | 'live' | 'auto'

// Provider switch: an explicit arg wins, else the ROUTES_SOURCE env var, else
// 'auto'. This is why the source is a real decision, not a side effect of
// whether a key happens to be set — so you can force 'canned' at 2am even with
// a key present, and force 'live' when you actually want to test the API.
export function resolveSource(explicit?: RoutesSource): 'canned' | 'live' {
    const mode: RoutesSource = explicit ?? (process.env['ROUTES_SOURCE'] as RoutesSource) ?? 'auto'
    if (mode === 'live' || mode === 'canned') return mode
    return process.env['GOOGLE_MAPS_API_KEY'] ? 'live' : 'canned'
}

// Unified entry: picks the source via resolveSource, both modes return the same
// JSON shape for parseTransitRoute.
export async function getTransitRoute(origin: LatLng, destination: LatLng, source?: RoutesSource) {
    return resolveSource(source) === 'live'
        ? fetchTransitRoute(origin, destination)
        : loadFixture()
}
