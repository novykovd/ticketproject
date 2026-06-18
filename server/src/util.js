export function computeBounds(rects) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.minX, r.maxX);
    minY = Math.min(minY, r.minY, r.maxY);
    maxX = Math.max(maxX, r.maxX, r.minX,);
    maxY = Math.max(maxY, r.maxY, r.minY);
  }

  return { minX, minY, maxX, maxY };
}

export function leafToRect(leaf) {
  const minX = Math.min(leaf.minX, leaf.maxX);
  const maxX = Math.max(leaf.minX, leaf.maxX);
  const minY = Math.min(leaf.minY, leaf.maxY);
  const maxY = Math.max(leaf.minY, leaf.maxY);
  return { minX, minY, maxX, maxY };
}


/**
 * Populates an RTree with segments.
 * * @param {RTree} rtreeInstance - The RTree instance to fill.
 * @param {Array} segments - Array of objects containing {lat1, lon1, lat2, lon2}.
 * @param {Function} leafToRect - Your existing util to map segment to {minX, minY, maxX, maxY}.
 */
export function populateRTree(rtreeInstance, segments) {
    segments.forEach(segment => {
        // 1. Convert the segment to an MBR for the R-Tree structure
        const mbr = leafToRect(segment);

        // 2. Prepare the payload
        // We store the original segment and pre-calculate the vector
        const payload = {
            segment,
            vector: { x: segment.maxX - segment.minX, y: segment.maxY - segment.minY },
        };

        // 3. Insert into the R-Tree
        rtreeInstance.insert(mbr, payload);
    });
}