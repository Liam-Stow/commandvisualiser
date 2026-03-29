# FRC Command Visualiser — Claude Guide

## Commands
```bash
npm run dev        # start dev server (localhost:5173)
npm test           # run tests once (vitest)
npm run test:watch # run tests in watch mode
npm run build      # type-check + production build
```

> **Windows note:** `npm run dev` works fine from the terminal, but the
> `preview_start` tool must launch Vite directly:
> `node ./node_modules/vite/bin/vite.js`
> (npm/.bin shims don't work with the preview tool on Windows)

## Architecture

```
C++ source file
      │
      ├─────────────────────────────────────────────────┐
      ▼                                                 ▼
src/parser/cppParser.ts                  src/parser/driveToPoseParser.ts
ParsedFile[] (AST of CommandPtr fns)     DriveWaypoint[] (driveToPose calls)
      │                                                 │
      ▼                                                 ▼
src/utils/layout.ts                      src/components/FieldView.tsx
LayoutNode tree (x/y/width/height)       waypoints overlaid on field image
      │                                                 │
      ▼                                                 ▼
src/components/TimelineView.tsx          src/config/fields.ts
SVG timeline diagram                     field image metadata (px/m, margins)
```

Both views are shown side-by-side in `src/components/Viewer.tsx`.
Hovering a `driveToPose` leaf in the timeline highlights the corresponding
waypoint in the field view (and vice versa) via a shared `driveNodeMap`.

## AST node types

| Type | Meaning |
|------|---------|
| `sequence` | Commands run one after another |
| `parallel` | All commands run; ends when all finish |
| `race` | All commands run; ends when first finishes |
| `deadline` | Like race but one command is the designated "deadline" |
| `decorated` | Wrapper (timeout, repeatedly, until, onlyIf, …) |
| `conditional` | Either/ConditionalCommand — true/false branches |
| `leaf` | A concrete subsystem command, or WPILib command factory |
| `unknown` | Unparseable expression, stored as raw string |

## Colour scheme (TimelineView)

| Node | Border | Header bg |
|------|--------|-----------|
| sequence | `#3b82f6` | `#1e40af` |
| parallel | `#22c55e` | `#15803d` |
| race | `#f97316` | `#c2410c` |
| deadline | `#552b7c` | `#441270` |
| decorated | `#64748b` | `#334155` |
| conditional | `#f59e0b` | `#92400e` |

Group body fill: `#0f172a`.

## Layout constants (layout.ts)

All values are px at zoom=1:
- `L_LEAF_W = 150`, `L_LEAF_H = 46`
- `L_HEADER_H = 22` (group header strip)
- `L_PAD = 7` (border → children gap)
- `L_GAP = 5` (gap between siblings)

## Parser scope

The parser handles FRC C++ `frc2::CommandPtr`-returning functions. Supported patterns:
- All `frc2::cmd::` factories (`Sequence`, `Parallel`, `Race`, `Deadline`, etc.)
- Method-chain decorators: `AndThen`, `AlongWith`, `RaceWith`, `DeadlineFor`,
  `DeadlineWith`, `WithDeadline`, `WithTimeout`, `Until`, `Repeatedly`,
  `Unless`, `OnlyIf`, `IgnoringDisable`
- `Either` / `ConditionalCommand` conditionals
- Subsystem leaf nodes (any other `frc2::CommandPtr` call)

The parser does **not** execute or simulate C++ — it pattern-matches method chains
and factory calls. Lambdas and complex expressions become `unknown` nodes.

## Design constraints
- Must work as a **static web app** with no backend — students open `index.html` directly.
- No runtime dependencies beyond React; keep the bundle small.
- Dark theme throughout; do not introduce light-mode styles.
