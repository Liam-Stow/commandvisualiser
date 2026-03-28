import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  L_LEAF_W,
  L_LEAF_H,
  L_HEADER_H,
  L_PAD,
  L_GAP,
} from './layout';
import type {
  AnyCommandNode,
  SequenceNode,
  ParallelNode,
  RaceNode,
  DeadlineNode,
  DecoratedNode,
  ConditionalNode,
} from '../types/command';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leaf(id: string): AnyCommandNode {
  return { type: 'leaf', id, name: id, raw: '' };
}

function unknown(id: string): AnyCommandNode {
  return { type: 'unknown', id, raw: '' };
}

// ─── Leaf / unknown ────────────────────────────────────────────────────────────

describe('leaf and unknown nodes', () => {
  it('leaf has standard dimensions', () => {
    const layout = computeLayout(leaf('a'));
    expect(layout.width).toBe(L_LEAF_W);
    expect(layout.height).toBe(L_LEAF_H);
    expect(layout.children).toHaveLength(0);
  });

  it('leaf is placed at given x/y', () => {
    const layout = computeLayout(leaf('a'), 50, 30);
    expect(layout.x).toBe(50);
    expect(layout.y).toBe(30);
  });

  it('unknown node has same dimensions as leaf', () => {
    const layout = computeLayout(unknown('u'));
    expect(layout.width).toBe(L_LEAF_W);
    expect(layout.height).toBe(L_LEAF_H);
  });

  it('leaf layout references the original command node', () => {
    const node = leaf('a');
    const layout = computeLayout(node);
    expect(layout.command).toBe(node);
  });
});

// ─── Sequence ─────────────────────────────────────────────────────────────────

describe('sequence layout', () => {
  it('single child: width = PAD + LEAF_W + PAD', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a')] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + L_LEAF_W + L_PAD);
  });

  it('two children: width = PAD + W + GAP + W + PAD', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a'), leaf('b')] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + L_LEAF_W + L_GAP + L_LEAF_W + L_PAD);
  });

  it('three children: width = PAD + W + GAP + W + GAP + W + PAD', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a'), leaf('b'), leaf('c')] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + L_LEAF_W + L_GAP + L_LEAF_W + L_GAP + L_LEAF_W + L_PAD);
  });

  it('height = HEADER_H + PAD + LEAF_H + PAD', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a')] };
    const layout = computeLayout(node);
    expect(layout.height).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_PAD);
  });

  it('children placed left-to-right', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a'), leaf('b')] };
    const layout = computeLayout(node);
    expect(layout.children[0].x).toBe(L_PAD);
    expect(layout.children[1].x).toBe(L_PAD + L_LEAF_W + L_GAP);
  });

  it('children placed below the header', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a')] };
    const layout = computeLayout(node);
    expect(layout.children[0].y).toBe(L_HEADER_H + L_PAD);
  });

  it('height uses tallest child', () => {
    const tallGroup: ParallelNode = {
      type: 'parallel', id: 'p',
      children: [leaf('x'), leaf('y'), leaf('z')],
    };
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a'), tallGroup] };
    const tallLayout = computeLayout(tallGroup);
    const seqLayout = computeLayout(node);
    expect(seqLayout.height).toBe(L_HEADER_H + L_PAD + tallLayout.height + L_PAD);
  });

  it('empty sequence returns placeholder dimensions', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_LEAF_W + L_PAD * 2);
    expect(layout.height).toBe(L_LEAF_H + L_HEADER_H + L_PAD * 2);
  });

  it('x/y offsets propagate to children', () => {
    const node: SequenceNode = { type: 'sequence', id: 's', children: [leaf('a')] };
    const layout = computeLayout(node, 100, 50);
    expect(layout.x).toBe(100);
    expect(layout.y).toBe(50);
    expect(layout.children[0].x).toBe(100 + L_PAD);
    expect(layout.children[0].y).toBe(50 + L_HEADER_H + L_PAD);
  });
});

// ─── Parallel ─────────────────────────────────────────────────────────────────

describe('parallel layout', () => {
  it('two children: height = HEADER_H + PAD + H + GAP + H + PAD', () => {
    const node: ParallelNode = { type: 'parallel', id: 'p', children: [leaf('a'), leaf('b')] };
    const layout = computeLayout(node);
    expect(layout.height).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_GAP + L_LEAF_H + L_PAD);
  });

  it('width = PAD + LEAF_W + PAD (all equal-width leaves)', () => {
    const node: ParallelNode = { type: 'parallel', id: 'p', children: [leaf('a'), leaf('b')] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + L_LEAF_W + L_PAD);
  });

  it('children stacked vertically', () => {
    const node: ParallelNode = { type: 'parallel', id: 'p', children: [leaf('a'), leaf('b')] };
    const layout = computeLayout(node);
    expect(layout.children[0].y).toBe(L_HEADER_H + L_PAD);
    expect(layout.children[1].y).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_GAP);
  });

  it('all children share the same x (= parent.x + PAD)', () => {
    const node: ParallelNode = { type: 'parallel', id: 'p', children: [leaf('a'), leaf('b'), leaf('c')] };
    const layout = computeLayout(node, 0, 0);
    expect(layout.children[0].x).toBe(L_PAD);
    expect(layout.children[1].x).toBe(L_PAD);
    expect(layout.children[2].x).toBe(L_PAD);
  });

  it('width uses widest child', () => {
    const wideSeq: SequenceNode = {
      type: 'sequence', id: 'ws',
      children: [leaf('a'), leaf('b'), leaf('c')],
    };
    const wideSeqLayout = computeLayout(wideSeq);
    const node: ParallelNode = {
      type: 'parallel', id: 'p',
      children: [wideSeq, leaf('narrow')],
    };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + wideSeqLayout.width + L_PAD);
  });

  it('empty parallel returns placeholder dimensions', () => {
    const node: ParallelNode = { type: 'parallel', id: 'p', children: [] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_LEAF_W + L_PAD * 2);
    expect(layout.height).toBe(L_LEAF_H + L_HEADER_H + L_PAD * 2);
  });
});

// ─── Race ─────────────────────────────────────────────────────────────────────

describe('race layout', () => {
  it('has identical dimensions to an equivalent parallel', () => {
    const raceNode: RaceNode = { type: 'race', id: 'r', children: [leaf('a'), leaf('b')] };
    const parNode: ParallelNode = { type: 'parallel', id: 'p', children: [leaf('a'), leaf('b')] };
    const raceLayout = computeLayout(raceNode);
    const parLayout = computeLayout(parNode);
    expect(raceLayout.width).toBe(parLayout.width);
    expect(raceLayout.height).toBe(parLayout.height);
  });

  it('empty race returns placeholder dimensions', () => {
    const node: RaceNode = { type: 'race', id: 'r', children: [] };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_LEAF_W + L_PAD * 2);
  });
});

// ─── Deadline ─────────────────────────────────────────────────────────────────

describe('deadline layout', () => {
  it('deadline + one other: stacks two children vertically', () => {
    const node: DeadlineNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b')],
    };
    const layout = computeLayout(node);
    expect(layout.children).toHaveLength(2);
    expect(layout.height).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_GAP + L_LEAF_H + L_PAD);
  });

  it('deadlineChildIndex is always 0', () => {
    const node: DeadlineNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b'), leaf('c')],
    };
    const layout = computeLayout(node);
    expect(layout.deadlineChildIndex).toBe(0);
  });

  it('deadline with no others: single child', () => {
    const node: DeadlineNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [],
    };
    const layout = computeLayout(node);
    expect(layout.children).toHaveLength(1);
  });

  it('deadline with three others: four total children', () => {
    const node: DeadlineNode = {
      type: 'deadline', id: 'd',
      deadline: leaf('a'),
      others: [leaf('b'), leaf('c'), leaf('d')],
    };
    const layout = computeLayout(node);
    expect(layout.children).toHaveLength(4);
  });
});

// ─── Decorated ────────────────────────────────────────────────────────────────

describe('decorated layout', () => {
  it('wraps a leaf: width = LEAF_W + PAD*2, height = LEAF_H + HEADER_H + PAD*2', () => {
    const node: DecoratedNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: leaf('a'),
    };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_LEAF_W + L_PAD * 2);
    expect(layout.height).toBe(L_LEAF_H + L_HEADER_H + L_PAD * 2);
  });

  it('child is offset by PAD / HEADER_H + PAD', () => {
    const node: DecoratedNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: leaf('a'),
    };
    const layout = computeLayout(node);
    expect(layout.children).toHaveLength(1);
    expect(layout.children[0].x).toBe(L_PAD);
    expect(layout.children[0].y).toBe(L_HEADER_H + L_PAD);
  });

  it('decorated wrapping a sequence scales with the sequence size', () => {
    const innerSeq: SequenceNode = {
      type: 'sequence', id: 's',
      children: [leaf('a'), leaf('b'), leaf('c')],
    };
    const node: DecoratedNode = {
      type: 'decorated', id: 'dec',
      decorator: 'repeatedly',
      child: innerSeq,
    };
    const innerLayout = computeLayout(innerSeq);
    const outerLayout = computeLayout(node);
    expect(outerLayout.width).toBe(innerLayout.width + L_PAD * 2);
    expect(outerLayout.height).toBe(innerLayout.height + L_HEADER_H + L_PAD * 2);
  });

  it('nested decorated nodes add dimensions cumulatively', () => {
    const inner: DecoratedNode = {
      type: 'decorated', id: 'inner',
      decorator: 'timeout',
      child: leaf('a'),
    };
    const outer: DecoratedNode = {
      type: 'decorated', id: 'outer',
      decorator: 'repeatedly',
      child: inner,
    };
    const innerLayout = computeLayout(inner);
    const outerLayout = computeLayout(outer);
    expect(outerLayout.width).toBe(innerLayout.width + L_PAD * 2);
    expect(outerLayout.height).toBe(innerLayout.height + L_HEADER_H + L_PAD * 2);
  });
});

// ─── Conditional ──────────────────────────────────────────────────────────────

describe('conditional layout', () => {
  it('has two children (true and false branches)', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.children).toHaveLength(2);
  });

  it('true branch is placed first (lower y)', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.children[0].y).toBeLessThan(layout.children[1].y);
  });

  it('true branch y = HEADER_H + PAD', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.children[0].y).toBe(L_HEADER_H + L_PAD);
  });

  it('false branch y = HEADER_H + PAD + trueBranchHeight + GAP', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.children[1].y).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_GAP);
  });

  it('total height = HEADER_H + PAD + trueH + GAP + falseH + PAD', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.height).toBe(L_HEADER_H + L_PAD + L_LEAF_H + L_GAP + L_LEAF_H + L_PAD);
  });

  it('width = PAD + max(trueW, falseW) + PAD', () => {
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: leaf('t'),
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + L_LEAF_W + L_PAD);
  });

  it('width uses wider branch', () => {
    const wideSeq: SequenceNode = {
      type: 'sequence', id: 'ws',
      children: [leaf('a'), leaf('b'), leaf('c')],
    };
    const wideSeqLayout = computeLayout(wideSeq);
    const node: ConditionalNode = {
      type: 'conditional', id: 'c',
      trueBranch: wideSeq,
      falseBranch: leaf('f'),
    };
    const layout = computeLayout(node);
    expect(layout.width).toBe(L_PAD + wideSeqLayout.width + L_PAD);
  });
});

// ─── Deep nesting ──────────────────────────────────────────────────────────────

describe('deep nesting', () => {
  it('sequence → parallel → leaf positions are all consistent', () => {
    // Ensure that offsets compose correctly and no child overlaps its parent header
    const inner: ParallelNode = {
      type: 'parallel', id: 'p',
      children: [leaf('a'), leaf('b')],
    };
    const outer: SequenceNode = {
      type: 'sequence', id: 's',
      children: [inner, leaf('c')],
    };
    const layout = computeLayout(outer, 0, 0);
    // Children of sequence start at y = HEADER_H + PAD
    const innerLayout = layout.children[0];
    expect(innerLayout.y).toBe(L_HEADER_H + L_PAD);
    // Children of inner parallel start at y = innerLayout.y + HEADER_H + PAD
    expect(innerLayout.children[0].y).toBe(innerLayout.y + L_HEADER_H + L_PAD);
  });

  it('decorated → sequence → leaves: dimensions add up correctly', () => {
    const innerSeq: SequenceNode = {
      type: 'sequence', id: 's',
      children: [leaf('a'), leaf('b')],
    };
    const dec: DecoratedNode = {
      type: 'decorated', id: 'dec',
      decorator: 'timeout',
      child: innerSeq,
    };
    const seqLayout = computeLayout(innerSeq);
    const decLayout = computeLayout(dec);
    expect(decLayout.width).toBe(seqLayout.width + L_PAD * 2);
    expect(decLayout.height).toBe(seqLayout.height + L_HEADER_H + L_PAD * 2);
  });
});
