import type { AnyCommandNode } from '../types/command';
import type { ExpressionPoseMap } from './expressionPoseResolver';

// ─── Output types ─────────────────────────────────────────────────────────────

export type WaypointPose =
  | { kind: 'literal'; x: number; y: number; rotation: number; resolvedFrom?: string }
  | { kind: 'expression'; expression: string };

export interface DriveWaypoint {
  commandName: string;
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

// ─── Drive-to-pose call parser ────────────────────────────────────────────────

/** Command names always recognised as drive-to-pose commands. */
export const DEFAULT_DRIVE_COMMANDS = ['DriveToPose'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip a trailing `()` / `(` and surrounding whitespace from a configured name. */
export function normaliseCommandName(name: string): string {
  return name.replace(/\s*\(\s*\)?\s*$/, '').trim();
}

const ANGLE_UNIT  = /_(deg|rad|tr)\b/;
const LENGTH_UNIT = /_(mm|cm|m|ft|in)\b/;
const BOOL_ARG    = /^(true|false)$/;
const PLAIN_NUM   = /^[+-]?\d*\.?\d+$/;

/**
 * Parse a drive-to-pose call out of a leaf's raw source.
 *
 * Matches any of `commandNames` as a function call. The first argument is
 * always the target pose; the remaining arguments (speed, position tolerance,
 * rotation tolerance, flip-for-red) are detected by their *type* rather than
 * their position, so commands with different parameter orderings — e.g.
 * `DriveToPose(pose, speed, posTol, rotTol, flip)` vs
 * `AutonomousDriveTo(pose, flip, speed, posTol, rotTol)` — both parse correctly.
 */
function parseDriveCommand(
  raw: string,
  commandNames: string[],
  expressionPoseMap?: ExpressionPoseMap,
): Omit<DriveWaypoint, 'nodeId'> | null {
  // Find the earliest matching command call in the raw source.
  let best: { name: string; parenIdx: number } | null = null;
  for (const rawName of commandNames) {
    const name = normaliseCommandName(rawName);
    if (!name) continue;
    // Require a non-word char (or start) before the name so "DriveToPose"
    // doesn't match inside "MyDriveToPose".
    const match = new RegExp(`(?:^|[^\\w])${escapeRegExp(name)}\\s*\\(`).exec(raw);
    if (match) {
      const parenIdx = match.index + match[0].length - 1;
      if (!best || parenIdx < best.parenIdx) best = { name, parenIdx };
    }
  }
  if (!best) return null;

  const args = splitTopLevel(getCallArgs(raw.slice(best.parenIdx)));
  if (args.length < 1) return null;

  const pose = parsePoseArg(args[0], expressionPoseMap);
  if (pose.kind !== 'literal') return null;

  // Type-based detection of the trailing arguments.
  let speedScaling = 1.0, posTolMeters = 0.02, rotTolDeg = 2.0, flipForRed = true;
  let speedSet = false, posSet = false, rotSet = false, flipSet = false;
  for (const arg of args.slice(1)) {
    const t = arg.trim();
    if (!flipSet  && BOOL_ARG.test(t))    { flipForRed   = t === 'true';  flipSet  = true; continue; }
    if (!rotSet   && ANGLE_UNIT.test(t))  { rotTolDeg    = parseDeg(t);   rotSet   = true; continue; }
    if (!posSet   && LENGTH_UNIT.test(t)) { posTolMeters = parseMeters(t); posSet  = true; continue; }
    if (!speedSet && PLAIN_NUM.test(t))   { speedScaling = parseFloat(t); speedSet = true; continue; }
  }

  return { commandName: best.name, pose, speedScaling, posTolMeters, rotTolDeg, flipForRed, raw };
}

// ─── Tree walker ──────────────────────────────────────────────────────────────

export function extractWaypoints(
  node: AnyCommandNode,
  expressionPoseMap?: ExpressionPoseMap,
  commandNames: string[] = DEFAULT_DRIVE_COMMANDS,
): DriveWaypoint[] {
  switch (node.type) {
    case 'leaf': {
      const dtp = parseDriveCommand(node.raw, commandNames, expressionPoseMap);
      if (dtp) return [{ ...dtp, nodeId: node.id }];
      return [];
    }

    case 'sequence':
      return node.children.flatMap(c => extractWaypoints(c, expressionPoseMap, commandNames));

    case 'parallel':
    case 'race':
      return node.children.flatMap(c => extractWaypoints(c, expressionPoseMap, commandNames));

    case 'deadline':
      return [node.deadline, ...node.others].flatMap(c => extractWaypoints(c, expressionPoseMap, commandNames));

    case 'decorated':
      return extractWaypoints(node.child, expressionPoseMap, commandNames);

    case 'conditional':
      return [
        ...extractWaypoints(node.trueBranch, expressionPoseMap, commandNames),
        ...extractWaypoints(node.falseBranch, expressionPoseMap, commandNames),
      ];

    default:
      return [];
  }
}
