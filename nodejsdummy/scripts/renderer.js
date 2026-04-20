export const createRenderer = (ctx, viewport) => ({
  drawBox: (rect, color, lineWidth = 2) => {
    const { x, y, w, h } = viewport.project(rect.minX, rect.minY, rect.maxX, rect.maxY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y - h, w, h);
  },
  
  drawLine: (rect, color) => {
    const { x, y, w, h } = viewport.project(rect.minX, rect.minY, rect.maxX, rect.maxY);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - h); // Adjusted for flip
    ctx.stroke();
  }
});