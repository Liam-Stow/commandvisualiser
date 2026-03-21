import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ParsedFile, CommandFunction } from './types/command';
import { parseFile } from './parser/cppParser';
import { FileSidebar } from './components/FileSidebar';
import { CommandPanel } from './components/CommandPanel';
import { Viewer } from './components/Viewer';

// ─── File system helpers ──────────────────────────────────────────────────────

/** Recursively walk a directory, yielding handles for every .cpp file found. */
async function* walkCppFiles(
  dir: FileSystemDirectoryHandle,
  basePath = '',
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  for await (const [name, entry] of dir) {
    const fullPath = basePath ? `${basePath}/${name}` : name;
    if (entry.kind === 'file' && name.endsWith('.cpp')) {
      yield { handle: entry as FileSystemFileHandle, path: fullPath };
    } else if (entry.kind === 'directory') {
      yield* walkCppFiles(entry as FileSystemDirectoryHandle, fullPath);
    }
  }
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

  // Store keys rather than object refs so views auto-update when files change.
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedCommandName, setSelectedCommandName] = useState<string | null>(null);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [watching, setWatching] = useState(false);

  // Map<filePath, lastModified> — used by the poll loop to detect changes.
  const lastModifiedRef = useRef<Map<string, number>>(new Map());
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
    const parsed: ParsedFile[] = [];
    for await (const { handle: fh, path } of walkCppFiles(handle)) {
      try {
        const file = await fh.getFile();
        lastModifiedRef.current.set(path, file.lastModified);
        const code = await file.text();
        const result = parseFile(file.name, path, code);
        if (result.functions.length > 0) parsed.push(result);
      } catch { /* skip unreadable files */ }
    }
    setFiles(sortFiles(parsed));
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
    const parsed: ParsedFile[] = [];
    for (const file of Array.from(fileList).filter(f => f.name.endsWith('.cpp'))) {
      try {
        const path = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name;
        const code = await file.text();
        const result = parseFile(file.name, path, code);
        if (result.functions.length > 0) parsed.push(result);
      } catch { /* skip */ }
    }
    setFiles(sortFiles(parsed));
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

        for await (const { handle, path } of walkCppFiles(dirHandle)) {
          const file = await handle.getFile();
          const prev = lastModifiedRef.current.get(path) ?? 0;
          if (file.lastModified === prev) continue;

          lastModifiedRef.current.set(path, file.lastModified);
          try {
            const code = await file.text();
            const result = parseFile(file.name, path, code);
            updates.push({ path, parsed: result.functions.length > 0 ? result : null });
          } catch {
            updates.push({ path, parsed: null });
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
      <CommandPanel
        file={selectedFile}
        selectedCommand={selectedCommand}
        onSelectCommand={handleSelectCommand}
      />
      <div
        className="resize-handle"
        onMouseDown={e => startResize(e, setPanelWidth, panelWidth)}
      />
      <Viewer command={selectedCommand} />
    </div>
  );
}
