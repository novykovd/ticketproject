import { RTree } from '../src/spatial/index.js'
import { populateRTree } from '../src/gtfs/index.js'
import { runMonteCarlo } from '../src/spatial/index.js'

const dummySegments = [
    { id: 'North', minX: 0, minY: 0, maxX: 0,  maxY: 10 },
    { id: 'East',  minX: 0, minY: 0, maxX: 10, maxY: 0  },
]

describe('Vector Matching Monte Carlo (synthetic)', () => {
    let tree: RTree

    beforeAll(() => {
        tree = new RTree()
        populateRTree(tree, dummySegments)
    })

    test('should match ≥85% with 15° noise (1000 trials)', () => {
        const { accuracy } = runMonteCarlo(tree, dummySegments, { trials: 1000 })
        console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%`)
        expect(accuracy).toBeGreaterThan(0.85)
    })
})
