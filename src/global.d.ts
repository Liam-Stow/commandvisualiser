// Extend TypeScript's DOM lib with File System Access API members that are
// not yet included in the bundled lib.dom.d.ts used by this project.

interface FileSystemDirectoryHandle {
  /** Async-iterate over [name, handle] pairs in this directory. */
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
  }): Promise<FileSystemDirectoryHandle>;
}
