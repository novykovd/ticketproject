import {leafToRect, computeBounds} from "./util.js"
import { RTree } from './rtree.js';
import { createCanvas } from 'canvas';
import fs from 'fs';
import { Viewport } from './viewport.js';
import { createRenderer } from './renderer.js';


const leaves = [
  { minX: 48.157543182373, minY: 17.1067714691162, maxX: 48.1557006835938, maxY: 17.1075477600098 },
  { minX: 48.1557006835938, minY: 17.1075477600098, maxX: 48.1542472839355, maxY: 17.1109199523926 },
  { minX: 48.1542472839355, minY: 17.1109199523926, maxX: 48.1510848999023, maxY: 17.1158542633057 },
  { minX: 48.1533737182617, minY: 17.1187610626221, maxX: 48.1510848999023, maxY: 17.1158542633057 },
  { minX: 48.1510848999023, minY: 17.1158542633057, maxX: 48.1484756469727, maxY: 17.1122550964355 },
  { minX: 48.1484756469727, minY: 17.1122550964355, maxX: 48.1466407775879, maxY: 17.1085720062256 },
  { minX: 48.1466407775879, minY: 17.1085720062256, maxX: 48.144889831543, maxY: 17.1047821044922 },
  { minX: 48.144889831543, minY: 17.1047821044922, maxX: 48.1408882141113, maxY: 17.0930595397949 },
  { minX: 48.1466178894043, minY: 17.1225357055664, maxX: 48.1461181640625, maxY: 17.1265621185303 },
  { minX: 48.1461181640625, minY: 17.1265621185303, maxX: 48.1453704833984, maxY: 17.1331005096436 },
  { minX: 48.1453704833984, minY: 17.1331005096436, maxX: 48.1461524963379, maxY: 17.137414932251 },
  { minX: 48.1461524963379, minY: 17.137414932251, maxX: 48.1473159790039, maxY: 17.1422309875488 },
  { minX: 48.1473159790039, minY: 17.1422309875488, maxX: 48.1489524841309, maxY: 17.1509342193604 },
  { minX: 48.1489524841309, minY: 17.1509342193604, maxX: 48.1497688293457, maxY: 17.1594905853271 },
  { minX: 48.1497688293457, minY: 17.1594905853271, maxX: 48.1502571105957, maxY: 17.1679096221924 },
  { minX: 48.1502571105957, minY: 17.1679096221924, maxX: 48.1505737304688, maxY: 17.1728515625 },
  { minX: 48.1505737304688, minY: 17.1728515625, maxX: 48.1507263183594, maxY: 17.1760425567627 },
  { minX: 48.1507263183594, minY: 17.1760425567627, maxX: 48.1462554931641, maxY: 17.1857204437256 },
  { minX: 48.1462554931641, minY: 17.1857204437256, maxX: 48.1424598693848, maxY: 17.1906642913818 },
  { minX: 48.1424598693848, minY: 17.1906642913818, maxX: 48.1368942260742, maxY: 17.1970329284668 },
  { minX: 48.1368942260742, minY: 17.1970329284668, maxX: 48.1368446350098, maxY: 17.2029361724854 },
  { minX: 48.1368446350098, minY: 17.2029361724854, maxX: 48.1358757019043, maxY: 17.2056636810303 },
  { minX: 48.1358757019043, minY: 17.2056636810303, maxX: 48.1358909606934, maxY: 17.209716796875 },
  { minX: 48.1358909606934, minY: 17.209716796875, maxX: 48.1377792358398, maxY: 17.2140045166016 },
  { minX: 48.1377792358398, minY: 17.2140045166016, maxX: 48.1439399719238, maxY: 17.2128887176514 }
];

export function runRTreeVisualization(canvas, data, leaves) {
  const ctx = canvas.getContext('2d');
  const tree = new RTree();
  
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

const canvasWidth = 800;
const canvasHeight = 800;
let canvas = createCanvas(canvasWidth, canvasHeight);

const rects = leaves.map(leaf => leafToRect(leaf));

runRTreeVisualization(canvas, rects, leaves);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./rtree.png', buffer);
console.log('Saved rtree.png');



