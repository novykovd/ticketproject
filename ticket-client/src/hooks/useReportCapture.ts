import { useRef, useState } from 'react'
import * as Location from 'expo-location'

// Captures a short burst of GPS fixes when a report is filed. The sequence (not
// a single point) is what the interpolation/majority-vote matcher will chew on
// later — for now we just collect and hand back the samples.
export interface GpsSample { lat: number; lon: number; t: number; speed: number | null }

const DURATION_MS = 8000
const INTERVAL_MS = 1300

export function useReportCapture(onDone: (samples: GpsSample[], arrived: boolean) => void) {
    const [capturing, setCapturing] = useState(false)
    const samples = useRef<GpsSample[]>([])
    const arrived = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stopAt = useRef(0)

    function finish() {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        setCapturing(false)
        onDone(samples.current, arrived.current)
    }

    async function start() {
        if (capturing) return
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') { onDone([], false); return }

        samples.current = []
        arrived.current = false
        stopAt.current = Date.now() + DURATION_MS
        setCapturing(true)

        const tick = async () => {
            try {
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
                samples.current.push({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    t: Date.now(),
                    speed: pos.coords.speed ?? null,
                })
            } catch { /* skip a bad fix */ }
            if (Date.now() >= stopAt.current) finish()
            else timer.current = setTimeout(tick, INTERVAL_MS)
        }
        tick()
    }

    // Optional: user says they've reached a stop -> flag it (extra ground-truth
    // label) and finish early.
    function markArrived() {
        if (!capturing) return
        arrived.current = true
        finish()
    }

    return { capturing, start, markArrived }
}
