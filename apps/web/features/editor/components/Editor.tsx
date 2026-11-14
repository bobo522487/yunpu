import React from 'react';
import { X } from 'lucide-react';
import { FileSystemNode } from '../../../types';
import { useEditorStore } from '../../../store/useEditorStore';

const findNode = (nodes: FileSystemNode[], id: string): FileSystemNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const Editor: React.FC = () => {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.editorActiveTabId);
  const files = useEditorStore((s) => s.files);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setEditorActiveTabId = useEditorStore((s) => s.setEditorActiveTabId);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeFileNode = activeTab ? findNode(files, activeTab.fileId) : null;
  const activeFileContent = activeFileNode?.content || '';

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(id);
  };

  const lines = activeFileContent.split('\n').length;
  const lineNumbers = Array.from({ length: lines }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col bg-ide-panel h-full overflow-hidden min-w-0">
      <div className="flex bg-ide-bg overflow-x-auto scrollbar-hide border-b border-ide-border h-9">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setEditorActiveTabId(tab.id)}
            className={`
              group flex items-center min-w-[120px] max-w-[200px] px-3 text-xs border-r border-ide-border cursor-pointer select-none
              ${
                activeTabId === tab.id
                  ? 'bg-ide-panel text-white border-t-2 border-t-ide-accent'
                  : 'bg-ide-bg text-gray-500 hover:bg-[#1f1f1f]'
              }
            `}
          >
            <span className="truncate flex-1 mr-2">{tab.title}</span>
            <button
              onClick={(e) => handleCloseTab(tab.id, e)}
              className={`opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 ${
                activeTabId === tab.id ? 'opacity-100' : ''
              }`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {activeTabId ? (
        <div className="flex-1 flex relative overflow-hidden">
          <div className="w-12 bg-ide-bg text-gray-600 text-right pr-3 pt-4 text-xs font-mono select-none border-r border-ide-border leading-6">
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>

          <div className="flex-1 relative">
            <textarea
              value={activeFileContent}
              onChange={(e) => updateFileContent(e.target.value)}
              className="w-full h-full bg-ide-panel text-gray-300 font-mono text-sm p-4 pt-4 outline-none resize-none leading-6 whitespace-pre tab-4"
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="mb-4 text-6xl opacity-20 font-bold">CS</div>
            <p className="text-sm">Select a file to start editing</p>
            <p className="text-xs mt-2 opacity-60">Use ⌘+P to search files</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;