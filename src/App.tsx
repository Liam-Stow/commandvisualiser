import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ParsedFile, CommandFunction } from './types/command';
import { parseFile } from './parser/cppParser';
import { extractPose2dConstants, buildExpressionPoseMap } from './parser/expressionPoseResolver';
import type { ExpressionPoseMap, Pose2dConstant } from './parser/expressionPoseResolver';
import { FileSidebar } from './components/FileSidebar';
import { CommandPanel } from './components/CommandPanel';
import { Viewer } from './components/Viewer';

// ─── File system helpers ──────────────────────────────────────────────────────

const SOURCE_EXTS = ['.cpp', '.h', '.hpp'];

/** Recursively walk a directory, yielding handles for every C++ source/header file. */
async function* walkSourceFiles(
  dir: FileSystemDirectoryHandle,
  basePath = '',
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  for await (const [name, entry] of dir) {
    const fullPath = basePath ? `${basePath}/${name}` : name;
    if (entry.kind === 'file' && SOURCE_EXTS.some(ext => name.endsWith(ext))) {
      yield { handle: entry as FileSystemFileHandle, path: fullPath };
    } else if (entry.kind === 'directory') {
      yield* walkSourceFiles(entry as FileSystemDirectoryHandle, fullPath);
    }
  }
}

function isHeaderFile(name: string): boolean {
  return name.endsWith('.h') || name.endsWith('.hpp');
}

function sortFiles(files: ParsedFile[]): ParsedFile[] {
  const catOrder: Record<string, number> = { commands: 0, subsystems: 1, other: 2 };
  return [...files].sort((a, b) => {
    const diff = (catOrder[a.category] ?? 2) - (catOrder[b.category] ?? 2);
    return diff !== 0 ? diff : a.fileName.localeCompare(b.fileName);
  });
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [expressionPoseMap, setExpressionPoseMap] = useState<ExpressionPoseMap>(new Map());

  // Expose pose map on window for console debugging:
  //   showExpressionPoses()                            — log all expression→pose mappings
  //   showExpressionPoses('REEF')                      — filter by name substring
  //   resolveExpressionPose('fieldConstants::FRONT') — check if a specific expression resolves
  useEffect(() => {
    (window as any).showExpressionPoses = (filter?: string) => {
      const entries = [...expressionPoseMap.entries()]
        .filter(([key]) => !filter || key.toLowerCase().includes(filter.toLowerCase()));
      if (entries.length === 0) {
        console.log(filter ? `No poses matching "${filter}"` : 'No Pose2d expressions found');
        return;
      }
      console.table(
        Object.fromEntries(entries.map(([key, c]) => [key, { x: c.x, y: c.y, rotation: c.rotation, qualifiedName: c.qualifiedName }])),
      );
    };
    (window as any).resolveExpressionPose = (name: string) => {
      const key = name.replace(/\s+/g, '');
      const result = expressionPoseMap.get(key);
      if (result) {
        console.log(`✓ "${key}" resolves to:`, result);
      } else {
        console.warn(`✗ "${key}" not found in expression pose map`);
        const nearby = [...expressionPoseMap.keys()].filter(k => k.toLowerCase().includes(key.split('::').pop()!.toLowerCase()));
        if (nearby.length > 0) console.log('Similar keys:', nearby);
      }
    };
    return () => {
      delete (window as any).showExpressionPoses;
      delete (window as any).resolveExpressionPose;
    };
  }, [expressionPoseMap]);

  // Store keys rather than object refs so views auto-update when files change.
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedCommandName, setSelectedCommandName] = useState<string | null>(null);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [watching, setWatching] = useState(false);

  // Map<filePath, lastModified> — used by the poll loop to detect changes.
  const lastModifiedRef = useRef<Map<string, number>>(new Map());
  // Map<filePath, Pose2dConstant[]> — per-file pose cache; avoids re-reading
  // all files when only one changes during polling.
  const posesByFileRef = useRef<Map<string, Pose2dConstant[]>>(new Map());
  // Guard against concurrent poll invocations.
  const pollingRef = useRef(false);

  // Derive selected objects from state — updates automatically when files change.
  const selectedFile = useMemo(
    () => files.find(f => f.filePath === selectedFilePath) ?? null,
    [files, selectedFilePath],
  );
  const selectedCommand = useMemo(
    () => selectedFile?.functions.find(fn => fn.fullName === selectedCommandName) ?? null,
    [selectedFile, selectedCommandName],
  );

  // ── Initial full load from a FileSystemDirectoryHandle ──────────────────────
  const loadFromHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    lastModifiedRef.current.clear();
    posesByFileRef.current.clear();
    const parsed: ParsedFile[] = [];
    for await (const { handle: fh, path } of walkSourceFiles(handle)) {
      try {
        const file = await fh.getFile();
        lastModifiedRef.current.set(path, file.lastModified);
        const code = await file.text();
        posesByFileRef.current.set(path, extractPose2dConstants(code));
        if (!isHeaderFile(file.name)) {
          const result = parseFile(file.name, path, code);
          if (result.functions.length > 0) parsed.push(result);
        }
      } catch { /* skip unreadable files */ }
    }
    setFiles(sortFiles(parsed));
    setExpressionPoseMap(buildExpressionPoseMap([...posesByFileRef.current.values()].flat()));
    setSelectedFilePath(null);
    setSelectedCommandName(null);
  }, []);

  // ── Open via File System Access API (with watching) ─────────────────────────
  const handleOpenWithPicker = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      setDirHandle(handle);
      setWatching(false); // reset while loading
      await loadFromHandle(handle);
      setWatching(true);
    } catch {
      // User cancelled the picker — do nothing.
    }
  }, [loadFromHandle]);

  // ── Fallback: load from <input webkitdirectory> FileList (no watching) ──────
  const handleLoadFiles = useCallback(async (fileList: FileList) => {
    setDirHandle(null);
    setWatching(false);
    lastModifiedRef.current.clear();
    posesByFileRef.current.clear();
    const parsed: ParsedFile[] = [];
    for (const file of Array.from(fileList).filter(f => SOURCE_EXTS.some(ext => f.name.endsWith(ext)))) {
      try {
        const path = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name;
        const code = await file.text();
        posesByFileRef.current.set(path, extractPose2dConstants(code));
        if (!isHeaderFile(file.name)) {
          const result = parseFile(file.name, path, code);
          if (result.functions.length > 0) parsed.push(result);
        }
      } catch { /* skip */ }
    }
    setFiles(sortFiles(parsed));
    setExpressionPoseMap(buildExpressionPoseMap([...posesByFileRef.current.values()].flat()));
    setSelectedFilePath(null);
    setSelectedCommandName(null);
  }, []);

  // ── Poll for changes every 1.5 s ───────────────────────────────────────────
  useEffect(() => {
    if (!dirHandle || !watching) return;

    const poll = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const updates: { path: string; parsed: ParsedFile | null }[] = [];
        let constantsChanged = false;

        for await (const { handle, path } of walkSourceFiles(dirHandle)) {
          const file = await handle.getFile();
          const prev = lastModifiedRef.current.get(path) ?? 0;
          if (file.lastModified === prev) continue;

          lastModifiedRef.current.set(path, file.lastModified);
          try {
            const code = await file.text();
            posesByFileRef.current.set(path, extractPose2dConstants(code));
            constantsChanged = true;
            if (!isHeaderFile(file.name)) {
              const result = parseFile(file.name, path, code);
              updates.push({ path, parsed: result.functions.length > 0 ? result : null });
            }
          } catch {
            posesByFileRef.current.delete(path);
            constantsChanged = true;
            if (!isHeaderFile(file.name)) {
              updates.push({ path, parsed: null });
            }
          }
        }

        if (updates.length > 0) {
          setFiles(prev =>
            sortFiles(
              prev
                .filter(f => !updates.some(u => u.path === f.filePath))
                .concat(updates.flatMap(u => (u.parsed ? [u.parsed] : []))),
            ),
          );
        }

        if (constantsChanged) {
          setExpressionPoseMap(buildExpressionPoseMap([...posesByFileRef.current.values()].flat()));
        }
      } finally {
        pollingRef.current = false;
      }
    };

    const id = setInterval(() => { void poll(); }, 1500);
    return () => clearInterval(id);
  }, [dirHandle, watching]);

  // ── Column widths ───────────────────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [panelWidth,   setPanelWidth]   = useState(220);

  const startResize = useCallback((
    e: React.MouseEvent,
    setter: (w: number) => void,
    currentWidth: number,
    min = 150,
    max = 600,
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      setter(Math.max(min, Math.min(max, currentWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  // ── Selection handlers ──────────────────────────────────────────────────────
  const handleSelectFile = useCallback((file: ParsedFile) => {
    setSelectedFilePath(file.filePath);
    setSelectedCommandName(null);
  }, []);

  const handleSelectCommand = useCallback((cmd: CommandFunction) => {
    setSelectedCommandName(cmd.fullName);
  }, []);

  return (
    <div
      className="app-layout"
      data-has-panel={selectedFile !== null ? 'true' : 'false'}
      style={{
        '--sidebar-w': `${sidebarWidth}px`,
        '--panel-w':   `${panelWidth}px`,
      } as React.CSSProperties}
    >
      <FileSidebar
        files={files}
        selectedFile={selectedFile}
        watching={watching}
        onSelectFile={handleSelectFile}
        onLoadFiles={handleLoadFiles}
        onOpenWithPicker={handleOpenWithPicker}
      />
      <div
        className="resize-handle"
        onMouseDown={e => startResize(e, setSidebarWidth, sidebarWidth)}
      />
      {selectedFile !== null && (
        <>
          <CommandPanel
            file={selectedFile}
            selectedCommand={selectedCommand}
            onSelectCommand={handleSelectCommand}
          />
          <div
            className="resize-handle"
            onMouseDown={e => startResize(e, setPanelWidth, panelWidth)}
          />
        </>
      )}
      <Viewer command={selectedCommand} expressionPoseMap={expressionPoseMap} />
    </div>
  );
}
