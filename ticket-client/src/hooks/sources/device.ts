import * as Location from 'expo-location'
import type { GpsObservation, GpsSourceFactory } from '../useGpsSource'

export const deviceSource: GpsSourceFactory = (onObservation) => {
    let prev: { lat: number; lon: number } | null = null
    let sub: Location.LocationSubscription | null = null

    Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status !== 'granted') {
            console.warn('Location permission denied')
            return
        }
        Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
            (loc) => {
                const curr = { lat: loc.coords.latitude, lon: loc.coords.longitude }
                if (prev) onObservation({ from: prev, to: curr })
                prev = curr
            }
        ).then(s => { sub = s })
    })

    return () => sub?.remove()
}
