import { useState, useCallback, useRef } from 'react';
import type { CommandFunction, ModifiedNode } from '../types/command';
import type { LayoutNode } from '../utils/layout';
import { computeLayout, L_HEADER_H } from '../utils/layout';

// ─── Group type styles ────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, {
  headerBg: string;
  border: string;
  labelFg: string;
  label: string;
}> = {
  sequence:    { headerBg: '#1e40af', border: '#3b82f6', labelFg: '#dbeafe', label: 'SEQUENCE'    },
  parallel:    { headerBg: '#15803d', border: '#22c55e', labelFg: '#dcfce7', label: 'PARALLEL'    },
  race:        { headerBg: '#c2410c', border: '#f97316', labelFg: '#ffedd5', label: 'RACE'        },
  deadline:    { headerBg: '#7e22ce', border: '#a855f7', labelFg: '#f3e8ff', label: 'DEADLINE'    },
  modified:    { headerBg: '#334155', border: '#64748b', labelFg: '#e2e8f0', label: 'MODIFIED'    },
  conditional: { headerBg: '#92400e', border: '#f59e0b', labelFg: '#fef3c7', label: 'IF/ELSE'     },
};

const GROUP_BODY_FILL = '#0f172a';

// ─── Modifier header label ────────────────────────────────────────────────────

function modifierLabel(modifier: string, arg?: string): string {
  switch (modifier) {
    case 'timeout':         return arg ? `TIMEOUT ${arg}` : 'TIMEOUT';
    case 'until':           return 'UNTIL (…)';
    case 'repeatedly':      return 'REPEATEDLY';
    case 'unless':          return 'UNLESS (…)';
    case 'onlyIf':          return 'ONLY IF (…)';
    case 'ignoringDisable': return 'IGNORE DISABLE';
    default:                return modifier.toUpperCase();
  }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipState { x: number; y: number; content: string }

// ─── Render context ───────────────────────────────────────────────────────────

interface RenderCtx {
  zoom: number;
  onHover: (t: TooltipState | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

// ─── Node renderer ────────────────────────────────────────────────────────────

function RenderNode({
  layout,
  ctx,
  isDeadlineChild = false,
}: {
  layout: LayoutNode;
  ctx: RenderCtx;
  isDeadlineChild?: boolean;
}) {
  const { command, x, y, width, height, children, deadlineChildIndex } = layout;
  const { zoom, onHover } = ctx;

  const gx = x * zoom;
  const gy = y * zoom;
  const gw = width  * zoom;
  const gh = height * zoom;
  const hh = L_HEADER_H * zoom;

  // ── Leaf / unknown ──────────────────────────────────────────────────────────
  if (command.type === 'leaf' || command.type === 'unknown') {
    const raw       = command.raw ?? '';
    const name      = command.type === 'leaf' ? command.name : '?';
    const subsystem = command.type === 'leaf' ? command.subsystem : undefined;

    const padH  = 8;
    const textX = gx + padH;
    const textW = gw - padH * 2;
    const maxChars  = Math.max(3, Math.floor(textW / 7));

    const showSub   = !!subsystem && gh > 34;
    const nameY     = showSub ? gy + gh * 0.63 : gy + gh * 0.5;
    const subY      = gy + gh * 0.2;

    return (
      <g
        style={{ cursor: 'default' }}
        onMouseEnter={e => {
          onHover({ x: e.clientX + 14, y: e.clientY + 14, content: raw });
        }}
        onMouseLeave={() => onHover(null)}
      >
        <rect
          x={gx} y={gy} width={gw} height={gh}
          rx={5}
          fill="#1e293b"
          stroke="#475569"
          strokeWidth={1.5}
        />

        {showSub && (
          <text
            x={textX + textW / 2} y={subY}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
            style={{ pointerEvents: 'none' }}
          >
            {truncate(subsystem!, maxChars)}
          </text>
        )}
        <text
          x={textX + textW / 2} y={nameY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(13, Math.max(9, gh / 4.5))}
          fontWeight="600"
          fill="#e2e8f0"
          style={{ pointerEvents: 'none' }}
        >
          {truncate(name, maxChars)}
        </text>
        {isDeadlineChild && (
          <text
            x={gx + gw - 14} y={gy + gh / 2}
            dominantBaseline="central"
            fontSize={12}
            fill="#fbbf24"
            style={{ pointerEvents: 'none' }}
          >⏱</text>
        )}
      </g>
    );
  }

  // ── Group nodes ─────────────────────────────────────────────────────────────
  const style     = TYPE_STYLE[command.type] ?? TYPE_STYLE.sequence;
  const isModified = command.type === 'modified';
  const headerLabel = isModified
    ? modifierLabel((command as ModifiedNode).modifier, (command as ModifiedNode).modifierArg)
    : style.label;
  const clipId = `clip-${command.id}`;

  return (
    <g className={`node-${command.type}`}>
      {/* clipPath so the header strip respects the group's rounded top corners */}
      <defs>
        <clipPath id={clipId}>
          <rect x={gx} y={gy} width={gw} height={gh} rx={6} />
        </clipPath>
      </defs>

      {/* Body: clipped dark fill + solid colored header strip */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={gx} y={gy} width={gw} height={gh} fill={GROUP_BODY_FILL} />
        <rect x={gx} y={gy} width={gw} height={hh} fill={style.headerBg} />
      </g>

      {/* Border — dashed for modified, solid for everything else */}
      <rect
        x={gx} y={gy} width={gw} height={gh}
        rx={6}
        fill="none"
        stroke={style.border}
        strokeWidth={isModified ? 1.5 : 2}
        strokeDasharray={isModified ? '6 3' : undefined}
      />

      {/* Header type label */}
      <text
        x={gx + gw / 2} y={gy + hh / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="700"
        fontFamily="monospace"
        fill={style.labelFg}
        style={{ pointerEvents: 'none' }}
      >
        {headerLabel}
      </text>

      {/* Deadline child indicator in header */}
      {isDeadlineChild && (
        <text
          x={gx + gw - 8} y={gy + hh / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={12}
          fill="#fbbf24"
          style={{ pointerEvents: 'none' }}
        >⏱</text>
      )}

      {/* TRUE / FALSE labels for conditional branches */}
      {command.type === 'conditional' && children.map((child, i) => (
        <text
          key={`cond-${i}`}
          x={child.x * zoom + 5}
          y={child.y * zoom + 10}
          fontSize={8}
          fontWeight="700"
          fill={style.labelFg}
          opacity={0.75}
          style={{ pointerEvents: 'none' }}
        >
          {i === 0 ? 'TRUE' : 'FALSE'}
        </text>
      ))}

      {/* Deadline divider between deadline child and the others */}
      {command.type === 'deadline' && children.length > 1 && (() => {
        const c0 = children[0];
        const divY = (c0.y + c0.height) * zoom + 3;
        return (
          <line
            x1={gx + 4} y1={divY} x2={gx + gw - 4} y2={divY}
            stroke={style.border}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.5}
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
    { label: 'Sequence', style: TYPE_STYLE.sequence    },
    { label: 'Parallel', style: TYPE_STYLE.parallel    },
    { label: 'Race',     style: TYPE_STYLE.race        },
    { label: 'Deadline', style: TYPE_STYLE.deadline    },
    { label: 'If/Else',  style: TYPE_STYLE.conditional },
    { label: 'Modified', style: TYPE_STYLE.modified, dash: true },
  ];
  return (
    <div className="legend">
      {items.map(({ label, style, dash }) => (
        <div key={label} className="legend-item">
          <svg width="18" height="14" style={{ flexShrink: 0 }}>
            <rect x={1} y={1} width={16} height={12} rx={2} fill={style.headerBg} stroke={style.border} strokeWidth={1.5} strokeDasharray={dash ? '3 2' : undefined} />
          </svg>
          <span>{label}</span>
        </div>
      ))}
      <div className="legend-divider" />
      <div className="legend-item">
        <span style={{ fontSize: 14, lineHeight: 1 }}>⏱</span>
        <span>Deadline child</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { command: CommandFunction | null }

export function TimelineView({ command }: Props) {
  const [zoom, setZoom]     = useState(1.0);
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

  const layout = computeLayout(command.node);
  const PAD    = 16;
  const svgW   = layout.width  * zoom + PAD * 2;
  const svgH   = layout.height * zoom + PAD * 2;
  const ctx: RenderCtx = { zoom, onHover: handleHover };

  return (
    <div className="timeline-view">
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

      <div className="timeline-scroll">
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          style={{ display: 'block', minWidth: svgW }}
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${PAD}, ${PAD})`}>
            <RenderNode layout={layout} ctx={ctx} />
          </g>
        </svg>
      </div>

      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <code>{tooltip.content.length > 300 ? tooltip.content.slice(0, 300) + '…' : tooltip.content}</code>
        </div>
      )}
    </div>
  );
}
