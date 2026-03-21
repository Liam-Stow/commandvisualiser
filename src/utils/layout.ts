import type { AnyCommandNode } from '../types/command';

export interface LayoutNode {
  command: AnyCommandNode;
  x: number;      // start time (in abstract units)
  y: number;      // start track index
  width: number;  // duration (in units)
  height: number; // number of tracks occupied
  children: LayoutNode[];
  /** For deadline nodes, marks which child index is the deadline */
  deadlineChildIndex?: number;
}

export function computeLayout(node: AnyCommandNode, x = 0, y = 0): LayoutNode {
  switch (node.type) {
    case 'leaf':
    case 'unknown':
      return { command: node, x, y, width: 1, height: 1, children: [] };

    case 'modified': {
      const inner = computeLayout(node.child, x, y);
      return { command: node, x, y, width: inner.width, height: inner.height, children: [inner] };
    }

    case 'sequence': {
      if (node.children.length === 0)
        return { command: node, x, y, width: 1, height: 1, children: [] };

      let curX = x;
      const children = node.children.map(child => {
        const layout = computeLayout(child, curX, y);
        curX += layout.width;
        return layout;
      });
      const maxHeight = Math.max(...children.map(c => c.height));
      return { command: node, x, y, width: curX - x, height: maxHeight, children };
    }

    case 'parallel':
    case 'race': {
      if (node.children.length === 0)
        return { command: node, x, y, width: 1, height: 1, children: [] };

      let curY = y;
      const children = node.children.map(child => {
        const layout = computeLayout(child, x, curY);
        curY += layout.height;
        return layout;
      });
      const maxWidth = Math.max(...children.map(c => c.width));
      return { command: node, x, y, width: maxWidth, height: curY - y, children };
    }

    case 'deadline': {
      // First child = deadline (index 0), then others
      const allNodes = [node.deadline, ...node.others];
      if (allNodes.length === 0)
        return { command: node, x, y, width: 1, height: 1, children: [] };

      let curY = y;
      const children = allNodes.map(child => {
        const layout = computeLayout(child, x, curY);
        curY += layout.height;
        return layout;
      });
      const maxWidth = Math.max(...children.map(c => c.width));
      return {
        command: node, x, y, width: maxWidth, height: curY - y,
        children, deadlineChildIndex: 0,
      };
    }

    case 'conditional': {
      const trueLayout  = computeLayout(node.trueBranch,  x, y);
      const falseLayout = computeLayout(node.falseBranch, x, y + trueLayout.height);
      const maxWidth    = Math.max(trueLayout.width, falseLayout.width);
      return {
        command: node, x, y,
        width:  maxWidth,
        height: trueLayout.height + falseLayout.height,
        children: [trueLayout, falseLayout],
      };
    }
  }
}
