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

## Naming
- Posititions on the field that include x/y translation and oritentiaion should always be referred to as a "Pose", "Pose2D" or similar. Not "Waypoint" or "Line".
- Poses have two kinds: literal (values defined inline with the command that uses them), or expression (some code interpretation needed to get the value, such as going to a variable definition or running dynamic calculations).
- Commands are always called commands. Not "Nodes" or "Actions". Sometimes using the word "Node" is appropriate for recording infomation that includes a command, but is not itself a command (ie, in the context of an Abstract Syntax Tree).

## Design constraints
- Must work as a **static web app** with no backend — students open `index.html` directly.
- No runtime dependencies beyond React; keep the bundle small.
- Dark theme throughout; do not introduce light-mode styles.

## Workflow
- Unless changes are very minimal in scope (a few lines) and low-risk, make all new changes on branches so they can be reviewed.
- No need for branch prefixes like "feature/" or "fix/", just describe the change. eg "empty-panel-rework", "pwa-support".