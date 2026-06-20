import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { trpc } from '../lib/trpc'
import { useGpsSource } from '../hooks/useGpsSource'
import { TrackMap } from '../components/TrackMap'
import type { Entry } from '../components/TrackMap/types'

const MAX_HISTORY = 40
const BAR_HEIGHT = 56

function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
    const deg = Math.atan2(to.lon - from.lon, to.lat - from.lat) * (180 / Math.PI)
    return ((deg % 360) + 360) % 360
}

function fmt(n: number) { return n.toFixed(5) }

export function MapScreen() {
    const [history, setHistory] = useState<Entry[]>([])

    const mutation = trpc.location.match.useMutation({
        onSuccess(data, variables) {
            const entry: Entry = {
                query: variables,
                match: data.matched
                    ? { shapeId: data.shapeId, from: data.from, to: data.to }
                    : null,
            }
            setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), entry])
        },
    })

    const { start, stop, isActive } = useGpsSource(
        obs => mutation.mutate({ from: obs.from, to: obs.to }),
        { mode: 'simulated', intervalMs: 1500 },
    )

    const latest = history[history.length - 1] ?? null

    return (
        <View style={s.root}>
            <View style={s.mapArea}>
                <TrackMap history={history} />

                <View style={s.hudContainer} pointerEvents="none">
                    <View style={s.hud}>
                        <Text style={s.hudLabel}>QUERY</Text>
                        {latest ? <>
                            <Text style={s.hudRow}><Text style={s.hudKey}>from  </Text><Text style={s.hudVal}>{fmt(latest.query.from.lat)}, {fmt(latest.query.from.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>to    </Text><Text style={s.hudVal}>{fmt(latest.query.to.lat)}, {fmt(latest.query.to.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>hdg   </Text><Text style={s.hudVal}>{bearing(latest.query.from, latest.query.to).toFixed(1)}°</Text></Text>
                        </> : <Text style={s.hudDim}>—</Text>}
                        <View style={s.hudDivider} />
                        <Text style={[s.hudLabel, { color: '#f97316' }]}>MATCH</Text>
                        {latest?.match ? <>
                            <Text style={s.hudRow}><Text style={s.hudKey}>shape </Text><Text style={[s.hudVal, { color: '#f97316' }]}>{latest.match.shapeId}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>from  </Text><Text style={s.hudVal}>{fmt(latest.match.from.lat)}, {fmt(latest.match.from.lon)}</Text></Text>
                            <Text style={s.hudRow}><Text style={s.hudKey}>to    </Text><Text style={s.hudVal}>{fmt(latest.match.to.lat)}, {fmt(latest.match.to.lon)}</Text></Text>
                        </> : <Text style={s.hudDim}>{latest ? 'no match' : '—'}</Text>}
                    </View>
                </View>
            </View>

            <View style={s.bar}>
                <View style={s.legend}>
                    <View style={[s.swatch, { backgroundColor: '#3b82f6' }]} />
                    <Text style={s.legendText}>query vector</Text>
                    <View style={[s.swatch, { backgroundColor: '#f97316', marginLeft: 16 }]} />
                    <Text style={s.legendText}>matched segment</Text>
                </View>
                <TouchableOpacity style={[s.btn, isActive && s.btnStop]} onPress={isActive ? stop : start} activeOpacity={0.8}>
                    <Text style={s.btnText}>{isActive ? 'Stop' : 'Start'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const s = StyleSheet.create({
    root:        { flex: 1, backgroundColor: '#0f0f0f', flexDirection: 'column' },
    mapArea:     { flex: 1, position: 'relative' },
    hudContainer:{ position: 'absolute', top: 12, right: 12, zIndex: 1 },
    hud: {
        backgroundColor: 'rgba(10,10,10,0.85)',
        borderRadius: 8, padding: 12, minWidth: 240,
        borderWidth: 1, borderColor: '#2a2a2a',
    },
    hudDivider:  { height: 1, backgroundColor: '#2a2a2a', marginVertical: 8 },
    hudLabel:    { color: '#3b82f6', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    hudRow:      { fontSize: 11, fontFamily: 'monospace' },
    hudKey:      { color: '#555' },
    hudVal:      { color: '#ccc' },
    hudDim:      { color: '#444', fontSize: 12 },
    bar:         { height: BAR_HEIGHT, backgroundColor: '#111', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222' },
    legend:      { flexDirection: 'row', alignItems: 'center' },
    swatch:      { width: 14, height: 4, borderRadius: 2, marginRight: 6 },
    legendText:  { color: '#555', fontSize: 12 },
    btn:         { backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
    btnStop:     { backgroundColor: '#ef4444' },
    btnText:     { color: '#fff', fontSize: 14, fontWeight: '700' },
})
