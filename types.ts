export interface Room {
  name: string;
  position: {
    x: number;
    y: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
}

// New detailed element types for high-fidelity rendering
export interface Wall {
  type: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

export interface Door {
  type: 'door';
  x: number; // center x of door opening
  y: number; // center y of door opening
  width: number; // width of the door opening
  height: number; // thickness of the wall it's in
  angle: number; // 0 for horizontal wall, 90 for vertical
}

export interface Window {
  type: 'window';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

export interface Stairs {
  type: 'stairs';
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'horizontal' | 'vertical';
}

export type ArchitecturalElement = Wall | Door | Window | Stairs;

export interface FloorPlanData {
  rooms: Room[]; // Kept for interaction, labels, and metadata
  elements: ArchitecturalElement[]; // Used for detailed rendering
  canvas: {
    width: number;
    height: number;
  };
}


// --- New Types for Elevation ---

export type ElevationShape = 'rect' | 'line' | 'path';

export interface ElevationElement {
  type: ElevationShape;
  // Properties for rect
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Properties for line
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // Properties for path
  d?: string;
}

export interface ElevationLayer {
  name: string;
  elements: ElevationElement[];
}

export interface ElevationData {
  layers: ElevationLayer[];
  canvas: {
    width: number;
    height: number;
  };
}