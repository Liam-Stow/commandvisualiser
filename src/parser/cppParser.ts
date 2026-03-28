import type {
  AnyCommandNode,
  SequenceNode,
  ParallelNode,
  RaceNode,
  DeadlineNode,
  LeafNode,
  DecoratedNode,
  ConditionalNode,
  CommandFunction,
  ParsedFile,
} from '../types/command';

let _idCounter = 0;
function newId(): string {
  return `node_${++_idCounter}`;
}

// ─── Comment removal ───────────────────────────────────────────────────────────

function removeComments(code: string): string {
  let result = '';
  let i = 0;
  while (i < code.length) {
    // Line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String literal (skip to avoid false positives)
    if (code[i] === '"') {
      result += code[i++];
      while (i < code.length && code[i] !== '"') {
        if (code[i] === '\\') result += code[i++];
        result += code[i++];
      }
      if (i < code.length) result += code[i++];
      continue;
    }
    result += code[i++];
  }
  return result;
}

// ─── Core parsing utilities ───────────────────────────────────────────────────

/**
 * Split a string at top-level commas (not inside brackets).
 * Handles (), [], {} nesting.
 */
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
      continue;
    }
    current += c;
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

/**
 * Given an expression like "SomeName(args...)", extract the content between
 * the first '(' and its matching ')'.
 */
function getCallArgs(expr: string): string {
  const start = expr.indexOf('(');
  if (start === -1) return '';
  let depth = 1;
  let i = start + 1;
  while (i < expr.length && depth > 0) {
    const c = expr[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    i++;
  }
  return expr.slice(start + 1, i - 1);
}

// ─── Decorator / method chain splitting ───────────────────────────────────────

const DECORATORS = new Set([
  'AndThen', 'AlongWith', 'RaceWith', 'DeadlineFor', 'DeadlineWith', 'WithDeadline',
  'WithTimeout', 'Until', 'Unless', 'OnlyIf', 'Repeatedly', 'IgnoringDisable',
  'FinallyDo', 'HandleInterrupt', 'AsProxy', 'WithInterruptBehavior',
]);

interface Decorator { name: string; args: string }

/**
 * Split an expression into its base (non-decorator start) and a list of
 * chained decorator calls in order.
 *
 * e.g. "A.AlongWith(B).WithTimeout(5_s)"
 *   → base: "A", decorators: [{name:'AlongWith',args:'B'}, {name:'WithTimeout',args:'5_s'}]
 */
function splitMethodChain(expr: string): { base: string; decorators: Decorator[] } {
  const decorators: Decorator[] = [];
  let depth = 0;
  let i = 0;
  let baseEnd = -1; // index of the first decorator's '.'

  while (i < expr.length) {
    const c = expr[i];

    if (c === '(' || c === '[' || c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      i++;
      continue;
    }

    if (c === '.' && depth === 0 && i > 0) {
      // Read the method name
      let j = i + 1;
      let name = '';
      while (j < expr.length && /[a-zA-Z_0-9]/.test(expr[j])) {
        name += expr[j++];
      }

      if (DECORATORS.has(name) && j < expr.length && expr[j] === '(') {
        // Record where the base ends (only on first decorator)
        if (baseEnd === -1) baseEnd = i;

        // Extract the decorator's arguments (between matching parens)
        const argsStart = j + 1;
        let argDepth = 1;
        let k = argsStart;
        while (k < expr.length && argDepth > 0) {
          const ac = expr[k];
          if (ac === '(' || ac === '[' || ac === '{') argDepth++;
          else if (ac === ')' || ac === ']' || ac === '}') argDepth--;
          k++;
        }
        decorators.push({ name, args: expr.slice(argsStart, k - 1).trim() });
        i = k; // jump past the decorator's closing paren
        continue;
      }
    }

    i++;
  }

  const base = (baseEnd === -1 ? expr : expr.slice(0, baseEnd)).trim();
  return { base, decorators };
}

// ─── Leaf name extraction ─────────────────────────────────────────────────────

interface LeafInfo { name: string; subsystem?: string }

function extractLeafInfo(expr: string): LeafInfo {
  const e = expr.trim();

  // SubXxx::GetInstance().MethodName(
  const subMatch = e.match(/^(\w+)::GetInstance\(\)\s*\.\s*(\w+)\s*\(/);
  if (subMatch) return { name: subMatch[2] + '()', subsystem: subMatch[1] };

  // frc2::cmd::Something(
  const frc2Match = e.match(/^frc2::cmd::(\w+)\s*\(/);
  if (frc2Match) return { name: frc2Match[1] + '()' };

  // cmd::Something(
  const cmdMatch = e.match(/^cmd::(\w+)\s*\(/);
  if (cmdMatch) return { name: cmdMatch[1] + '()' };

  // Plain function call
  const plainMatch = e.match(/^(\w+)\s*\(/);
  if (plainMatch) return { name: plainMatch[1] + '()' };

  // Fallback: truncate
  return { name: e.length > 40 ? e.slice(0, 40) + '…' : e };
}

// ─── AST construction ─────────────────────────────────────────────────────────

function makeLeaf(raw: string): LeafNode {
  const info = extractLeafInfo(raw);
  return { type: 'leaf', id: newId(), name: info.name, subsystem: info.subsystem, raw };
}

function applyDecorator(node: AnyCommandNode, name: string, args: string): AnyCommandNode {
  const argNode = args ? parseExpr(args) : null;

  switch (name) {
    case 'AndThen': {
      if (!argNode) return node;
      // Flatten: if current is already a sequence, extend it
      if (node.type === 'sequence') {
        const extra = argNode.type === 'sequence' ? argNode.children : [argNode];
        return { ...node, children: [...node.children, ...extra] } as SequenceNode;
      }
      const extra = argNode.type === 'sequence' ? argNode.children : [argNode];
      return { type: 'sequence', id: newId(), children: [node, ...extra] };
    }

    case 'AlongWith': {
      if (!argNode) return node;
      if (node.type === 'parallel') {
        return { ...node, children: [...node.children, argNode] } as ParallelNode;
      }
      return { type: 'parallel', id: newId(), children: [node, argNode] };
    }

    case 'RaceWith': {
      if (!argNode) return node;
      if (node.type === 'race') {
        return { ...node, children: [...node.children, argNode] } as RaceNode;
      }
      return { type: 'race', id: newId(), children: [node, argNode] };
    }

    case 'DeadlineFor':
    case 'DeadlineWith': {
      // Current node IS the deadline; argNode runs alongside
      if (!argNode) return node;
      return { type: 'deadline', id: newId(), deadline: node, others: [argNode] } as DeadlineNode;
    }

    case 'WithDeadline': {
      // argNode IS the deadline; current node runs alongside it
      if (!argNode) return node;
      return { type: 'deadline', id: newId(), deadline: argNode, others: [node] } as DeadlineNode;
    }

    case 'WithTimeout':
      return { type: 'decorated', id: newId(), decorator: 'timeout', decoratorArg: args.trim(), child: node } as DecoratedNode;

    case 'Until':
      return { type: 'decorated', id: newId(), decorator: 'until', child: node } as DecoratedNode;

    case 'Unless':
      return { type: 'decorated', id: newId(), decorator: 'unless', child: node } as DecoratedNode;

    case 'OnlyIf':
      return { type: 'decorated', id: newId(), decorator: 'onlyIf', child: node } as DecoratedNode;

    case 'Repeatedly':
      return { type: 'decorated', id: newId(), decorator: 'repeatedly', child: node } as DecoratedNode;

    case 'IgnoringDisable':
      return { type: 'decorated', id: newId(), decorator: 'ignoringDisable', decoratorArg: args.trim(), child: node } as DecoratedNode;

    default:
      return { type: 'decorated', id: newId(), decorator: name, child: node } as DecoratedNode;
  }
}

/**
 * Match a command factory call regardless of namespace prefix.
 * Handles frc2::cmd::Name(, cmd::Name(, and plain Name( so that
 * code using `using namespace frc2::cmd;` or a namespace alias is
 * parsed correctly.
 */
function matchesFn(e: string, fn: string): boolean {
  return (
    e.startsWith(`frc2::cmd::${fn}(`) ||
    e.startsWith(`cmd::${fn}(`) ||
    e.startsWith(`${fn}(`)
  );
}

function parseBaseExpr(expr: string): AnyCommandNode {
  const e = expr.trim();
  if (!e) return { type: 'unknown', id: newId(), raw: '' };

  // ── Sequence(...)
  if (matchesFn(e, 'Sequence')) {
    const args = splitTopLevel(getCallArgs(e));
    if (args.length === 0) return makeLeaf(e);
    return { type: 'sequence', id: newId(), children: args.map(parseExpr) };
  }

  // ── RepeatingSequence(...)
  if (matchesFn(e, 'RepeatingSequence')) {
    const args = splitTopLevel(getCallArgs(e));
    const inner: SequenceNode = { type: 'sequence', id: newId(), children: args.map(parseExpr) };
    return { type: 'decorated', id: newId(), decorator: 'repeatedly', child: inner };
  }

  // ── Parallel(...)
  if (matchesFn(e, 'Parallel')) {
    const args = splitTopLevel(getCallArgs(e));
    if (args.length === 0) return makeLeaf(e);
    return { type: 'parallel', id: newId(), children: args.map(parseExpr) };
  }

  // ── Race(...)
  if (matchesFn(e, 'Race')) {
    const args = splitTopLevel(getCallArgs(e));
    if (args.length === 0) return makeLeaf(e);
    return { type: 'race', id: newId(), children: args.map(parseExpr) };
  }

  // ── Deadline(deadlineCmd, others...)
  if (matchesFn(e, 'Deadline')) {
    const args = splitTopLevel(getCallArgs(e)).map(parseExpr);
    if (args.length === 0) return makeLeaf(e);
    return { type: 'deadline', id: newId(), deadline: args[0], others: args.slice(1) };
  }

  // ── Either(trueCmd, falseCmd, condition) or frc2::ConditionalCommand
  if (matchesFn(e, 'Either') || e.startsWith('frc2::ConditionalCommand(')) {
    const args = splitTopLevel(getCallArgs(e));
    if (args.length >= 2) {
      return {
        type: 'conditional', id: newId(),
        trueBranch: parseExpr(args[0]),
        falseBranch: parseExpr(args[1]),
        condition: args[2],
      } as ConditionalNode;
    }
    return makeLeaf(e);
  }

  // ── Select<T>(...)
  if (e.startsWith('frc2::cmd::Select') || e.startsWith('cmd::Select') || e.startsWith('Select<') || e.startsWith('Select(')) {
    return { type: 'leaf', id: newId(), name: 'Select()', raw: e };
  }

  // ── Wait(time)
  if (matchesFn(e, 'Wait')) {
    const args = getCallArgs(e);
    return { type: 'leaf', id: newId(), name: `Wait(${args.trim()})`, raw: e };
  }

  // ── WaitUntil(cond)
  if (matchesFn(e, 'WaitUntil')) {
    return { type: 'leaf', id: newId(), name: 'WaitUntil()', raw: e };
  }

  // ── RunOnce(...)
  if (matchesFn(e, 'RunOnce')) {
    return { type: 'leaf', id: newId(), name: 'RunOnce()', raw: e };
  }

  // ── StartEnd(...)
  if (matchesFn(e, 'StartEnd')) {
    return { type: 'leaf', id: newId(), name: 'StartEnd()', raw: e };
  }

  // ── Print(...)
  if (matchesFn(e, 'Print')) {
    return { type: 'leaf', id: newId(), name: 'Print()', raw: e };
  }

  // ── None()
  if (matchesFn(e, 'None')) {
    return { type: 'leaf', id: newId(), name: 'None()', raw: e };
  }

  // ── ScheduleCommand(...)
  if (e.startsWith('frc2::ScheduleCommand(') || matchesFn(e, 'ScheduleCommand')) {
    return { type: 'leaf', id: newId(), name: 'ScheduleCommand()', raw: e };
  }

  // Everything else is a leaf (subsystem commands, cmd:: calls, etc.)
  return makeLeaf(e);
}

function parseExpr(expr: string): AnyCommandNode {
  const e = expr.trim();
  if (!e) return { type: 'unknown', id: newId(), raw: '' };

  const { base, decorators } = splitMethodChain(e);
  let node = parseBaseExpr(base);

  for (const dec of decorators) {
    node = applyDecorator(node, dec.name, dec.args);
  }

  return node;
}

// ─── Function body / return extraction ───────────────────────────────────────

/**
 * Find the return expression at the top scope of the given function body.
 * Handles multiple return statements by returning the last top-level one.
 */
function extractReturnExpr(body: string): string | null {
  let depth = 0;
  let lastReturnStart = -1;

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }

    if (depth === 0 && body.slice(i, i + 6) === 'return') {
      const after = body[i + 6] ?? ' ';
      const before = i === 0 ? ' ' : body[i - 1];
      if (/[\s;{}]/.test(before) && /[\s(]/.test(after)) {
        lastReturnStart = i + 6;
      }
    }
  }

  if (lastReturnStart === -1) return null;

  // Skip whitespace after 'return'
  let start = lastReturnStart;
  while (start < body.length && /\s/.test(body[start])) start++;

  // Find the semicolon at depth 0
  depth = 0;
  let end = start;
  while (end < body.length) {
    const c = body[end];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) break;
    end++;
  }

  return body.slice(start, end).trim();
}

/**
 * Find all frc2::CommandPtr function definitions in the cleaned code.
 */
function findCommandFunctions(cleanCode: string): CommandFunction[] {
  const results: CommandFunction[] = [];

  // Match "frc2::CommandPtr FuncName(" or "frc2::CommandPtr Class::FuncName("
  const pattern = /frc2::CommandPtr\s+([\w:]+)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleanCode)) !== null) {
    const fullName = match[1];
    const shortName = fullName.includes('::') ? fullName.split('::').pop()! : fullName;

    const afterReturnType = match.index + match[0].length - 1; // position of '('

    // Walk past the parameter list
    let parenDepth = 0;
    let bodyStart = -1;
    for (let i = afterReturnType; i < cleanCode.length; i++) {
      const c = cleanCode[i];
      if (c === '(') parenDepth++;
      else if (c === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          // Find the opening brace
          for (let j = i + 1; j < cleanCode.length; j++) {
            if (cleanCode[j] === '{') { bodyStart = j; break; }
            if (!/[\s\n\r\t]/.test(cleanCode[j])) break;
          }
          break;
        }
      }
    }

    if (bodyStart === -1) continue;

    // Find matching closing brace
    let braceDepth = 1;
    let bodyEnd = bodyStart + 1;
    while (bodyEnd < cleanCode.length && braceDepth > 0) {
      const c = cleanCode[bodyEnd];
      if (c === '{') braceDepth++;
      else if (c === '}') braceDepth--;
      bodyEnd++;
    }

    const body = cleanCode.slice(bodyStart + 1, bodyEnd - 1);
    const returnExpr = extractReturnExpr(body);

    if (returnExpr) {
      try {
        const node = parseExpr(returnExpr);
        results.push({ name: shortName, fullName, node, raw: returnExpr });
      } catch {
        results.push({
          name: shortName, fullName,
          node: { type: 'unknown', id: newId(), raw: returnExpr },
          raw: returnExpr,
        });
      }
    }
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function detectCategory(filePath: string): 'commands' | 'subsystems' | 'other' {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');
  if (lower.includes('/commands/')) return 'commands';
  if (lower.includes('/subsystems/')) return 'subsystems';
  return 'other';
}

export function parseFile(fileName: string, filePath: string, code: string): ParsedFile {
  const clean = removeComments(code);
  const functions = findCommandFunctions(clean);
  return {
    fileName,
    filePath,
    category: detectCategory(filePath),
    functions,
  };
}
