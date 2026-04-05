import { useRef } from 'react';
import type { ParsedFile } from '../types/command';

interface Props {
  files: ParsedFile[];
  selectedFile: ParsedFile | null;
  watching: boolean;
  onSelectFile: (file: ParsedFile) => void;
  onLoadFiles: (files: FileList) => void;
  onOpenWithPicker: () => void;
}

function CategoryIcon({ cat }: { cat: ParsedFile['category'] }) {
  if (cat === 'commands') {
    return (
      <svg width="11" height="11" viewBox="0 0 10 13" fill="currentColor" aria-hidden>
        <path d="M6.5 0L0 7.5h4.5L3 13 10 5H5.5L6.5 0z" fillRule="evenodd"/>
      </svg>
    );
  }
  if (cat === 'subsystems') {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 15.5a3.5 3.5 0 0 1-3.5-3.5A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.33-1.82-2.22-3.84-2.74 1.1c-.57-.44-1.18-.79-1.86-1.05L14.5 2h-5l-.68 3.81c-.68.26-1.29.61-1.86 1.05L4.22 5.76 2 9.6l2.33 1.82c-.04.34-.07.68-.07 1.08s.03.74.07 1.08L2 15.4l2.22 3.84 2.74-1.1c.57.44 1.18.79 1.86 1.05L9.5 23h5l.68-3.81c.68-.26 1.29-.61 1.86-1.05l2.74 1.1L22 15.4l-2.57-1.82z"/>
      </svg>
    );
  }
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
    </svg>
  );
}

export function FileSidebar({ files, selectedFile, watching, onSelectFile, onLoadFiles, onOpenWithPicker }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  /** Use the File System Access API picker when available, fall back to the
   *  hidden <input> for browsers that don't support it (e.g. Firefox). */
  const handleOpenClick = () => {
    if ('showDirectoryPicker' in window) {
      onOpenWithPicker();
    } else {
      inputRef.current?.click();
    }
  };

  const commands   = files.filter(f => f.category === 'commands');
  const subsystems = files.filter(f => f.category === 'subsystems');
  const other      = files.filter(f => f.category === 'other');

  function FileItem({ file }: { file: ParsedFile }) {
    const active = selectedFile?.filePath === file.filePath;
    return (
      <button
        className={`file-item ${active ? 'active' : ''}`}
        onClick={() => onSelectFile(file)}
        title={file.filePath}
      >
        <span className="file-icon"><CategoryIcon cat={file.category} /></span>
        <span className="file-name">{file.fileName}</span>
        <span className="file-count">{file.functions.length}</span>
      </button>
    );
  }

  function FileGroup({ title, items }: { title: string; items: ParsedFile[] }) {
    if (items.length === 0) return null;
    return (
      <div className="file-group">
        <div className="file-group-header">{title}</div>
        {items.map(f => <FileItem key={f.filePath} file={f} />)}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={`${import.meta.env.BASE_URL}Logo.White.png`} alt="ICRobotics" className="sidebar-logo" />
        <div className="sidebar-title">Command Visualiser</div>
      </div>

      <div className="sidebar-actions">
        <button className="btn-primary" onClick={handleOpenClick}>
          Open Project Folder
        </button>
        {/* Fallback for browsers without showDirectoryPicker (no file watching) */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".cpp,.h"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          style={{ display: 'none' }}
          onChange={e => e.target.files && onLoadFiles(e.target.files)}
        />
      </div>

      <div className="sidebar-files">
        {files.length === 0 ? (
          <div className="sidebar-empty">
            <div className="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <p>Open an FRC C++ project folder to see its command files.</p>
            <p className="hint">
              Select the project root — the app will find all command and subsystem files automatically.
            </p>
          </div>
        ) : (
          <>
            <FileGroup title="Commands" items={commands} />
            <FileGroup title="Subsystems" items={subsystems} />
            <FileGroup title="Other" items={other} />
          </>
        )}
      </div>

      <div className="sidebar-footer">
        {watching && (
          <span className="watching-badge">
            <span className="watching-dot" />
            Live
          </span>
        )}
        {files.length > 0 && (
          <span>{files.length} file{files.length !== 1 ? 's' : ''} loaded</span>
        )}
      </div>
    </aside>
  );
}
