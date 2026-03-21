import { useState, useCallback, useRef } from 'react';
import type { CommandFunction } from '../types/command';
import type { LayoutNode } from '../utils/layout';
import { computeLayout } from '../utils/layout';

// ─── Visual constants ─────────────────────────────────────────────────────────

const BASE_UNIT_W  = 160; // px per time unit at zoom=1
const BASE_TRACK_H = 54;  // px per track at zoom=1
const LEAF_INSET   = 3;   // inset from track boundary for leaf rects
const GROUP_LABEL_H = 16; // height reserved for the group type label

// ─── Colours ──────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { bg: string; border: string; labelBg: string; labelFg: string; label: string }> = {
  sequence: {
    bg: 'rgba(30,64,175,0.18)', border: '#3b82f6',
    labelBg: '#1e3a8a', labelFg: '#bfdbfe', label: 'SEQUENCE',
  },
  parallel: {
    bg: 'rgba(20,83,45,0.18)', border: '#22c55e',
    labelBg: '#14532d', labelFg: '#bbf7d0', label: 'PARALLEL',
  },
  race: {
    bg: 'rgba(124,45,18,0.22)', border: '#f97316',
    labelBg: '#7c2d12', labelFg: '#fed7aa', label: 'RACE',
  },
  deadline: {
    bg: 'rgba(88,28,135,0.22)', border: '#a855f7',
    labelBg: '#581c87', labelFg: '#e9d5ff', label: 'DEADLINE',
  },
  modified: {
    bg: 'rgba(30,41,59,0.25)', border: '#64748b',
    labelBg: '#1e293b', labelFg: '#cbd5e1', label: 'MODIFIED',
  },
  conditional: {
    bg: 'rgba(120,53,15,0.22)', border: '#f59e0b',
    labelBg: '#78350f', labelFg: '#fde68a', label: 'IF/ELSE',
  },
};

// Colour by subsystem name
const SUBSYSTEM_COLOR: Record<string, { bg: string; border: string; fg: string }> = {
  SubDrivebase: { bg: '#1e3a8a', border: '#60a5fa', fg: '#dbeafe' },
  SubIntake:    { bg: '#14532d', border: '#4ade80', fg: '#dcfce7' },
  SubDeploy:    { bg: '#14532d', border: '#34d399', fg: '#d1fae5' },
  SubFeeder:    { bg: '#365314', border: '#a3e635', fg: '#ecfccb' },
  SubIndexer:   { bg: '#1a2e05', border: '#84cc16', fg: '#f0fdf4' },
  SubShooter:   { bg: '#7f1d1d', border: '#f87171', fg: '#fee2e2' },
  SubHood:      { bg: '#7c2d12', border: '#fb923c', fg: '#ffedd5' },
  SubTurret:    { bg: '#713f12', border: '#fbbf24', fg: '#fef3c7' },
  SubVision:    { bg: '#0c4a6e', border: '#38bdf8', fg: '#e0f2fe' },
};

const LEAF_DEFAULT = { bg: '#3730a3', border: '#818cf8', fg: '#e0e7ff' };
const LEAF_WAIT    = { bg: '#1f2937', border: '#6b7280', fg: '#f3f4f6' };
const LEAF_FRC2    = { bg: '#1f2937', border: '#94a3b8', fg: '#f1f5f9' };

function leafStyle(name: string, subsystem?: string) {
  if (subsystem && SUBSYSTEM_COLOR[subsystem]) return SUBSYSTEM_COLOR[subsystem];
  if (name.startsWith('Wait') || name.startsWith('None')) return LEAF_WAIT;
  if (name.startsWith('RunOnce') || name.startsWith('StartEnd') || name.startsWith('WaitUntil') || name.startsWith('Print') || name.startsWith('Select') || name.startsWith('ScheduleCommand')) return LEAF_FRC2;
  return LEAF_DEFAULT;
}

// ─── Modifier badge labels ────────────────────────────────────────────────────

function modifierLabel(modifier: string, arg?: string): string {
  switch (modifier) {
    case 'timeout':        return arg ? `⏱ ${arg}` : '⏱ timeout';
    case 'until':          return '⏹ until(…)';
    case 'repeatedly':     return '🔁 repeat';
    case 'unless':         return '⚑ unless(…)';
    case 'onlyIf':         return '⚑ onlyIf(…)';
    case 'ignoringDisable':return '🔓 ignoringDisable';
    default:               return modifier;
  }
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  content: string;
}

// ─── SVG rendering ────────────────────────────────────────────────────────────

interface RenderCtx {
  unitW: number;
  trackH: number;
  onHover: (t: TooltipState | null) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

function RenderNode({ layout, ctx, isDeadlineChild }: {
  layout: LayoutNode;
  ctx: RenderCtx;
  isDeadlineChild?: boolean;
}) {
  const { command, x, y, width, height, children, deadlineChildIndex } = layout;
  const { unitW, trackH, onHover, svgRef } = ctx;

  const px = x * unitW;
  const py = y * trackH;
  const pw = width  * unitW;
  const ph = height * trackH;

  // ── Leaf node ────────────────────────────────────────────────────────────────
  if (command.type === 'leaf' || command.type === 'unknown') {
    const raw = command.type === 'leaf' ? command.raw : (command as { raw: string }).raw;
    const name = command.type === 'leaf' ? command.name : '?';
    const subsystem = command.type === 'leaf' ? command.subsystem : undefined;
    const style = leafStyle(name, subsystem);

    const lx = px + LEAF_INSET;
    const ly = py + LEAF_INSET;
    const lw = pw - LEAF_INSET * 2;
    const lh = ph - LEAF_INSET * 2;

    // How much room for the main label
    const maxLabelChars = Math.floor(lw / 7.5);
    const mainLabel = truncate(name, maxLabelChars);
    const subLabel  = subsystem ? truncate(subsystem, maxLabelChars) : null;

    return (
      <g
        className="node-leaf"
        onMouseEnter={e => {
          const svg = svgRef.current;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          onHover({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12, content: raw });
        }}
        onMouseLeave={() => onHover(null)}
      >
        <rect
          x={lx} y={ly} width={lw} height={lh}
          rx={5}
          fill={style.bg}
          stroke={style.border}
          strokeWidth={1.5}
        />
        {/* Subsystem label (small, top) */}
        {subLabel && lh > 30 && (
          <text
            x={lx + lw / 2} y={ly + 10}
            textAnchor="middle"
            fontSize={9}
            fill={style.fg}
            opacity={0.65}
          >
            {subLabel}
          </text>
        )}
        {/* Command name (centred) */}
        <text
          x={lx + lw / 2}
          y={subLabel && lh > 30 ? ly + lh / 2 + 4 : ly + lh / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(13, Math.max(9, lh / 3.5))}
          fontWeight="600"
          fill={style.fg}
        >
          {mainLabel}
        </text>
        {/* Deadline crown indicator */}
        {isDeadlineChild && (
          <text x={lx + lw - 10} y={ly + 12} fontSize={11} fill="#fbbf24">⏱</text>
        )}
      </g>
    );
  }

  // ── Modified node ─────────────────────────────────────────────────────────────
  if (command.type === 'modified') {
    const badgeLabel = modifierLabel(command.modifier, command.modifierArg);
    const style = TYPE_STYLE.modified;
    const inner = children[0];

    return (
      <g className="node-modified">
        <rect
          x={px} y={py} width={pw} height={ph}
          rx={6}
          fill={style.bg}
          stroke={style.border}
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        {/* Badge at top-right */}
        <rect
          x={px + pw - Math.min(pw, badgeLabel.length * 7 + 12)} y={py + 2}
          width={Math.min(pw, badgeLabel.length * 7 + 12)} height={GROUP_LABEL_H}
          rx={3}
          fill={style.labelBg}
        />
        <text
          x={px + pw - 5}
          y={py + GROUP_LABEL_H / 2 + 2}
          textAnchor="end"
          fontSize={10}
          fontWeight="700"
          fill={style.labelFg}
        >
          {badgeLabel}
        </text>
        {inner && <RenderNode layout={inner} ctx={ctx} isDeadlineChild={isDeadlineChild} />}
      </g>
    );
  }

  // ── Conditional node ──────────────────────────────────────────────────────────
  if (command.type === 'conditional') {
    const style = TYPE_STYLE.conditional;
    return (
      <g className="node-conditional">
        <rect x={px} y={py} width={pw} height={ph} rx={6} fill={style.bg} stroke={style.border} strokeWidth={1.5} />
        <rect x={px} y={py} width={80} height={GROUP_LABEL_H} rx={3} fill={style.labelBg} />
        <text x={px + 5} y={py + GROUP_LABEL_H / 2 + 2} fontSize={10} fontWeight="700" fill={style.labelFg}>
          {style.label}
        </text>
        {/* TRUE / FALSE labels */}
        {children[0] && (
          <>
            <text x={children[0].x * unitW + 4} y={children[0].y * trackH + 12} fontSize={9} fill="#fde68a" opacity={0.8}>TRUE</text>
            <RenderNode layout={children[0]} ctx={ctx} />
          </>
        )}
        {children[1] && (
          <>
            <text x={children[1].x * unitW + 4} y={children[1].y * trackH + 12} fontSize={9} fill="#fde68a" opacity={0.8}>FALSE</text>
            <RenderNode layout={children[1]} ctx={ctx} />
          </>
        )}
      </g>
    );
  }

  // ── Group nodes (sequence, parallel, race, deadline) ─────────────────────────
  const style = TYPE_STYLE[command.type] ?? TYPE_STYLE.sequence;
  const labelWidth = Math.min(pw - 4, style.label.length * 7.5 + 12);

  return (
    <g className={`node-${command.type}`}>
      {/* Background */}
      <rect
        x={px} y={py} width={pw} height={ph}
        rx={6}
        fill={style.bg}
        stroke={style.border}
        strokeWidth={1.5}
      />
      {/* Type label badge */}
      <rect
        x={px + 2} y={py + 2}
        width={labelWidth} height={GROUP_LABEL_H}
        rx={3}
        fill={style.labelBg}
        opacity={0.9}
      />
      <text
        x={px + 2 + labelWidth / 2} y={py + 2 + GROUP_LABEL_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight="700"
        fontFamily="monospace"
        fill={style.labelFg}
      >
        {style.label}
      </text>

      {/* Deadline divider line after first child */}
      {command.type === 'deadline' && children.length > 1 && (() => {
        const divY = (children[0].y + children[0].height) * trackH;
        return (
          <line
            x1={px} y1={divY}
            x2={px + pw} y2={divY}
            stroke={style.border}
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.7}
          />
        );
      })()}

      {/* Children */}
      {children.map((child, i) => (
        <RenderNode
          key={child.command.id}
          layout={child}
          ctx={ctx}
          isDeadlineChild={command.type === 'deadline' && deadlineChildIndex === i}
        />
      ))}
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: 'Sequence',  bg: '#1e3a8a', border: '#3b82f6', dash: false },
    { label: 'Parallel',  bg: '#14532d', border: '#22c55e', dash: false },
    { label: 'Race',      bg: '#7c2d12', border: '#f97316', dash: false },
    { label: 'Deadline',  bg: '#581c87', border: '#a855f7', dash: false },
    { label: 'If/Else',   bg: '#78350f', border: '#f59e0b', dash: false },
    { label: 'Modified',  bg: '#1e293b', border: '#64748b', dash: true  },
    { label: '⏱ Deadline child', bg: '#1e293b', border: '#fbbf24', dash: false },
  ];
  return (
    <div className="legend">
      {items.map(item => (
        <div key={item.label} className="legend-item">
          <svg width="18" height="14" style={{ flexShrink: 0 }}>
            <rect
              x={1} y={1} width={16} height={12} rx={2}
              fill={item.bg} stroke={item.border} strokeWidth={1.5}
              strokeDasharray={item.dash ? '3 2' : undefined}
            />
          </svg>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Track grid lines ─────────────────────────────────────────────────────────

function GridLines({ totalTracks, totalWidth, trackH }: { totalTracks: number; totalWidth: number; trackH: number }) {
  return (
    <>
      {Array.from({ length: totalTracks + 1 }, (_, i) => (
        <line
          key={i}
          x1={0} y1={i * trackH}
          x2={totalWidth} y2={i * trackH}
          stroke="rgba(148,163,184,0.08)"
          strokeWidth={1}
        />
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  command: CommandFunction | null;
}

export function TimelineView({ command }: Props) {
  const [zoom, setZoom] = useState(1.0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleHover = useCallback((t: TooltipState | null) => setTooltip(t), []);

  if (!command) {
    return (
      <div className="timeline-view empty-panel">
        <div className="empty-icon">📊</div>
        <p>Select a command to visualise its flow.</p>
      </div>
    );
  }

  const layout  = computeLayout(command.node);
  const unitW   = BASE_UNIT_W  * zoom;
  const trackH  = BASE_TRACK_H * zoom;
  const svgW    = layout.width  * unitW  + 24;
  const svgH    = layout.height * trackH + 24;

  const ctx: RenderCtx = { unitW, trackH, onHover: handleHover, svgRef };

  return (
    <div className="timeline-view">
      {/* Toolbar */}
      <div className="timeline-toolbar">
        <div className="timeline-title">
          <span className="timeline-cmd-name">{command.name}</span>
          {command.fullName !== command.name && (
            <span className="timeline-cmd-full">{command.fullName}</span>
          )}
        </div>
        <div className="toolbar-controls">
          <Legend />
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} title="Zoom out">−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(3, z + 0.15))} title="Zoom in">+</button>
            <button className="zoom-btn" onClick={() => setZoom(1)} title="Reset zoom">↺</button>
          </div>
        </div>
      </div>

      {/* Scrollable SVG */}
      <div className="timeline-scroll">
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          style={{ display: 'block', minWidth: svgW }}
          onMouseLeave={() => setTooltip(null)}
        >
          <GridLines totalTracks={layout.height} totalWidth={svgW} trackH={trackH} />
          <g transform="translate(8, 8)">
            <RenderNode layout={layout} ctx={ctx} />
          </g>
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <code>{tooltip.content.length > 300 ? tooltip.content.slice(0, 300) + '…' : tooltip.content}</code>
          </div>
        )}
      </div>
    </div>
  );
}
