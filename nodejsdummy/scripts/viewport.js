export class Viewport {
  constructor(bounds, width, height) {
    this.xoff = bounds.minX;
    this.yoff = bounds.minY;
    this.scaleX = width / (bounds.maxX - bounds.minX);
    this.scaleY = height / (bounds.maxY - bounds.minY);
    this.height = height;
  }

  project(minX, minY, maxX, maxY) {
    return {
      x: (minX - this.xoff) * this.scaleX,
      y: this.height - (minY - this.yoff) * this.scaleY,
      w: (maxX - minX) * this.scaleX,
      h: (maxY - minY) * this.scaleY
    };
  }
}