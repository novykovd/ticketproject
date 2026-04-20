import fs from 'fs';

export function loadGTFSSegments(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    // 1. Skip Header
    const rows = lines.slice(1);
    const segments = [];

    // We use a simple loop so we can track the "Previous" point
    for (let i = 1; i < rows.length; i++) {
        const prevParts = rows[i - 1].split(',');
        const currParts = rows[i].split(',');

        // Check if they belong to the same route (shape_id)
        // If the shape_id changes, we don't want to draw a line across the city!
        if (prevParts[0] !== currParts[0]) continue;

        const p1 = { x: parseFloat(prevParts[1]), y: parseFloat(prevParts[2]) };
        const p2 = { x: parseFloat(currParts[1]), y: parseFloat(currParts[2]) };

        if (isNaN(p1.x) || isNaN(p2.x)) continue;

        segments.push({
            // Vector A (Start)
            minX: p1.x,
            minY: p1.y,
            // Vector B (End)
            maxX: p2.x,
            maxY: p2.y,
            shapeId: prevParts[0]
        });
    }

    return segments;
}

if (process.argv[1].includes('gtfsUpdater.js')) {
    const testPath = 'C:/Users/david/Documents/GTFS_latest/shapes.txt';
    const result = loadGTFSSegments(testPath);
    
    // Using JSON.stringify makes the objects readable in the console
    console.log(JSON.stringify(result.slice(0, 5), null, 2)); 
    console.log(`\nTotal segments loaded: ${result.length}`);
}