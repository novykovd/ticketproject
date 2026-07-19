import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { trpc } from '../lib/trpc'

// Preset trips for now (typing lat/lon on a phone is miserable). Later these
// become "tap two points on the map" or a place search. Real coords, so they
// work live; with the server in canned mode they return the fixture journey.
const PRESETS = [
    { label: 'Zlaté piesky → Komisárky', origin: { lat: 48.1894912719727, lon: 17.1825981140137 }, destination: { lat: 48.2162742614746, lon: 17.1665477752686 } },
    { label: 'Farského → Vajnory',       origin: { lat: 48.1271705627441, lon: 17.1167469024658 }, destination: { lat: 48.2090873718262, lon: 17.2199592590332 } },
]

// danger [0,1] -> colour. Grey = negligible, then amber -> orange -> red.
function dangerColor(d: number) {
    if (d < 0.05) return '#3a3a3a'
    if (d < 0.25) return '#eab308'
    if (d < 0.5)  return '#f97316'
    return '#ef4444'
}

export function JourneyScreen() {
    const [tripIdx, setTripIdx] = useState<number | null>(null)
    const trip = tripIdx != null ? PRESETS[tripIdx] : null

    // Lazy: only fires once a preset is picked (each call may hit Google = cost),
    // and never auto-refetches.
    const input = trip
        ? { origin: trip.origin, destination: trip.destination }
        : { origin: { lat: 0, lon: 0 }, destination: { lat: 0, lon: 0 } }
    const journey = trpc.reports.journey.useQuery(input, {
        enabled: !!trip,
        refetchOnWindowFocus: false,
    })

    return (
        <View style={s.root}>
            <Text style={s.title}>PLAN A JOURNEY</Text>

            <View style={s.presets}>
                {PRESETS.map((p, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[s.preset, tripIdx === i && s.presetActive]}
                        onPress={() => setTripIdx(i)}
                        activeOpacity={0.7}
                    >
                        <Text style={[s.presetText, tripIdx === i && s.presetTextActive]}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {trip && journey.isLoading && <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />}
            {journey.isError && <Text style={s.err}>failed: {String(journey.error?.message ?? 'error')}</Text>}

            {journey.data && (
                <ScrollView style={s.results} contentContainerStyle={{ paddingBottom: 24 }}>
                    {journey.data.legs.map((leg, li) => (
                        <View key={li} style={s.leg}>
                            <Text style={s.legHead}>
                                {leg.vehicle} {leg.line}
                                {leg.headsign ? ` → ${leg.headsign}` : ''} · {leg.stops.length} stops
                            </Text>
                            {leg.stops.map((stop, si) => (
                                <View key={si} style={s.stopRow}>
                                    <View style={[s.dot, { backgroundColor: dangerColor(stop.danger) }]} />
                                    <Text style={s.stopName} numberOfLines={1}>{stop.name}</Text>
                                    <Text style={[s.stopPct, { color: dangerColor(stop.danger) }]}>
                                        {Math.round(stop.danger * 100)}%
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    root:            { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
    title:           { color: '#3b82f6', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12 },
    presets:         { gap: 8 },
    preset:          { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' },
    presetActive:    { backgroundColor: '#1d3a5e', borderColor: '#3b82f6' },
    presetText:      { color: '#aaa', fontSize: 14, fontWeight: '600' },
    presetTextActive:{ color: '#3b82f6' },
    err:             { color: '#ef4444', marginTop: 20, fontSize: 13 },
    results:         { marginTop: 16 },
    leg:             { marginBottom: 18 },
    legHead:         { color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.4 },
    stopRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 10 },
    dot:             { width: 10, height: 10, borderRadius: 5 },
    stopName:        { color: '#ccc', fontSize: 13, flex: 1 },
    stopPct:         { fontSize: 12, fontFamily: 'monospace', width: 44, textAlign: 'right' },
})
