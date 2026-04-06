import { useRef } from 'react';
import type { ParsedFile } from '../types/command';
import { LightningIcon, GearIcon, FileIcon, FolderIcon } from './Icons';

interface Props {
  files: ParsedFile[];
  selectedFile: ParsedFile | null;
  watching: boolean;
  onSelectFile: (file: ParsedFile) => void;
  onLoadFiles: (files: FileList) => void;
  onOpenWithPicker: () => void;
}

interface FileItemProps {
  file: ParsedFile;
  active: boolean;
  onSelect: (file: ParsedFile) => void;
}

function FileItem({ file, active, onSelect }: FileItemProps) {
  return (
    <button
      className={`file-item ${active ? 'active' : ''}`}
      onClick={() => onSelect(file)}
      title={file.filePath}
    >
      <span className="file-icon"><CategoryIcon cat={file.category} /></span>
      <span className="file-name">{file.fileName}</span>
      <span className="file-count">{file.functions.length}</span>
    </button>
  );
}

interface FileGroupProps {
  title: string;
  items: ParsedFile[];
  selectedFile: ParsedFile | null;
  onSelect: (file: ParsedFile) => void;
}

function FileGroup({ title, items, selectedFile, onSelect }: FileGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="file-group">
      <div className="file-group-header">{title}</div>
      {items.map(f => (
        <FileItem key={f.filePath} file={f} active={selectedFile?.filePath === f.filePath} onSelect={onSelect} />
      ))}
    </div>
  );
}

function CategoryIcon({ cat }: { cat: ParsedFile['category'] }) {
  if (cat === 'commands') {
    return <LightningIcon />;
  }
  if (cat === 'subsystems') return <GearIcon />;
  return <FileIcon />;
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
            <div className="empty-icon"><FolderIcon /></div>
            <p>Open an FRC C++ project folder to see its command files.</p>
            <p className="hint">
              Select the project root — the app will find all command and subsystem files automatically.
            </p>
          </div>
        ) : (
          <>
            <FileGroup title="Commands"   items={commands}   selectedFile={selectedFile} onSelect={onSelectFile} />
            <FileGroup title="Subsystems" items={subsystems} selectedFile={selectedFile} onSelect={onSelectFile} />
            <FileGroup title="Other"      items={other}      selectedFile={selectedFile} onSelect={onSelectFile} />
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
