import type { AnyCommandNode } from '../types/command';

export interface LayoutNode {
  command: AnyCommandNode;
  x: number;        // absolute x in SVG space at zoom=1
  y: number;        // absolute y in SVG space at zoom=1
  width: number;    // total width  (px at zoom=1)
  height: number;   // total height (px at zoom=1)
  children: LayoutNode[];
  deadlineChildIndex?: number;
}

// ─── Sizing constants (px at zoom=1) ─────────────────────────────────────────
// All group heights include the header strip and inner padding, so children are
// always positioned below the header — eliminating any possibility of overlap.

export const L_LEAF_W   = 150;   // leaf width
export const L_LEAF_H   = 60;    // leaf height
export const L_HEADER_H = 26;    // group / modifier header strip height
export const L_PAD      = 8;     // space between a group's border and its children
export const L_GAP      = 6;     // space between sibling children

// ─── Layout helpers ───────────────────────────────────────────────────────────

function emptyGroup(node: AnyCommandNode, x: number, y: number): LayoutNode {
  return {
    command: node, x, y,
    width:  L_LEAF_W  + L_PAD * 2,
    height: L_LEAF_H  + L_HEADER_H + L_PAD * 2,
    children: [],
  };
}

// ─── Public layout entry point ────────────────────────────────────────────────

export function computeLayout(node: AnyCommandNode, x = 0, y = 0): LayoutNode {
  switch (node.type) {

    // ── Leaf / unknown ────────────────────────────────────────────────────────
    case 'leaf':
    case 'unknown':
      return { command: node, x, y, width: L_LEAF_W, height: L_LEAF_H, children: [] };

    // ── Decorated (until, timeout, repeatedly, …) ────────────────────────────
    case 'decorated': {
      const child = computeLayout(node.child, x + L_PAD, y + L_HEADER_H + L_PAD);
      return {
        command: node, x, y,
        width:  child.width  + L_PAD * 2,
        height: child.height + L_HEADER_H + L_PAD * 2,
        children: [child],
      };
    }

    // ── Sequence ──────────────────────────────────────────────────────────────
    case 'sequence': {
      if (node.children.length === 0) return emptyGroup(node, x, y);
      const childY = y + L_HEADER_H + L_PAD;
      let curX = x + L_PAD;
      const children = node.children.map(c => {
        const child = computeLayout(c, curX, childY);
        curX += child.width + L_GAP;
        return child;
      });
      const w = (curX - L_GAP - x) + L_PAD;
      const h = L_HEADER_H + L_PAD + Math.max(...children.map(c => c.height)) + L_PAD;
      return { command: node, x, y, width: w, height: h, children };
    }

    // ── Parallel / Race ───────────────────────────────────────────────────────
    case 'parallel':
    case 'race': {
      if (node.children.length === 0) return emptyGroup(node, x, y);
      let curY = y + L_HEADER_H + L_PAD;
      const children = node.children.map(c => {
        const child = computeLayout(c, x + L_PAD, curY);
        curY += child.height + L_GAP;
        return child;
      });
      const w = L_PAD + Math.max(...children.map(c => c.width)) + L_PAD;
      const h = (curY - L_GAP - y) + L_PAD;
      return { command: node, x, y, width: w, height: h, children };
    }

    // ── Deadline ──────────────────────────────────────────────────────────────
    case 'deadline': {
      const allNodes = [node.deadline, ...node.others];
      let curY = y + L_HEADER_H + L_PAD;
      const children = allNodes.map(c => {
        const child = computeLayout(c, x + L_PAD, curY);
        curY += child.height + L_GAP;
        return child;
      });
      const w = L_PAD + Math.max(...children.map(c => c.width)) + L_PAD;
      const h = (curY - L_GAP - y) + L_PAD;
      return { command: node, x, y, width: w, height: h, children, deadlineChildIndex: 0 };
    }

    // ── Conditional (either/else) ─────────────────────────────────────────────
    case 'conditional': {
      const trueLayout  = computeLayout(node.trueBranch,  x + L_PAD, y + L_HEADER_H + L_PAD);
      const falseLayout = computeLayout(
        node.falseBranch,
        x + L_PAD,
        y + L_HEADER_H + L_PAD + trueLayout.height + L_GAP,
      );
      const w = L_PAD + Math.max(trueLayout.width, falseLayout.width) + L_PAD;
      const h = L_HEADER_H + L_PAD + trueLayout.height + L_GAP + falseLayout.height + L_PAD;
      return { command: node, x, y, width: w, height: h, children: [trueLayout, falseLayout] };
    }
  }
}
