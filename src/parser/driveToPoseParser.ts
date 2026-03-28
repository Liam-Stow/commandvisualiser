import type { AnyCommandNode } from '../types/command';

// ─── Output types ─────────────────────────────────────────────────────────────

export type WaypointPose =
  | { kind: 'numeric'; x: number; y: number; rotation: number }
  | { kind: 'named';   name: string };

export interface DriveWaypoint {
  /** DriveToPose = full pose+tolerance, DriveOverBump = translation only */
  command: 'DriveToPose' | 'DriveOverBump';
  pose: WaypointPose;
  speedScaling: number;
  /** metres */
  posTolMeters: number;
  /** degrees */
  rotTolDeg: number;
  flipForRed: boolean;
  raw: string;
}

// ─── Unit parsing ─────────────────────────────────────────────────────────────

function parseMeters(s: string): number {
  s = s.trim();
  const m   = s.match(/^([+-]?\d*\.?\d+)\s*_m$/);   if (m) return +m[1];
  const cm  = s.match(/^([+-]?\d*\.?\d+)\s*_cm$/);  if (cm) return +cm[1] / 100;
  const ft  = s.match(/^([+-]?\d*\.?\d+)\s*_ft$/);  if (ft) return +ft[1] * 0.3048;
  const _in = s.match(/^([+-]?\d*\.?\d+)\s*_in$/);  if (_in) return +_in[1] * 0.0254;
  return parseFloat(s) || 0;
}

function parseDeg(s: string): number {
  s = s.trim();
  const deg = s.match(/^([+-]?\d*\.?\d+)\s*_deg$/); if (deg) return +deg[1];
  const rad = s.match(/^([+-]?\d*\.?\d+)\s*_rad$/); if (rad) return +rad[1] * (180 / Math.PI);
  const tr  = s.match(/^([+-]?\d*\.?\d+)\s*_tr$/);  if (tr)  return +tr[1] * 360;
  return parseFloat(s) || 0;
}

// ─── Balanced-bracket helpers (duplicated locally to avoid circular import) ───

function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const c of str) {
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { if (cur.trim()) parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function getCallArgs(expr: string): string {
  const start = expr.indexOf('(');
  if (start === -1) return '';
  let depth = 1, i = start + 1;
  while (i < expr.length && depth > 0) {
    if ('([{'.includes(expr[i])) depth++;
    else if (')]}'.includes(expr[i])) depth--;
    i++;
  }
  return expr.slice(start + 1, i - 1);
}

// ─── Pose extraction ──────────────────────────────────────────────────────────

function parsePoseArg(arg: string): WaypointPose {
  // frc::Pose2d{x, y, rot} — curly-brace constructor
  const braceMatch = arg.match(/frc::Pose2d\s*\{([^{}]+)\}/);
  if (braceMatch) {
    const parts = splitTopLevel(braceMatch[1]);
    if (parts.length >= 3) {
      return {
        kind: 'numeric',
        x: parseMeters(parts[0]),
        y: parseMeters(parts[1]),
        rotation: parseDeg(parts[2]),
      };
    }
  }

  // frc::Pose2d(x, y, rot) — paren constructor
  const parenMatch = arg.match(/frc::Pose2d\s*\(([^()]+)\)/);
  if (parenMatch) {
    const parts = splitTopLevel(parenMatch[1]);
    if (parts.length >= 3) {
      return {
        kind: 'numeric',
        x: parseMeters(parts[0]),
        y: parseMeters(parts[1]),
        rotation: parseDeg(parts[2]),
      };
    }
  }

  // fieldpos::CONSTANT_NAME
  const fieldposMatch = arg.match(/fieldpos::(\w+)/);
  if (fieldposMatch) return { kind: 'named', name: fieldposMatch[1] };

  // Generic named reference: last word before semicolon / end
  const namedMatch = arg.match(/return\s+([\w:]+)\s*;?\s*$/);
  if (namedMatch) return { kind: 'named', name: namedMatch[1] };

  return { kind: 'named', name: arg.replace(/\s+/g, ' ').trim().slice(0, 40) };
}

// ─── DriveToPose call parser ──────────────────────────────────────────────────

function parseDriveToPose(raw: string): DriveWaypoint | null {
  const dtpIdx = raw.indexOf('DriveToPose(');
  if (dtpIdx === -1) return null;

  const argsStr = getCallArgs(raw.slice(dtpIdx + 'DriveToPose'.length));
  const args    = splitTopLevel(argsStr);
  if (args.length < 2) return null;

  const pose         = parsePoseArg(args[0]);
  const speedScaling = parseFloat(args[1]) || 1.0;
  const posTolMeters = args[2] ? parseMeters(args[2]) : 0.02;
  const rotTolDeg    = args[3] ? parseDeg(args[3])    : 2.0;
  const flipForRed   = args[4] ? args[4].trim() !== 'false' : true;

  return { command: 'DriveToPose', pose, speedScaling, posTolMeters, rotTolDeg, flipForRed, raw };
}

function parseDriveOverBump(raw: string): DriveWaypoint | null {
  const idx = raw.indexOf('DriveOverBump(');
  if (idx === -1) return null;

  const argsStr = getCallArgs(raw.slice(idx + 'DriveOverBump'.length));
  const args    = splitTopLevel(argsStr);

  // arg[1] is Translation2d{x, y}
  let pose: WaypointPose = { kind: 'named', name: 'DriveOverBump target' };
  if (args[1]) {
    const t2dMatch = args[1].match(/Translation2d\s*\{([^{}]+)\}/);
    if (t2dMatch) {
      const parts = splitTopLevel(t2dMatch[1]);
      if (parts.length >= 2) {
        pose = { kind: 'numeric', x: parseMeters(parts[0]), y: parseMeters(parts[1]), rotation: 0 };
      }
    }
  }

  return { command: 'DriveOverBump', pose, speedScaling: 1, posTolMeters: 0.05, rotTolDeg: 5, flipForRed: true, raw };
}

// ─── Tree walker ──────────────────────────────────────────────────────────────

export function extractWaypoints(node: AnyCommandNode): DriveWaypoint[] {
  switch (node.type) {
    case 'leaf': {
      const dtp = parseDriveToPose(node.raw);
      if (dtp) return [dtp];
      const dob = parseDriveOverBump(node.raw);
      if (dob) return [dob];
      return [];
    }

    case 'sequence':
      return node.children.flatMap(extractWaypoints);

    case 'parallel':
    case 'race':
      return node.children.flatMap(extractWaypoints);

    case 'deadline':
      return [node.deadline, ...node.others].flatMap(extractWaypoints);

    case 'decorated':
      return extractWaypoints(node.child);

    case 'conditional':
      return [
        ...extractWaypoints(node.trueBranch),
        ...extractWaypoints(node.falseBranch),
      ];

    default:
      return [];
  }
}
