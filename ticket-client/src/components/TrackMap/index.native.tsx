import { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Polyline, UrlTile } from 'react-native-maps'
import type { TrackMapProps } from './types'

const BRATISLAVA = {
    latitude: 48.1486,
    longitude: 17.1077,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
}

export function TrackMap({ history }: TrackMapProps) {
    const mapRef = useRef<MapView>(null)

    useEffect(() => {
        if (history.length === 0 || !mapRef.current) return
        const latest = history[history.length - 1]!
        mapRef.current.animateToRegion({
            latitude: latest.query.to.lat,
            longitude: latest.query.to.lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 500)
    }, [history])

    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={BRATISLAVA}
            mapType="none"
        >
            <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
            />
            {history.map((entry, i) => (
                <Polyline
                    key={`query-${i}`}
                    coordinates={[
                        { latitude: entry.query.from.lat, longitude: entry.query.from.lon },
                        { latitude: entry.query.to.lat, longitude: entry.query.to.lon },
                    ]}
                    strokeColor={i === history.length - 1 ? '#3b82f6' : '#3b82f640'}
                    strokeWidth={i === history.length - 1 ? 5 : 2}
                />
            ))}
            {history.filter(e => e.match).map((entry, i, arr) => (
                <Polyline
                    key={`match-${i}`}
                    coordinates={[
                        { latitude: entry.match!.from.lat, longitude: entry.match!.from.lon },
                        { latitude: entry.match!.to.lat, longitude: entry.match!.to.lon },
                    ]}
                    strokeColor={i === arr.length - 1 ? '#f97316' : '#f9731640'}
                    strokeWidth={i === arr.length - 1 ? 5 : 2}
                />
            ))}
        </MapView>
    )
}
