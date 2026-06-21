import { useEffect, useRef } from 'react'
import { simulatedSource } from './sources/simulated'
import { deviceSource } from './sources/device'
import { stopsSource } from './sources/stops'

export interface GpsObservation {
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

export type GpsSourceFactory = (
    onObservation: (obs: GpsObservation) => void,
    intervalMs: number,
) => () => void

const SOURCES = { simulated: simulatedSource, device: deviceSource, stops: stopsSource }

export type GpsMode = keyof typeof SOURCES

interface Options {
    mode: GpsMode | null
    intervalMs?: number
}

export function useGpsSource(
    onObservation: (obs: GpsObservation) => void,
    { mode, intervalMs = 2000 }: Options,
) {
    const callbackRef = useRef(onObservation)
    callbackRef.current = onObservation

    useEffect(() => {
        if (!mode) return
        const factory = SOURCES[mode]
        const cleanup = factory(obs => callbackRef.current(obs), intervalMs)
        return cleanup
    }, [mode, intervalMs])
}
