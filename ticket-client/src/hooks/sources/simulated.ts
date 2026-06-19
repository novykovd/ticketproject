import type { GpsObservation, GpsSourceFactory } from '../useGpsSource'

// Simulates movement through the Bratislava GTFS service area.
// Starts at a random point near the city centre, picks a random heading,
// and walks in a gently curving path — realistic enough to exercise the matcher.
const CENTRE = { lat: 48.1486, lon: 17.1077 }
const SPREAD = 0.04        // ~4 km spread around centre
const STEP   = 0.0008      // ~90 m per step (matches typical GTFS segment length)

export const simulatedSource: GpsSourceFactory = (onObservation, intervalMs) => {
    let pos = {
        lat: CENTRE.lat + (Math.random() - 0.5) * SPREAD,
        lon: CENTRE.lon + (Math.random() - 0.5) * SPREAD,
    }
    let headingRad = Math.random() * Math.PI * 2

    const id = setInterval(() => {
        // Drift heading slightly each step to trace a curve, not a straight line
        headingRad += (Math.random() - 0.5) * 0.15

        const next = {
            lat: pos.lat + Math.cos(headingRad) * STEP,
            // Longitude degrees are shorter at this latitude (~0.665× at 48°N)
            lon: pos.lon + Math.sin(headingRad) * STEP * 0.665,
        }

        onObservation({ from: pos, to: next })
        pos = next
    }, intervalMs)

    return () => clearInterval(id)
}
