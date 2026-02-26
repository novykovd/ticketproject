import { createCanvas } from 'canvas';
import fs from 'fs';

// Real pixel canvas size
const canvasWidth = 800;
const canvasHeight = 800;
const canvas = createCanvas(canvasWidth, canvasHeight);
const ctx = canvas.getContext('2d');

// Your leaf rectangles (lat/lon)
const leaves = [
  { minX: 48.157543182373, minY: 17.1067714691162, maxX: 48.1557006835938, maxY: 17.1075477600098 },
  { minX: 48.1557006835938, minY: 17.1075477600098, maxX: 48.1542472839355, maxY: 17.1109199523926 },
  { minX: 48.1542472839355, minY: 17.1109199523926, maxX: 48.1510848999023, maxY: 17.1158542633057 },
];

// Define offsets (origin) and scale
const xoff = 48.153;   // min longitude you want as origin
const yoff = 17.105;  // min latitude you want as origin
const scale = 100000; // zoom factor to convert degrees → pixels

console.log("drawing polylines")

// Draw rectangles + diagonal

leaves.forEach((rect, idx) => {
  // Map lat/lon → pixel coordinates
  const x = (rect.minX - xoff) * scale;
  const y = canvasHeight - (rect.minY - yoff) * scale; // flip Y
  const w = (rect.maxX - rect.minX) * scale;
  const h = (rect.maxY - rect.minY) * scale * -1;

  // Clamp to at least 1px
  const rectWidth = Math.max(1, w);
  const rectHeight = Math.max(1, h);

  // Draw rectangle
//   ctx.strokeStyle = 'blue';
//   ctx.lineWidth = 2;
//   ctx.strokeRect(x, y - rectHeight, rectWidth, rectHeight); // adjust y because canvas Y=top

  // Draw diagonal
  ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  console.log("drawing rectangle x: " + x + " y: " + y + " w: " + w + " h: " + h)
  console.log("polyline points: ", x, " ", y, " ", x + w, " ", h + y)
});

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./rtree.png', buffer);
console.log('Saved rtree.png');