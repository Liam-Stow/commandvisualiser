# FRC Command Visualiser — Codebase Guide

A React + TypeScript app that parses FRC C++ robot code and visualises
command compositions as timeline diagrams and field path overlays.

---

## Quick orientation

```
src/
  App.tsx                    — root component; file loading, poll loop, layout
  types/command.ts           — AST node type definitions
  parser/
    cppParser.ts             — C++ → AST  (the core logic)
    driveToPoseParser.ts     — AST → drive waypoints
  utils/layout.ts            — AST → pixel layout grid
  config/fields.ts           — field image config + coordinate helpers
  components/
    FileSidebar.tsx           — left column: folder picker + file list
    CommandPanel.tsx          — middle column: list of CommandPtr functions
    TimelineView.tsx          — SVG timeline renderer
    FieldView.tsx             — field image + path overlay + range slider
    Viewer.tsx                — Timeline / Field tab switcher
public/
  Logo.White.png             — ICRobotics logo (white, for dark backgrounds)
  Logo.Grey.png              — ICRobotics logo (grey, for light backgrounds)
  fields/field26.png         — 2026 Reefscape field image
```

---

## Data flow

```
User opens folder
      │
      ▼
App.tsx  walkCppFiles()
  reads every .cpp file in the tree
      │
      ▼
cppParser.ts  parseFile()
  strips comments → finds frc2::CommandPtr functions →
  parses each return expression into an AST
      │
      ▼
ParsedFile[]  stored in App state
      │
      ├──► TimelineView   calls layout.ts  computeLayout()
      │      AST → LayoutNode grid → SVG rectangles
      │
      └──► FieldView      calls driveToPoseParser.ts  extractWaypoints()
             AST → DriveWaypoint[] → dots + lines on field image
```

---

## The parser (`src/parser/cppParser.ts`)

This is the most complex file. It parses C++ source without a full grammar,
relying on bracket-depth tracking and known WPILib patterns.

### Pipeline

1. **`removeComments`** — strips `//` and `/* */` comments, skips string
   literals to avoid false positives.

2. **`findCommandFunctions`** — regex-scans for `frc2::CommandPtr FuncName(`
   definitions, extracts each function body by tracking brace depth.

3. **`extractReturnExpr`** — finds the last top-level `return` statement in a
   function body. "Top-level" means not inside a nested `{}` block (e.g. a
   lambda).

4. **`parseExpr`** — entry point for expression parsing:
   - calls `splitMethodChain` to separate the base expression from any chained
     decorator calls (`.AndThen(...)`, `.AlongWith(...)`, etc.)
   - calls `parseBaseExpr` on the base
   - calls `applyDecorator` for each decorator in order

5. **`parseBaseExpr`** — pattern-matches the base expression against known
   command factories and returns an AST node. Falls back to `makeLeaf` for
   anything unrecognised (subsystem commands, unknown calls, etc.).

6. **`matchesFn(e, 'Sequence')`** — helper used throughout `parseBaseExpr`.
   Returns true if the expression starts with any of:
   - `frc2::cmd::Sequence(`
   - `cmd::Sequence(`
   - `Sequence(`  ← covers `using namespace frc2::cmd;`

### AST node types (`src/types/command.ts`)

| Type | Meaning | Key fields |
|------|---------|------------|
| `sequence` | runs children one after another | `children[]` |
| `parallel` | runs all children simultaneously, ends when all finish | `children[]` |
| `race` | runs all children, ends when the first finishes | `children[]` |
| `deadline` | like race but one specific child is the "deadline" | `deadline`, `others[]` |
| `modified` | wraps a child with a modifier (timeout, repeatedly, etc.) | `modifier`, `child` |
| `conditional` | either/else branch | `trueBranch`, `falseBranch` |
| `leaf` | a single command (subsystem call or factory with no children) | `name`, `subsystem?` |
| `unknown` | parse failed | `raw` |

### Decorator → node mapping

| C++ method | Result |
|---|---|
| `.AndThen(B)` | Wraps current + B in a `sequence` (flattens if already a sequence) |
| `.AlongWith(B)` | Wraps current + B in a `parallel` (flattens if already parallel) |
| `.RaceWith(B)` | Wraps current + B in a `race` |
| `.DeadlineFor(B)` / `.DeadlineWith(B)` | Current node becomes deadline, B runs alongside |
| `.WithDeadline(D)` | D becomes deadline, current node runs alongside |
| `.WithTimeout(t)` | `modified` with `modifier: 'timeout'` |
| `.Until(cond)` | `modified` with `modifier: 'until'` |
| `.Repeatedly()` | `modified` with `modifier: 'repeatedly'` |

---

## The layout engine (`src/utils/layout.ts`)

Converts an AST into a grid of rectangles in **abstract units** (not pixels).
Each unit represents one "time slot" wide, one "track" tall.

| Node type | Width | Height |
|---|---|---|
| `leaf` / `unknown` | 1 | 1 |
| `sequence` | sum of children's widths | max of children's heights |
| `parallel` / `race` / `deadline` | max of children's widths | sum of children's heights |
| `modified` | same as inner child | same as inner child |
| `conditional` | max of branch widths | sum of branch heights |

`TimelineView` then multiplies these abstract units by a pixel scale factor
(which changes with zoom) to render SVG rectangles.

---

## The field view (`src/components/FieldView.tsx`)

### Coordinate systems

There are three coordinate spaces in play:

1. **Field metres** — FRC standard: origin at bottom-left of the playing area,
   +X right, +Y up.
2. **Image pixels** — origin at top-left of `field26.png`, +Y down.
3. **Screen pixels** — same as image pixels but scaled/panned by the
   zoom transform.

`fieldToImagePx` in `src/config/fields.ts` converts (1) → (2):
```
imgX = marginPx + fx * pixelsPerMeter
imgY = imageHeightPx - marginPx - fy * pixelsPerMeter   ← Y is flipped
```

Zoom/pan is a CSS `transform: translate(panX, panY) scale(s)` on the inner
div. SVG elements are drawn in image-pixel coordinates so they stay correctly
overlaid on the field image. For elements that should appear a constant size
on screen (waypoint circles, rotation arrows), their sizes are divided by
`scale` so that the CSS zoom cancels out.

### Alliance flip

When "Red alliance" mode is on, each waypoint's X coordinate is mirrored
across the field centre line using `flipXForRed`, and its rotation is flipped
with `flipRotForRed`. This is done at render time — the underlying waypoint
data is unchanged.

### Range slider

The two-thumb slider controls which waypoints are shown. It uses two
overlapping `<input type="range">` elements. The filled track between the
thumbs supports drag-to-shift (both thumbs move together). Z-index management
ensures the correct thumb is interactive when they overlap:
- When both thumbs are at position 0, the **end** thumb is on top so it can
  be dragged right.
- When both thumbs are at the maximum, the **start** thumb is on top so it
  can be dragged left.

---

## File watching (`src/App.tsx`)

When a folder is opened via the **File System Access API** (`showDirectoryPicker`),
the app stores the `FileSystemDirectoryHandle` and starts a polling loop
(`setInterval`, 1500 ms). Each tick:
1. Walks all `.cpp` files in the directory tree.
2. Compares each file's `lastModified` timestamp against the stored value.
3. Re-parses any file that has changed and merges the result into state.

The current command selection is preserved by key (file path + command full
name) rather than object reference, so the view updates automatically when
the underlying file changes.

> **Note:** The File System Access API requires a browser permission grant and
> only works over HTTPS or localhost. The fallback `<input webkitdirectory>`
> button loads files once without watching (no `FileSystemDirectoryHandle`).

---

## Field image configuration (`src/config/fields.ts`)

To add a new field image:

1. Put the PNG in `public/fields/`.
2. Add a new constant:
```typescript
export const FIELD_2027: FieldConfig = {
  name: '2027 Field Name',
  imagePath: `${import.meta.env.BASE_URL}fields/field27.png`,
  imageWidthPx: 3508,   // actual pixel width of the image
  imageHeightPx: 1814,  // actual pixel height
  pixelsPerMeter: 200,  // how many pixels = 1 metre in this image
  marginMeters: 0.5,    // gap between the image edge and the field boundary
};
```
3. Change `ACTIVE_FIELD` to point to the new constant.

`pixelsPerMeter` and `marginMeters` need to match the specific image. The
existing field image is 3508×1814 px, 200 px/m, with a 0.5 m margin on each
side (giving a playing area of ~16.54 m × 8.07 m for 2026 Reefscape).

---

## Adding new command patterns to the parser

To support a new WPILib command factory (e.g. a hypothetical `frc2::cmd::Loop`):

1. Open `src/parser/cppParser.ts`.
2. Add a case in `parseBaseExpr`, before the final `return makeLeaf(e)`:
```typescript
if (matchesFn(e, 'Loop')) {
  const args = splitTopLevel(getCallArgs(e));
  // build and return the appropriate AST node
}
```
3. If it's a new composite type, add a node type to `src/types/command.ts`,
   handle it in `src/utils/layout.ts` (computeLayout), and render it in
   `src/components/TimelineView.tsx`.

`matchesFn(e, 'Loop')` matches `frc2::cmd::Loop(`, `cmd::Loop(`, and `Loop(`
so the fix works with or without a `using namespace` directive.

---

## Colour scheme

### Timeline node colours

| Node type | Colour |
|---|---|
| Sequence | Blue `#3b82f6` |
| Parallel | Green `#22c55e` |
| Race | Orange `#f97316` |
| Deadline | Purple `#a855f7` |
| Conditional (if/else) | Amber `#f59e0b` |
| Leaf — SubDrivebase | Blue `#3b82f6` |
| Leaf — SubShooter | Red `#ef4444` |
| Leaf — SubIntake / Deploy / Feeder | Green shades |
| Leaf — unknown subsystem | Slate `#64748b` |

Subsystem-to-colour mappings are in `TimelineView.tsx` in the
`subsystemColor` function.

### UI theme

CSS custom properties are defined in `:root` in `src/App.css`:

| Variable | Value | Usage |
|---|---|---|
| `--bg` | `#1a1a1a` | main background |
| `--sidebar-bg` | `#252525` | sidebar / panel background |
| `--panel-bg` | `#202020` | command panel |
| `--viewer-bg` | `#1e1e1e` | timeline / field viewer |
| `--accent` | `#c44a1a` | buttons, highlights, selected items |
| `--accent-hover` | `#f35924` | hover state (full ICRobotics orange) |
| `--border` | `#3c3c3c` | ICRobotics charcoal grey |

---

## Deployment

The app is a static site deployed to GitHub Pages at
`liam-stow.github.io/commandvisualiser` via a GitHub Actions workflow
(`.github/workflows/deploy.yml`). Any push to `main` triggers a build and
redeploy.

The Vite base path is set to `/commandvisualiser/` in `vite.config.ts`. All
`public/` asset references use `import.meta.env.BASE_URL` as a prefix (e.g.
`` `${import.meta.env.BASE_URL}Logo.White.png` ``) so that paths resolve
correctly both locally (base = `/`) and on GitHub Pages (base =
`/commandvisualiser/`).

> **Gotcha:** If you add a new image to `public/` and reference it as a
> string in JS/JSX, always prefix with `import.meta.env.BASE_URL`. Vite only
> rewrites paths that go through its module graph (JS imports, CSS `url()`).
> Plain strings in attributes are opaque data to Vite.

To run locally:
```
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build into dist/
```
