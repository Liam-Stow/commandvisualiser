import { useState, useCallback } from 'react';
import type { ParsedFile, CommandFunction } from './types/command';
import { parseFile } from './parser/cppParser';
import { FileSidebar } from './components/FileSidebar';
import { CommandPanel } from './components/CommandPanel';
import { Viewer } from './components/Viewer';

export default function App() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<CommandFunction | null>(null);

  const handleLoadFiles = useCallback(async (fileList: FileList) => {
    const cppFiles = Array.from(fileList).filter(f => f.name.endsWith('.cpp'));

    const parsed: ParsedFile[] = [];
    for (const file of cppFiles) {
      try {
        const code = await file.text();
        const path = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name;
        const result = parseFile(file.name, path, code);
        // Only include files that have at least one frc2::CommandPtr function
        if (result.functions.length > 0) {
          parsed.push(result);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Sort: commands first, then subsystems, then other; alphabetically within each
    parsed.sort((a, b) => {
      const catOrder = { commands: 0, subsystems: 1, other: 2 };
      const diff = catOrder[a.category] - catOrder[b.category];
      if (diff !== 0) return diff;
      return a.fileName.localeCompare(b.fileName);
    });

    setFiles(parsed);
    setSelectedFile(null);
    setSelectedCommand(null);
  }, []);

  const handleSelectFile = useCallback((file: ParsedFile) => {
    setSelectedFile(file);
    setSelectedCommand(null);
  }, []);

  const handleSelectCommand = useCallback((cmd: CommandFunction) => {
    setSelectedCommand(cmd);
  }, []);

  return (
    <div className="app-layout">
      <FileSidebar
        files={files}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        onLoadFiles={handleLoadFiles}
      />
      <CommandPanel
        file={selectedFile}
        selectedCommand={selectedCommand}
        onSelectCommand={handleSelectCommand}
      />
      <Viewer command={selectedCommand} />
    </div>
  );
}
