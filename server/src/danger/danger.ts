// v1 danger scorer: sparse inspector sightings ("pings") -> per-stop encounter
// probability. See the Obsidian note `danger-function-model` for the derivation.
//
// Each ping contributes a "bump" of worry to a stop, built from two decays:
//   - survival  e^(-Δt/τ)          the sighting ages out (inspector clocks off)
//   - spatial   e^(-d²/2σ²)        nearer stops worry more (a Gaussian in space)
// and the spatial width σ GROWS with age (they've had time to move). v1 has no
// route graph, so we can't know direction -> the spread is symmetric/diffusive,
// σ ∝ √age (the "drunk walk" regime, not the directed/ballistic one).
//
// Total intensity λ = Σ bumps; probability P = 1 - e^(-λ) (Poisson "≥1 event").
// Bumps just superimpose -> multiple sightings reinforce with no coordination.

// --- tunable parameters (hand-set for the MVP; learn from history later) ----
export const TAU_MIN = 25                 // survival time constant, minutes
export const SIGMA0_M = 250               // base spatial width (~one stop spacing)
export const SPREAD_M_PER_SQRT_MIN = 120  // diffusive bloom: σ = σ0 + k·√age
export const NEGLIGIBLE = 0.01            // a bump below this isn't worth fetching
export const RELEVANCE_MIN = 90           // time window: ignore pings older than this

// The fetch radius. Beyond it no ping can contribute >= NEGLIGIBLE, so the SQL
// prune can safely drop everything outside. Derived by inverting the spatial
// Gaussian at its WIDEST still-relevant σ (oldest ping in the window): even that
// widest bump is < NEGLIGIBLE past this distance, so no narrower/older one reaches.
export function pruneRadiusM(): number {
    const sigmaMax = SIGMA0_M + SPREAD_M_PER_SQRT_MIN * Math.sqrt(RELEVANCE_MIN)
    return sigmaMax * Math.sqrt(2 * Math.log(1 / NEGLIGIBLE))
}

// One (ping, stop) pair reduced to what the kernel needs.
export interface Ping {
    distM: number   // metres from the ping to the stop
    ageMin: number  // minutes since the ping fired
}

// A single ping's contribution to a stop's danger intensity.
export function bump(p: Ping): number {
    const sigma = SIGMA0_M + SPREAD_M_PER_SQRT_MIN * Math.sqrt(p.ageMin)
    const survival = Math.exp(-p.ageMin / TAU_MIN)
    const spatial = Math.exp(-(p.distM * p.distM) / (2 * sigma * sigma))
    return survival * spatial
}

// Cumulative danger at one stop: sum every nearby ping's bump, squash to [0,1).
// No pings -> λ = 0 -> P = 0 (the common, cheap case).
export function stopDanger(pings: Ping[]): number {
    const lambda = pings.reduce((sum, p) => sum + bump(p), 0)
    return 1 - Math.exp(-lambda)
}
