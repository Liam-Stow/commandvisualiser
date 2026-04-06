import type { AnyCommandNode } from '../types/command';
import type { ExpressionPoseMap } from './expressionPoseResolver';

// ─── Output types ─────────────────────────────────────────────────────────────

export type WaypointPose =
  | { kind: 'literal'; x: number; y: number; rotation: number; resolvedFrom?: string }
  | { kind: 'expression'; expression: string };

export interface DriveWaypoint {
  commandName: String;
  pose: WaypointPose;
  speedScaling: number;
  posTolMeters: number;
  rotTolDeg: number;
  flipForRed: boolean;
  raw: string;
  /** id of the LeafNode this waypoint came from — used for cross-highlighting */
  nodeId: string;
}

// ─── Unit parsing ─────────────────────────────────────────────────────────────

export function parseMeters(s: string): number {
  s = s.trim();
  const m   = s.match(/^([+-]?\d*\.?\d+)\s*_m$/);   if (m) return +m[1];
  const cm  = s.match(/^([+-]?\d*\.?\d+)\s*_cm$/);  if (cm) return +cm[1] / 100;
  const ft  = s.match(/^([+-]?\d*\.?\d+)\s*_ft$/);  if (ft) return +ft[1] * 0.3048;
  const _in = s.match(/^([+-]?\d*\.?\d+)\s*_in$/);  if (_in) return +_in[1] * 0.0254;
  return parseFloat(s) || 0;
}

export function parseDeg(s: string): number {
  s = s.trim();
  const deg = s.match(/^([+-]?\d*\.?\d+)\s*_deg$/); if (deg) return +deg[1];
  const rad = s.match(/^([+-]?\d*\.?\d+)\s*_rad$/); if (rad) return +rad[1] * (180 / Math.PI);
  const tr  = s.match(/^([+-]?\d*\.?\d+)\s*_tr$/);  if (tr)  return +tr[1] * 360;
  return parseFloat(s) || 0;
}

// ─── Balanced-bracket helpers ────────────────────────────────────────────────

export function splitTopLevel(str: string): string[] {
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

function parsePoseArg(arg: string, expressionPoseMap?: ExpressionPoseMap): WaypointPose {
  // frc::Pose2d{x, y, rot} — curly-brace constructor
  const braceMatch = arg.match(/frc::Pose2d\s*\{([^{}]+)\}/);
  if (braceMatch) {
    const parts = splitTopLevel(braceMatch[1]);
    if (parts.length >= 3) {
      return {
        kind: 'literal',
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
        kind: 'literal',
        x: parseMeters(parts[0]),
        y: parseMeters(parts[1]),
        rotation: parseDeg(parts[2]),
      };
    }
  }

  // Try resolving named constant (e.g. fieldConstants::FRONT_LEFT)
  // Also unwrap no-capture lambdas: [] { return fieldpos::FRONT_LEFT; }
  if (expressionPoseMap) {
    let expr = arg.trim();
    const lambdaMatch = expr.match(/^\[.*?\]\s*\{\s*return\s+(.+?);\s*\}$/s);
    if (lambdaMatch) expr = lambdaMatch[1].trim();
    const key = expr.replace(/\s+/g, '');
    const resolved = expressionPoseMap.get(key);
    if (resolved) {
      return {
        kind: 'literal',
        x: resolved.x,
        y: resolved.y,
        rotation: resolved.rotation,
        resolvedFrom: resolved.qualifiedName,
      };
    }
  }

  return { kind: 'expression', expression: arg.replace(/\s+/g, ' ').trim().slice(0, 40) };
}

// ─── DriveToPose call parser ──────────────────────────────────────────────────

function parseDriveToPose(raw: string, expressionPoseMap?: ExpressionPoseMap): Omit<DriveWaypoint, 'nodeId'> | null {
  const dtpIdx = raw.indexOf('DriveToPose(');
  if (dtpIdx === -1) return null;

  const argsStr = getCallArgs(raw.slice(dtpIdx + 'DriveToPose'.length));
  const args    = splitTopLevel(argsStr);
  if (args.length < 1) return null;

  const pose = parsePoseArg(args[0], expressionPoseMap);
  if (pose.kind !== 'literal') return null;

  const speedScaling = args[1] ? (parseFloat(args[1]) || 1.0) : 1.0;
  const posTolMeters = args[2] ? parseMeters(args[2]) : 0.02;
  const rotTolDeg    = args[3] ? parseDeg(args[3])    : 2.0;
  const flipForRed   = args[4] ? args[4].trim() !== 'false' : true;

  return { commandName: 'DriveToPose', pose, speedScaling, posTolMeters, rotTolDeg, flipForRed, raw };
}

// ─── Tree walker ──────────────────────────────────────────────────────────────

export function extractWaypoints(node: AnyCommandNode, expressionPoseMap?: ExpressionPoseMap): DriveWaypoint[] {
  switch (node.type) {
    case 'leaf': {
      const dtp = parseDriveToPose(node.raw, expressionPoseMap);
      if (dtp) return [{ ...dtp, nodeId: node.id }];
      return [];
    }

    case 'sequence':
      return node.children.flatMap(c => extractWaypoints(c, expressionPoseMap));

    case 'parallel':
    case 'race':
      return node.children.flatMap(c => extractWaypoints(c, expressionPoseMap));

    case 'deadline':
      return [node.deadline, ...node.others].flatMap(c => extractWaypoints(c, expressionPoseMap));

    case 'decorated':
      return extractWaypoints(node.child, expressionPoseMap);

    case 'conditional':
      return [
        ...extractWaypoints(node.trueBranch, expressionPoseMap),
        ...extractWaypoints(node.falseBranch, expressionPoseMap),
      ];

    default:
      return [];
  }
}
