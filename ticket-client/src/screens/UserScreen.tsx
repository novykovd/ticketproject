import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator, Keyboard } from 'react-native'
import * as Location from 'expo-location'
import { trpc } from '../lib/trpc'
import { TrackMap } from '../components/TrackMap'
import { useReportCapture } from '../hooks/useReportCapture'
import type { Entry, ReportPin, JourneyStopPin } from '../components/TrackMap/types'

const BRATISLAVA_BBOX = { minLat: 48.05, maxLat: 48.25, minLon: 16.95, maxLon: 17.25 }
const TOP = Platform.OS === 'ios' ? 56 : 16

type Stop = { stopId: string; name: string; lat: number; lon: number }

function dangerColor(d: number) {
    if (d < 0.05) return '#3a3a3a'
    if (d < 0.25) return '#eab308'
    if (d < 0.5)  return '#f97316'
    return '#ef4444'
}

export function UserScreen({ onOpenDev }: { onOpenDev: () => void }) {
    const utils = trpc.useUtils()

    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [fromStop, setFromStop] = useState<Stop | null>(null)
    const [toStop, setToStop] = useState<Stop | null>(null)
    const [focused, setFocused] = useState<'from' | 'to' | null>(null)
    const [journeyActive, setJourneyActive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [captured, setCaptured] = useState<{ lat: number; lon: number }[] | null>(null)

    const reportsQuery = trpc.reports.byViewport.useQuery(BRATISLAVA_BBOX, { refetchInterval: 8000 })
    const reports = reportsQuery.data ?? []

    // --- autocomplete ---
    const activeText = focused === 'from' ? from : focused === 'to' ? to : ''
    const search = trpc.stops.search.useQuery({ q: activeText }, { enabled: activeText.trim().length >= 2 })
    const suggestions = (focused && activeText.trim().length >= 2 && search.data) ? search.data : []

    // --- report: capture -> match ---
    const matchMut = trpc.reports.matchTrack.useMutation()
    const match = matchMut.data ?? null
    const capture = useReportCapture((samples, arrived) => {
        console.log('[report capture]', { count: samples.length, arrived, samples })
        const pts = samples.map(s => ({ lat: s.lat, lon: s.lon }))
        // Heuristic: ~6 fixes expected in 8s. Far fewer usually means the GPS is
        // still cold-starting (acquiring satellites) — tell the user rather than
        // silently producing a garbage match.
        if (pts.length < 2) { setNotice('📡 GPS is still warming up — give it a few seconds and try again'); return }
        if (pts.length < 4) setNotice('📡 GPS still warming up — this read may be rough')
        setCaptured(pts)
        matchMut.mutate({ points: pts })
    })

    // Reuse the map's history rendering: track as blue path, matched segment as
    // orange on the last leg, arrival as a pin.
    const matchHistory: Entry[] = useMemo(() => {
        if (!captured || captured.length < 2) return []
        const es: Entry[] = captured.slice(0, -1).map((p, i) => ({ query: { from: p, to: captured[i + 1]! }, match: null }))
        if (match?.segment && es.length) {
            es[es.length - 1]!.match = { shapeId: match.shapeId ?? '?', from: match.segment.from, to: match.segment.to }
        }
        return es
    }, [captured, match])
    const arrivalPin: ReportPin[] = match ? [{
        id: -1, type: 'ticket_inspector',
        lat: match.arrivalStop?.lat ?? match.arrival.lat,   // pin the resolved stop, not the raw GPS point
        lon: match.arrivalStop?.lon ?? match.arrival.lon,
        stopName: match.arrivalStop?.name ?? null,
    }] : []
    const showingMatch = matchHistory.length > 0

    // --- journey ---
    const journey = trpc.reports.journey.useQuery(
        { origin: fromStop ?? { lat: 0, lon: 0 }, destination: toStop ?? { lat: 0, lon: 0 } },
        { enabled: journeyActive && !!fromStop && !!toStop, refetchOnWindowFocus: false },
    )
    const journeyStops: JourneyStopPin[] = journey.data
        ? journey.data.legs.flatMap(leg => leg.stops.map(st => ({ lat: st.lat, lon: st.lon, color: dangerColor(st.danger) })))
        : []

    const idle = !showingMatch && !journeyActive

    function pick(stop: Stop) {
        if (focused === 'from') { setFrom(stop.name); setFromStop(stop) }
        else if (focused === 'to') { setTo(stop.name); setToStop(stop) }
        setFocused(null)
    }
    async function useMyLocation() {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') { setNotice('location permission denied'); return }
        const pos = await Location.getCurrentPositionAsync({})
        const stop = await utils.stops.nearest.fetch({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        if (stop) { setFrom(stop.name); setFromStop({ stopId: stop.stopId, name: stop.name, lat: stop.lat, lon: stop.lon }); setFocused(null) }
    }
    function findRoute() {
        if (!fromStop || !toStop) { setNotice('pick a start and destination from the list'); return }
        setNotice(null); setJourneyActive(true)
    }
    function clearMatch() { setCaptured(null); matchMut.reset(); setNotice(null) }

    return (
        <View style={s.root}>
            <TrackMap
                history={showingMatch ? matchHistory : []}
                reports={showingMatch ? arrivalPin : journeyActive ? [] : reports}
                journey={journeyActive ? journeyStops : []}
            />

            {idle && (
                <View style={[s.search, { top: TOP }]}>
                    {focused && (
                        <TouchableOpacity style={s.dismiss} onPress={() => { setFocused(null); Keyboard.dismiss() }} activeOpacity={0.7}>
                            <Text style={s.dismissText}>Done ⌄</Text>
                        </TouchableOpacity>
                    )}
                    <View style={s.fromRow}>
                        <TextInput style={[s.input, { flex: 1 }]} placeholder="From" placeholderTextColor="#666"
                            value={from} onFocus={() => setFocused('from')} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()}
                            onChangeText={t => { setFrom(t); setFromStop(null); setFocused('from') }} />
                        <TouchableOpacity style={s.locBtn} onPress={useMyLocation} activeOpacity={0.7}><Text style={s.locBtnText}>📍</Text></TouchableOpacity>
                    </View>
                    <TextInput style={s.input} placeholder="To" placeholderTextColor="#666"
                        value={to} onFocus={() => setFocused('to')} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()}
                        onChangeText={t => { setTo(t); setToStop(null); setFocused('to') }} />
                    {suggestions.length > 0 && (
                        <ScrollView style={s.suggest} keyboardShouldPersistTaps="handled">
                            {suggestions.map(st => (
                                <TouchableOpacity key={st.stopId} style={s.suggestRow} onPress={() => pick(st)} activeOpacity={0.7}>
                                    <Text style={s.suggestText}>{st.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity style={s.goBtn} onPress={findRoute} activeOpacity={0.7}><Text style={s.goBtnText}>Find route</Text></TouchableOpacity>
                </View>
            )}

            {/* report match result */}
            {showingMatch && (
                <View style={s.matchCard}>
                    {matchMut.isPending ? <Text style={s.matchTitle}>matching…</Text>
                        : match ? <>
                            <Text style={s.matchTitle}>on shape {match.shapeId ?? 'unknown'}</Text>
                            <Text style={s.matchDim}>{match.votes}/{match.totalVectors} vectors agreed · logged{match.arrivalStop ? ` @ ${match.arrivalStop.name}` : ''}</Text>
                        </> : <Text style={s.matchTitle}>no match found</Text>}
                    <TouchableOpacity style={s.closeBtn} onPress={clearMatch} activeOpacity={0.7}><Text style={s.closeBtnText}>× done</Text></TouchableOpacity>
                </View>
            )}

            {/* journey danger */}
            {journeyActive && (
                <View style={s.journeyCard}>
                    <Text style={s.journeyTitle}>{from} → {to}</Text>
                    {journey.isLoading && <ActivityIndicator color="#3b82f6" style={{ marginVertical: 12 }} />}
                    {journey.isError && <Text style={s.matchDim}>routing failed</Text>}
                    {journey.data && (
                        <ScrollView style={s.journeyList}>
                            {journey.data.legs.map((leg, li) => (
                                <View key={li} style={{ marginBottom: 10 }}>
                                    <Text style={s.legHead}>{leg.vehicle} {leg.line} · {leg.stops.length} stops</Text>
                                    {leg.stops.map((st, si) => (
                                        <View key={si} style={s.stopRow}>
                                            <View style={[s.dot, { backgroundColor: dangerColor(st.danger) }]} />
                                            <Text style={s.stopName} numberOfLines={1}>{st.name}</Text>
                                            <Text style={[s.stopPct, { color: dangerColor(st.danger) }]}>{Math.round(st.danger * 100)}%</Text>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity style={s.closeBtn} onPress={() => setJourneyActive(false)} activeOpacity={0.7}><Text style={s.closeBtnText}>× back to map</Text></TouchableOpacity>
                </View>
            )}

            {/* bottom controls (idle only) */}
            {idle && (capture.capturing ? <>
                <View style={s.processing}><Text style={s.processingText}>🔧  processing…</Text></View>
                <TouchableOpacity style={s.arrivedBtn} onPress={capture.markArrived} activeOpacity={0.7}><Text style={s.arrivedText}>✅  I arrived at the stop</Text></TouchableOpacity>
            </> : <>
                <TouchableOpacity style={s.devBtn} onPress={onOpenDev} activeOpacity={0.5}><Text style={s.devBtnText}>⚙</Text></TouchableOpacity>
                <TouchableOpacity style={s.reportFab} onPress={capture.start} activeOpacity={0.85}><Text style={s.reportFabText}>🎫  Report</Text></TouchableOpacity>
            </>)}

            {notice && (
                <TouchableOpacity style={s.notice} onPress={() => setNotice(null)} activeOpacity={0.8}><Text style={s.noticeText}>{notice}</Text></TouchableOpacity>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    root:         { flex: 1, backgroundColor: '#0f0f0f', position: 'relative' },
    search:       { position: 'absolute', left: 12, right: 12, zIndex: 2, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 12, padding: 10, gap: 8, borderWidth: 1, borderColor: '#2a2a2a' },
    dismiss:      { alignSelf: 'flex-end', paddingVertical: 2, paddingHorizontal: 6 },
    dismissText:  { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
    fromRow:      { flexDirection: 'row', gap: 8 },
    input:        { backgroundColor: '#1a1a1a', color: '#eee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a' },
    locBtn:       { width: 44, borderRadius: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
    locBtnText:   { fontSize: 18 },
    suggest:      { maxHeight: 180, backgroundColor: '#141414', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
    suggestRow:   { paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
    suggestText:  { color: '#ddd', fontSize: 14 },
    goBtn:        { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
    goBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
    devBtn:       { position: 'absolute', bottom: 26, left: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,20,20,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a', zIndex: 2 },
    devBtnText:   { color: '#555', fontSize: 18 },
    reportFab:    { position: 'absolute', bottom: 26, right: 18, backgroundColor: '#dc2626', borderRadius: 26, paddingVertical: 13, paddingHorizontal: 20, zIndex: 2 },
    reportFabText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
    processing:   { position: 'absolute', bottom: 26, right: 18, backgroundColor: 'rgba(80,80,80,0.5)', borderRadius: 26, paddingVertical: 13, paddingHorizontal: 20, zIndex: 2, borderWidth: 1, borderColor: '#3a3a3a' },
    processingText:{ color: '#ccc', fontSize: 15, fontWeight: '700' },
    arrivedBtn:   { position: 'absolute', bottom: 84, alignSelf: 'center', backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 18, zIndex: 2 },
    arrivedText:  { color: 'rgba(16,185,129,0.85)', fontSize: 14, fontWeight: '600' },
    matchCard:    { position: 'absolute', bottom: 26, left: 18, right: 18, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f9731655', zIndex: 2 },
    matchTitle:   { color: '#f97316', fontSize: 16, fontWeight: '700' },
    matchDim:     { color: '#888', fontSize: 13, marginTop: 4 },
    journeyCard:  { position: 'absolute', bottom: 26, left: 18, right: 18, maxHeight: '55%', backgroundColor: 'rgba(10,10,10,0.94)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', zIndex: 2 },
    journeyTitle: { color: '#eee', fontSize: 16, fontWeight: '700', marginBottom: 8 },
    journeyList:  { marginBottom: 8 },
    legHead:      { color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 6 },
    stopRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 10 },
    dot:          { width: 9, height: 9, borderRadius: 5 },
    stopName:     { color: '#ccc', fontSize: 13, flex: 1 },
    stopPct:      { fontSize: 12, fontFamily: 'monospace', width: 42, textAlign: 'right' },
    closeBtn:     { alignSelf: 'flex-start', paddingVertical: 6, marginTop: 4 },
    closeBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
    notice:       { position: 'absolute', bottom: 150, alignSelf: 'center', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#333', zIndex: 3 },
    noticeText:   { color: '#ccc', fontSize: 13 },
})
