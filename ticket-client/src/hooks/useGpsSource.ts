import { useState, useEffect, useRef, useCallback } from 'react'
import { simulatedSource } from './sources/simulated'
import { deviceSource } from './sources/device'

export interface GpsObservation {
    from: { lat: number; lon: number }
    to:   { lat: number; lon: number }
}

// A GPS source is a function that starts producing observations and returns its own cleanup.
export type GpsSourceFactory = (
    onObservation: (obs: GpsObservation) => void,
    intervalMs: number,
) => () => void

const SOURCES = { simulated: simulatedSource, device: deviceSource }

export type GpsMode = keyof typeof SOURCES

interface Options {
    mode?: GpsMode
    intervalMs?: number
}

export function useGpsSource(
    onObservation: (obs: GpsObservation) => void,
    { mode = 'simulated', intervalMs = 2000 }: Options = {},
) {
    const [isActive, setIsActive] = useState(false)
    const cleanupRef  = useRef<(() => void) | null>(null)
    // Keep a stable ref to the callback so sources don't need to re-register when it changes
    const callbackRef = useRef(onObservation)
    callbackRef.current = onObservation

    const start = useCallback(() => {
        if (cleanupRef.current) return
        const factory = SOURCES[mode]
        cleanupRef.current = factory(obs => callbackRef.current(obs), intervalMs)
        setIsActive(true)
    }, [mode, intervalMs])

    const stop = useCallback(() => {
        cleanupRef.current?.()
        cleanupRef.current = null
        setIsActive(false)
    }, [])

    // Clean up if the component unmounts while active
    useEffect(() => () => { cleanupRef.current?.() }, [])

    return { start, stop, isActive }
}
