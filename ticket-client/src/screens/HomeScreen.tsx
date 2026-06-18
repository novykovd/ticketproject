import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { trpc } from '../lib/trpc'
import { useGpsSource, type GpsObservation } from '../hooks/useGpsSource'

type MatchedSegment = {
    shapeId: string
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

export function HomeScreen() {
    const [lastObs,  setLastObs]  = useState<GpsObservation | null>(null)
    const [matched,  setMatched]  = useState<MatchedSegment | null>(null)
    const [matchCount, setMatchCount] = useState(0)

    const matchQuery = trpc.location.match.useMutation({
        onSuccess: data => {
            if (data.matched) {
                setMatched({ shapeId: data.shapeId, from: data.from, to: data.to })
                setMatchCount(n => n + 1)
            }
        },
    })

    const { start, stop, isActive } = useGpsSource(
        (obs: GpsObservation) => {
            setLastObs(obs)
            matchQuery.mutate({ from: obs.from, to: obs.to })
        },
        { mode: 'simulated', intervalMs: 2000 },
    )

    const toggle = () => (isActive ? stop() : start())

    return (
        <View style={s.container}>
            <Text style={s.title}>TicketProject</Text>

            <View style={s.statusRow}>
                <View style={[s.dot, isActive && s.dotActive]} />
                <Text style={s.statusText}>{isActive ? 'Tracking' : 'Idle'}</Text>
            </View>

            <View style={s.card}>
                <Text style={s.label}>GPS Observation</Text>
                {lastObs ? (
                    <>
                        <Text style={s.mono}>
                            from  {lastObs.from.lat.toFixed(5)}, {lastObs.from.lon.toFixed(5)}
                        </Text>
                        <Text style={s.mono}>
                            to    {lastObs.to.lat.toFixed(5)}, {lastObs.to.lon.toFixed(5)}
                        </Text>
                    </>
                ) : (
                    <Text style={s.dim}>—</Text>
                )}
            </View>

            <View style={s.card}>
                <Text style={s.label}>
                    Matched Route{matchCount > 0 ? ` (${matchCount})` : ''}
                </Text>
                {matchQuery.isPending ? (
                    <Text style={s.dim}>Matching…</Text>
                ) : matched ? (
                    <>
                        <Text style={s.shapeId}>{matched.shapeId}</Text>
                        <Text style={s.mono}>
                            {matched.from.lat.toFixed(5)}, {matched.from.lon.toFixed(5)}
                        </Text>
                        <Text style={s.mono}>
                            → {matched.to.lat.toFixed(5)}, {matched.to.lon.toFixed(5)}
                        </Text>
                    </>
                ) : (
                    <Text style={s.dim}>No match yet</Text>
                )}
            </View>

            <TouchableOpacity
                style={[s.button, isActive && s.buttonStop]}
                onPress={toggle}
                activeOpacity={0.8}
            >
                <Text style={s.buttonText}>{isActive ? 'Stop' : 'Start'}</Text>
            </TouchableOpacity>
        </View>
    )
}

const s = StyleSheet.create({
    container:  { flex: 1, backgroundColor: '#0f0f0f', padding: 24, paddingTop: 64 },
    title:      { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 24 },
    statusRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#444', marginRight: 8 },
    dotActive:  { backgroundColor: '#22c55e' },
    statusText: { color: '#aaa', fontSize: 14 },
    card:       { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16 },
    label:      { color: '#666', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
    mono:       { color: '#ccc', fontSize: 12, fontFamily: 'monospace' },
    dim:        { color: '#444', fontSize: 14 },
    shapeId:    { color: '#60a5fa', fontSize: 20, fontWeight: '700', marginBottom: 6 },
    button:     { backgroundColor: '#22c55e', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
    buttonStop: { backgroundColor: '#ef4444' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
