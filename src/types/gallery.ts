export interface MemoryItem {
  id: string;
  title: string;
  date: string;
  img: string;
  desc: string;
}

export interface GalleryData {
  names: string;
  startDate: string; // YYYY-MM-DD
  memories: MemoryItem[];
}

export interface RelationshipDuration {
  isFuture: boolean;
  isValid: boolean;
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
}

export interface FramePlacement {
  index: number;
  side: -1 | 1;
  position: [number, number, number];
  rotationY: number;
  viewCameraPosition: [number, number, number];
  viewTargetPosition: [number, number, number];
}

export interface CorridorLayout {
  corridorWidth: number;
  corridorHeight: number;
  corridorLength: number;
  minZ: number;
  maxZ: number;
  centerZ: number;
  alcoveZ: number;
  frames: FramePlacement[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
