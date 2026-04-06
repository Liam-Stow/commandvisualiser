import { removeComments } from './cppParser';
import { parseMeters, parseDeg, splitTopLevel } from './driveToPoseParser';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Pose2dConstant {
  x: number;
  y: number;
  rotation: number;
  qualifiedName: string;
}

/** Map from expression string (qualified or short name) → resolved pose. */
export type ExpressionPoseMap = Map<string, Pose2dConstant>;

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * Scan comment-stripped C++ code for `frc::Pose2d` constant definitions and
 * return them with fully-qualified names (namespace::name).
 *
 * Supported patterns:
 *   constexpr frc::Pose2d NAME{x, y, rot};
 *   const     frc::Pose2d NAME(x, y, rot);
 *   inline constexpr auto NAME = frc::Pose2d{x, y, rot};
 *   static constexpr frc::Pose2d NAME{x, y, rot};
 */
export function extractPose2dConstants(rawCode: string): Pose2dConstant[] {
  const code = removeComments(rawCode);
  const results: Pose2dConstant[] = [];

  // Track namespace / class scope via brace depth.
  const scopeStack: string[] = [];
  let braceDepth = 0;
  // Each entry: the brace depth when the scope block was entered (before its opening brace).
  const scopeDepths: number[] = [];

  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Phase 1: Detect and push any namespace/class/struct scope openings.
    // We use a global regex to handle multiple scope openings on one line
    // (e.g. "} namespace b {") or closing-then-opening patterns.
    const scopeRe = /(?:namespace|class|struct)\s+(\w+)[^{]*\{/g;
    let scopeMatch: RegExpExecArray | null;
    while ((scopeMatch = scopeRe.exec(trimmed)) !== null) {
      // Count braces up to this match to get the correct depth
      const prefix = trimmed.slice(0, scopeMatch.index + scopeMatch[0].length);
      let d = braceDepth;
      for (const ch of prefix) {
        if (ch === '{') d++;
        else if (ch === '}') d--;
      }
      // The scope's entry depth is just before the opening brace (d - 1)
      scopeStack.push(scopeMatch[1]);
      scopeDepths.push(d - 1);
    }

    // Phase 2: Try to match a Pose2d constant on this line (scope is now up-to-date).
    const constant = tryParsePose2dLine(trimmed, scopeStack);
    if (constant) results.push(constant);

    // Phase 3: Update brace depth for the full line and pop any scopes that close.
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') {
        braceDepth--;
        if (scopeDepths.length > 0 && braceDepth === scopeDepths[scopeDepths.length - 1]) {
          scopeStack.pop();
          scopeDepths.pop();
        }
      }
    }
  }

  return results;
}

// ─── Line-level Pose2d parser ────────────────────────────────────────────────

/** Regex for lines like: [static] [inline] constexpr|const frc::Pose2d NAME{...} or NAME(...) */
const POSE_DIRECT_RE =
  /(?:static\s+)?(?:inline\s+)?(?:constexpr|const)\s+frc::Pose2d\s+(\w+)\s*[{(]/;

/** Regex for lines like: [static] [inline] constexpr|const auto NAME = frc::Pose2d{...} */
const POSE_AUTO_RE =
  /(?:static\s+)?(?:inline\s+)?(?:constexpr|const)\s+auto\s+(\w+)\s*=\s*frc::Pose2d\s*[{(]/;

function tryParsePose2dLine(line: string, scopeStack: readonly string[]): Pose2dConstant | null {
  let name: string | null = null;
  let argsStr: string | null = null;

  // Try direct declaration: constexpr frc::Pose2d NAME{x, y, rot}
  const directMatch = line.match(POSE_DIRECT_RE);
  if (directMatch) {
    name = directMatch[1];
    argsStr = extractBracketedArgs(line, directMatch.index! + directMatch[0].length - 1);
  }

  // Try auto declaration: constexpr auto NAME = frc::Pose2d{x, y, rot}
  if (!name) {
    const autoMatch = line.match(POSE_AUTO_RE);
    if (autoMatch) {
      name = autoMatch[1];
      argsStr = extractBracketedArgs(line, autoMatch.index! + autoMatch[0].length - 1);
    }
  }

  if (!name || !argsStr) return null;

  // Parse the three Pose2d components
  const parts = splitTopLevel(argsStr);
  if (parts.length < 3) return null;

  const x = parseMeters(parts[0]);
  const y = parseMeters(parts[1]);
  const rotation = parseDeg(parts[2]);

  // Build qualified name
  const qualifiedName = [...scopeStack, name].join('::');

  return { x, y, rotation, qualifiedName };
}

/** Extract the content between balanced { } or ( ) starting at `startIdx` (the opening bracket). */
function extractBracketedArgs(line: string, startIdx: number): string | null {
  const open = line[startIdx];
  const close = open === '{' ? '}' : ')';
  let depth = 1;
  let i = startIdx + 1;
  while (i < line.length && depth > 0) {
    if (line[i] === open) depth++;
    else if (line[i] === close) depth--;
    i++;
  }
  if (depth !== 0) return null;
  return line.slice(startIdx + 1, i - 1);
}

// ─── Map building ────────────────────────────────────────────────────────────

/**
 * Build a lookup map from a list of extracted poses.
 * Keys include both fully-qualified names and short (unqualified) names.
 * If a short name is ambiguous (defined in multiple scopes), only the qualified keys are kept.
 */
export function buildExpressionPoseMap(poses: Pose2dConstant[]): ExpressionPoseMap {
  const map: ExpressionPoseMap = new Map();
  const shortNameCounts = new Map<string, number>();

  for (const p of poses) {
    const shortName = p.qualifiedName.split('::').pop()!;
    shortNameCounts.set(shortName, (shortNameCounts.get(shortName) ?? 0) + 1);
  }

  for (const p of poses) {
    map.set(p.qualifiedName, p);
    const shortName = p.qualifiedName.split('::').pop()!;
    if (shortNameCounts.get(shortName) === 1) map.set(shortName, p);
  }

  return map;
}
