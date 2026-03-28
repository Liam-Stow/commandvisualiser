export type CommandNodeType =
  | 'sequence'
  | 'parallel'
  | 'race'
  | 'deadline'
  | 'leaf'
  | 'decorated'
  | 'conditional'
  | 'unknown';

interface BaseNode {
  type: CommandNodeType;
  id: string;
}

export interface SequenceNode extends BaseNode {
  type: 'sequence';
  children: AnyCommandNode[];
}

export interface ParallelNode extends BaseNode {
  type: 'parallel';
  children: AnyCommandNode[];
}

export interface RaceNode extends BaseNode {
  type: 'race';
  children: AnyCommandNode[];
}

export interface DeadlineNode extends BaseNode {
  type: 'deadline';
  /** The command that determines when the group ends */
  deadline: AnyCommandNode;
  /** Commands that run alongside the deadline and are interrupted when it ends */
  others: AnyCommandNode[];
}

export interface LeafNode extends BaseNode {
  type: 'leaf';
  name: string;
  subsystem?: string;
  raw: string;
}

export interface DecoratedNode extends BaseNode {
  type: 'decorated';
  modifier: string;
  modifierArg?: string;
  child: AnyCommandNode;
}

export interface ConditionalNode extends BaseNode {
  type: 'conditional';
  trueBranch: AnyCommandNode;
  falseBranch: AnyCommandNode;
  condition?: string;
}

export interface UnknownNode extends BaseNode {
  type: 'unknown';
  raw: string;
}

export type AnyCommandNode =
  | SequenceNode
  | ParallelNode
  | RaceNode
  | DeadlineNode
  | LeafNode
  | DecoratedNode
  | ConditionalNode
  | UnknownNode;

export interface CommandFunction {
  name: string;
  fullName: string;
  node: AnyCommandNode;
  raw: string;
}

export interface ParsedFile {
  fileName: string;
  filePath: string;
  category: 'commands' | 'subsystems' | 'other';
  functions: CommandFunction[];
}
