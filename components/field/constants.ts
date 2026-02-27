// SVG viewBox and coordinate definitions for baseball field components

export const FIELD_VIEWBOX = "0 0 400 400";
export const FIELD_WIDTH = 400;
export const FIELD_HEIGHT = 400;

export type PositionKey = "投" | "捕" | "一" | "二" | "三" | "遊" | "左" | "中" | "右" | "DH";

export interface FieldCoordinate {
  x: number;
  y: number;
}

/** Defensive position coordinates on the SVG field */
export const DEFENSIVE_POSITIONS: Record<PositionKey, FieldCoordinate> = {
  "投": { x: 200, y: 260 },
  "捕": { x: 200, y: 365 },
  "一": { x: 310, y: 240 },
  "二": { x: 245, y: 180 },
  "三": { x: 90, y: 240 },
  "遊": { x: 155, y: 180 },
  "左": { x: 70, y: 100 },
  "中": { x: 200, y: 55 },
  "右": { x: 330, y: 100 },
  "DH": { x: 370, y: 350 },
};

/** Base positions on the diamond */
export const BASE_POSITIONS = {
  home: { x: 200, y: 350 },
  first: { x: 300, y: 250 },
  second: { x: 200, y: 150 },
  third: { x: 100, y: 250 },
} as const;

/** Touch target radius for position circles (Apple HIG 44pt minimum) */
export const POSITION_CIRCLE_RADIUS = 24;

/** Base square size (half-diagonal) */
export const BASE_SIZE = 8;

/** Destination zones for runner advancement UI */
export const DEST_ZONES = {
  scored: { x: 200, y: 55 },
  out: { x: 345, y: 365 },
} as const;
