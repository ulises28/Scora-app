import { vi } from 'vitest';

/**
 * Silent Canvas Mock Suite (High-Fidelity)
 * 
 * Satisfies JSDOM's lack of Canvas API during unit tests.
 * Silences 1,000+ lines of 'Not Implemented' errors and resolves
 * ReferenceErrors for modern Canvas APIs like Path2D.
 */

// 1. Mock Path2D Global (Used in modern pill/shape rendering)
class Path2D {
  addPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  bezierCurveTo = vi.fn();
  quadraticCurveTo = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  ellipse = vi.fn();
  rect = vi.fn();
  roundRect = vi.fn();
}
vi.stubGlobal('Path2D', Path2D);

// 2. Mock HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  
  // Method stubs
  fillRect: vi.fn(),
  roundRect: vi.fn(),
  clearRect: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ 
    width: 100, 
    actualBoundingBoxAscent: 10, 
    actualBoundingBoxDescent: 3,
    fontBoundingBoxAscent: 10,
    fontBoundingBoxDescent: 3
  })),
  
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  
  rotate: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  transform: vi.fn(),
  setTransform: vi.fn(),
  getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  resetTransform: vi.fn(),
  
  // Gradient/Pattern Support
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createPattern: vi.fn(() => ({})),
  
  drawImage: vi.fn(),
  createImageData: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  
  save: vi.fn(),
  restore: vi.fn()
})) as any;
