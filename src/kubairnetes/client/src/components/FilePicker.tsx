import { useState, useEffect } from 'react';
import { browseFiles } from '../lib/api';
import type { FileEntry } from '../lib/types';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, BookOpen } from 'lucide-react';

interface FilePickerProps {
  onSelect: (readmePath: string) => void;
}

function FileNode({
  entry,
  depth,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (entry.type === 'file') {
    return (
      <button
        onClick={() => onSelect(entry.path)}
        className={`flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-kube-surface-light rounded transition-colors text-sm ${
          entry.isReadme
            ? 'text-kube-glow font-medium'
            : 'text-kube-muted'
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {entry.isReadme ? (
          <BookOpen size={15} className="text-kube-glow shrink-0" />
        ) : (
          <FileText size={15} className="text-kube-muted shrink-0" />
        )}
        <span className="truncate">{entry.name}</span>
        {entry.isReadme && (
          <span className="ml-auto text-xs bg-kube-blue/20 text-kube-glow px-2 py-0.5 rounded">
            README
          </span>
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-kube-surface-light rounded transition-colors text-sm text-slate-300"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-kube-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-kube-muted shrink-0" />
        )}
        {expanded ? (
          <FolderOpen size={15} className="text-kube-warning shrink-0" />
        ) : (
          <Folder size={15} className="text-kube-warning shrink-0" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {expanded && entry.children?.map((child) => (
        <FileNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function FilePicker({ onSelect }: FilePickerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [root, setRoot] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    browseFiles()
      .then((data) => {
        setEntries(data.entries);
        setRoot(data.root);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl bg-kube-surface border border-kube-border rounded-xl shadow-2xl glow-blue overflow-hidden">
        <div className="px-6 py-5 border-b border-kube-border">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">☸️</span>
            Welcome to KubAIrnetes
          </h2>
          <p className="text-kube-muted mt-1 text-sm">
            Select a README to begin your interactive Kubernetes guide
          </p>
          {root && (
            <p className="text-xs text-kube-muted/60 mt-1 font-mono">{root}</p>
          )}
        </div>

        <div className="max-h-[500px] overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-kube-muted">
              <div className="animate-spin mr-3 h-5 w-5 border-2 border-kube-glow border-t-transparent rounded-full" />
              Scanning for README files...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-kube-danger">
              Error: {error}
            </div>
          )}

          {!isLoading && !error && entries.map((entry) => (
            <FileNode
              key={entry.path}
              entry={entry}
              depth={0}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
