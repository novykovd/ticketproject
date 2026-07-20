import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import * as Location from 'expo-location'
import { trpc } from '../lib/trpc'
import { TrackMap } from '../components/TrackMap'
import { useReportCapture } from '../hooks/useReportCapture'

const BRATISLAVA_BBOX = { minLat: 48.05, maxLat: 48.25, minLon: 16.95, maxLon: 17.25 }
const TOP = Platform.OS === 'ios' ? 56 : 16

type Stop = { stopId: string; name: string; lat: number; lon: number }

export function UserScreen({ onOpenDev }: { onOpenDev: () => void }) {
    const utils = trpc.useUtils()

    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [fromStop, setFromStop] = useState<Stop | null>(null)
    const [toStop, setToStop] = useState<Stop | null>(null)
    const [focused, setFocused] = useState<'from' | 'to' | null>(null)
    const [journeyActive, setJourneyActive] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)

    const reportsQuery = trpc.reports.byViewport.useQuery(BRATISLAVA_BBOX, { refetchInterval: 8000 })
    const reports = reportsQuery.data ?? []

    const activeText = focused === 'from' ? from : focused === 'to' ? to : ''
    const search = trpc.stops.search.useQuery({ q: activeText }, { enabled: activeText.trim().length >= 2 })
    const suggestions = (focused && activeText.trim().length >= 2 && search.data) ? search.data : []

    const capture = useReportCapture((samples, arrived) => {
        console.log('[report capture]', { count: samples.length, arrived, samples })
        setNotice(`captured ${samples.length} GPS samples${arrived ? ' · arrived ✓' : ''} — matching coming soon`)
    })

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
        if (stop) {
            setFrom(stop.name)
            setFromStop({ stopId: stop.stopId, name: stop.name, lat: stop.lat, lon: stop.lon })
            setFocused(null)
        }
    }

    function findRoute() {
        if (!fromStop || !toStop) { setNotice('pick a start and destination from the list'); return }
        setNotice(null)
        setJourneyActive(true) // wire to the journey builder later
    }

    return (
        <View style={s.root}>
            <TrackMap history={[]} reports={journeyActive ? [] : reports} />

            {!journeyActive && (
                <View style={[s.search, { top: TOP }]}>
                    <View style={s.fromRow}>
                        <TextInput
                            style={[s.input, { flex: 1 }]}
                            placeholder="From" placeholderTextColor="#666"
                            value={from}
                            onFocus={() => setFocused('from')}
                            onChangeText={t => { setFrom(t); setFromStop(null); setFocused('from') }}
                        />
                        <TouchableOpacity style={s.locBtn} onPress={useMyLocation} activeOpacity={0.7}>
                            <Text style={s.locBtnText}>📍</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={s.input}
                        placeholder="To" placeholderTextColor="#666"
                        value={to}
                        onFocus={() => setFocused('to')}
                        onChangeText={t => { setTo(t); setToStop(null); setFocused('to') }}
                    />
                    {suggestions.length > 0 && (
                        <ScrollView style={s.suggest} keyboardShouldPersistTaps="handled">
                            {suggestions.map(st => (
                                <TouchableOpacity key={st.stopId} style={s.suggestRow} onPress={() => pick(st)} activeOpacity={0.7}>
                                    <Text style={s.suggestText}>{st.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity style={s.goBtn} onPress={findRoute} activeOpacity={0.7}>
                        <Text style={s.goBtnText}>Find route</Text>
                    </TouchableOpacity>
                </View>
            )}

            {journeyActive && (
                <View style={s.journeyCard}>
                    <Text style={s.journeyTitle}>{from} → {to}</Text>
                    <Text style={s.journeyDim}>danger routing coming soon</Text>
                    <TouchableOpacity style={s.closeBtn} onPress={() => setJourneyActive(false)} activeOpacity={0.7}>
                        <Text style={s.closeBtnText}>× back to map</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* bottom controls */}
            {capture.capturing ? <>
                <View style={s.processing}>
                    <Text style={s.processingText}>🔧  processing…</Text>
                </View>
                <TouchableOpacity style={s.arrivedBtn} onPress={capture.markArrived} activeOpacity={0.7}>
                    <Text style={s.arrivedText}>✅  I arrived at the stop</Text>
                </TouchableOpacity>
            </> : !journeyActive && <>
                <TouchableOpacity style={s.devBtn} onPress={onOpenDev} activeOpacity={0.5}>
                    <Text style={s.devBtnText}>⚙</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.reportFab} onPress={capture.start} activeOpacity={0.85}>
                    <Text style={s.reportFabText}>🎫  Report</Text>
                </TouchableOpacity>
            </>}

            {notice && (
                <TouchableOpacity style={s.notice} onPress={() => setNotice(null)} activeOpacity={0.8}>
                    <Text style={s.noticeText}>{notice}</Text>
                </TouchableOpacity>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    root:         { flex: 1, backgroundColor: '#0f0f0f', position: 'relative' },
    search:       { position: 'absolute', left: 12, right: 12, zIndex: 2, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 12, padding: 10, gap: 8, borderWidth: 1, borderColor: '#2a2a2a' },
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
    reportFab:    { position: 'absolute', bottom: 26, right: 18, backgroundColor: '#dc2626', borderRadius: 26, paddingVertical: 13, paddingHorizontal: 20, zIndex: 2, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    reportFabText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
    processing:   { position: 'absolute', bottom: 26, right: 18, backgroundColor: 'rgba(80,80,80,0.5)', borderRadius: 26, paddingVertical: 13, paddingHorizontal: 20, zIndex: 2, borderWidth: 1, borderColor: '#3a3a3a' },
    processingText:{ color: '#ccc', fontSize: 15, fontWeight: '700' },
    arrivedBtn:   { position: 'absolute', bottom: 84, alignSelf: 'center', backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 18, zIndex: 2 },
    arrivedText:  { color: 'rgba(16,185,129,0.85)', fontSize: 14, fontWeight: '600' },
    journeyCard:  { position: 'absolute', bottom: 26, left: 18, right: 18, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', zIndex: 2 },
    journeyTitle: { color: '#eee', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    journeyDim:   { color: '#666', fontSize: 13, marginBottom: 12 },
    closeBtn:     { alignSelf: 'flex-start', paddingVertical: 6 },
    closeBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
    notice:       { position: 'absolute', bottom: 140, alignSelf: 'center', backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#333', zIndex: 3 },
    noticeText:   { color: '#ccc', fontSize: 13 },
})
