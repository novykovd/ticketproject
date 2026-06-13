import { RTree } from '../src/rtree.js';
import { findBestSegment } from '../src/matcher';
import { applyGpsNoise } from '../src/test-utils';

describe('Vector Matching Monte Carlo', () => {
    let testTree: RTree;
    const dummySegments = [
        { id: "North", minX: 0, minY: 0, maxX: 0, maxY: 10 },
        { id: "East", minX: 0, minY: 0, maxX: 10, maxY: 0 }
    ];

    beforeAll(() => {
        testTree = new RTree();
        dummySegments.forEach(seg => {
            const trueVector = { x: seg.maxX - seg.minX, y: seg.maxY - seg.minY };
            testTree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { segment: seg, vector: trueVector });
        });
    });

    test('should match at least 85% with 15 degree noise', () => {
        const TRIALS = 1000;
        let correct = 0;

        for (let i = 0; i < TRIALS; i++) {
            const trueSeg = dummySegments[Math.floor(Math.random() * dummySegments.length)];
            const baseVec = { x: trueSeg.maxX - trueSeg.minX, y: trueSeg.maxY - trueSeg.minY };
            
            const noisyVec = applyGpsNoise(baseVec, 15);
            const predicted = findBestSegment(noisyVec, testTree);
            
            if (predicted && (predicted as any).id === trueSeg.id) correct++;
        }

        const accuracy = correct / TRIALS;
        console.log(`Final Accuracy: ${(accuracy * 100).toFixed(2)}%`);
        expect(accuracy).toBeGreaterThan(0.85);
    });
});