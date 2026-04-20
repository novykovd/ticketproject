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