import { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Polyline, Marker, UrlTile } from 'react-native-maps'
import type { TrackMapProps } from './types'

const PIN_COLOR: Record<string, string> = {
    ticket_inspector: 'red',
    crowding: 'gold',
}

const BRATISLAVA = {
    latitude: 48.1486,
    longitude: 17.1077,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
}

export function TrackMap({ history, reports = [] }: TrackMapProps) {
    const mapRef = useRef<MapView>(null)

    useEffect(() => {
        if (history.length === 0 || !mapRef.current) return
        const coordinates = history.flatMap(e => [
            { latitude: e.query.from.lat, longitude: e.query.from.lon },
            { latitude: e.query.to.lat,   longitude: e.query.to.lon   },
        ])
        mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
        })
    }, [history])

    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialCamera={{
                center: { latitude: BRATISLAVA.latitude, longitude: BRATISLAVA.longitude },
                pitch: 50,      // angular tilt
                heading: 0,
                zoom: 14,       // Android
                altitude: 3000, // iOS
            }}
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
                    strokeColor={i === history.length - 1 ? '#3b82f6' : '#3b82f680'}
                    strokeWidth={i === history.length - 1 ? 8 : 4}
                />
            ))}
            {history.filter(e => e.match).map((entry, i, arr) => (
                <Polyline
                    key={`match-${i}`}
                    coordinates={[
                        { latitude: entry.match!.from.lat, longitude: entry.match!.from.lon },
                        { latitude: entry.match!.to.lat, longitude: entry.match!.to.lon },
                    ]}
                    strokeColor={i === arr.length - 1 ? '#f97316' : '#f9731680'}
                    strokeWidth={i === arr.length - 1 ? 8 : 4}
                />
            ))}
            {reports.map(r => (
                <Marker
                    key={`report-${r.id}`}
                    coordinate={{ latitude: r.lat, longitude: r.lon }}
                    pinColor={PIN_COLOR[r.type] ?? 'gray'}
                    title={r.stopName ?? r.type}
                    description={r.type}
                />
            ))}
        </MapView>
    )
}
