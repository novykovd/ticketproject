import type { GpsSourceFactory } from '../useGpsSource'

type Segment = { minX: number; minY: number; maxX: number; maxY: number }

export const stopsSource: GpsSourceFactory = (onObservation, intervalMs) => {
    const apiUrl = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    let timerId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    fetch(`${apiUrl}/gtfs/sample?n=30`)
        .then(r => r.json())
        .then(({ segments }: { segments: Segment[] }) => {
            if (cancelled || !segments.length) return
            timerId = setInterval(() => {
                const seg = segments[Math.floor(Math.random() * segments.length)]!
                onObservation({
                    from: { lat: seg.minX, lon: seg.minY },
                    to:   { lat: seg.maxX, lon: seg.maxY },
                })
            }, intervalMs)
        })
        .catch(e => console.warn('stopsSource: failed to fetch segments', e))

    return () => {
        cancelled = true
        if (timerId) clearInterval(timerId)
    }
}
