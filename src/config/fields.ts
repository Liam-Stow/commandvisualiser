/**
 * Field configuration — update this when the field image changes.
 * All measurements in metres unless stated.
 */
export interface FieldConfig {
  /** Human-readable label shown in the UI */
  name: string;
  /** Path served from /public (e.g. "/fields/field26.png") */
  imagePath: string;
  /** Native pixel width of the image */
  imageWidthPx: number;
  /** Native pixel height of the image */
  imageHeightPx: number;
  /** How many image pixels represent 1 metre */
  pixelsPerMeter: number;
  /**
   * The image has a uniform margin on every side before the field
   * boundary starts. This is in metres.
   */
  marginMeters: number;
}

export const FIELD_2026: FieldConfig = {
  name: '2026 Reefscape',
  imagePath: '/fields/field26.png',
  imageWidthPx: 3508,
  imageHeightPx: 1814,
  pixelsPerMeter: 200,
  marginMeters: 0.5,
};

/** Swap this constant to change which field the app uses. */
export const ACTIVE_FIELD: FieldConfig = FIELD_2026;

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Playing-field width in metres (excluding margin). */
export function fieldWidthMeters(cfg: FieldConfig): number {
  return cfg.imageWidthPx / cfg.pixelsPerMeter - 2 * cfg.marginMeters;
}

/** Playing-field height in metres (excluding margin). */
export function fieldHeightMeters(cfg: FieldConfig): number {
  return cfg.imageHeightPx / cfg.pixelsPerMeter - 2 * cfg.marginMeters;
}

/**
 * Convert a field coordinate (metres, origin = bottom-left of playing area,
 * +X right, +Y up) to image pixel coordinates.
 */
export function fieldToImagePx(
  cfg: FieldConfig,
  fx: number,
  fy: number,
): [number, number] {
  const marginPx = cfg.marginMeters * cfg.pixelsPerMeter;
  const imgX = marginPx + fx * cfg.pixelsPerMeter;
  const imgY = cfg.imageHeightPx - marginPx - fy * cfg.pixelsPerMeter;
  return [imgX, imgY];
}

/**
 * Flip a field-coordinate X for the red alliance.
 * Red-alliance poses mirror across the centre line (X axis flip).
 */
export function flipXForRed(cfg: FieldConfig, fx: number): number {
  return fieldWidthMeters(cfg) - fx;
}

/**
 * Flip a rotation (degrees) for the red alliance.
 */
export function flipRotForRed(rot: number): number {
  return 180 - rot;
}
