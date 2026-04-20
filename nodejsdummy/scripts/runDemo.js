import {leafToRect, computeBounds} from "./util.js"
import { RTree } from './rtree.js';
import { Viewport } from './viewport.js';
import { createRenderer } from './renderer.js';

export function runRTreeVisualization(canvas, leaves) {
  const ctx = canvas.getContext('2d');
  const tree = new RTree();

  const data = leaves.map(leaf => leafToRect(leaf));
  
  // 1. Setup Logic
  data.forEach(r => tree.insert(r, r));
  
  // 2. Setup Viewport (using your computeBounds logic)
  const bounds = computeBounds(data); 
  const view = new Viewport(bounds, canvas.width, canvas.height);
  const paint = createRenderer(ctx, view);

  // 3. Execute "Scene"
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw MBRs (Branches)
  tree.getAllRectangles().forEach(r => paint.drawBox(r, 'green'));
  
  // Draw Leaves
  data.forEach(r => paint.drawBox(r, 'blue', 1));
  leaves.forEach(leaf => paint.drawLine(leaf, "yellow"))
  
  // Draw Highlight (KNN)
  const nearest = tree.knn({ minX: 48.1505737304688, minY: 17.1728515625, maxX: 48.1507263183594, maxY: 17.1760425567627 }, 3);
  nearest.forEach(n => paint.drawBox(n.obj, 'red', 4));
  console.log(nearest)
}



