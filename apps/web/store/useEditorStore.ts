import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileSystemNode, FileType, Tab } from '../types';
import { INITIAL_FILES } from '../constants';
import { createAppStorage } from './storageAdapter';

interface EditorState {
  files: FileSystemNode[];
  tabs: Tab[];
  editorActiveTabId: string | null;
  toggleFolder: (id: string) => void;
  selectFile: (node: FileSystemNode) => void;
  closeTab: (tabId: string) => void;
  updateFileContent: (content: string) => void;
  setEditorActiveTabId: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      files: INITIAL_FILES,
      tabs: [],
      editorActiveTabId: null,

      toggleFolder: (id) =>
        set((state) => {
          const findAndToggle = (nodes: FileSystemNode[]): FileSystemNode[] =>
            nodes.map((node) => {
              if (node.id === id && node.type === FileType.FOLDER) {
                return { ...node, isOpen: !node.isOpen };
              }
              if (node.children) {
                return { ...node, children: findAndToggle(node.children) };
              }
              return node;
            });
          return { files: findAndToggle(state.files) };
        }),

      selectFile: (node) =>
        set((state) => {
          if (node.type !== FileType.FILE) return {};
          const existingTab = state.tabs.find((t) => t.fileId === node.id);
          if (existingTab) {
            return { editorActiveTabId: existingTab.id };
          }
          const newTab: Tab = {
            id: `tab-${node.id}`,
            fileId: node.id,
            title: node.name,
          };
          return {
            tabs: [...state.tabs, newTab],
            editorActiveTabId: newTab.id,
          };
        }),

      closeTab: (tabId) =>
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          let nextActiveId = state.editorActiveTabId;
          if (state.editorActiveTabId === tabId) {
            if (newTabs.length > 0) {
              const newActiveIndex = Math.max(0, tabIndex - 1);
              nextActiveId = newTabs[newActiveIndex].id;
            } else {
              nextActiveId = null;
            }
          }
          return { tabs: newTabs, editorActiveTabId: nextActiveId };
        }),

      updateFileContent: (content) =>
        set((state) => {
          if (!state.editorActiveTabId) return {};
          const currentTab = state.tabs.find((t) => t.id === state.editorActiveTabId);
          if (!currentTab) return {};

          const findAndUpdate = (nodes: FileSystemNode[]): FileSystemNode[] =>
            nodes.map((node) => {
              if (node.id === currentTab.fileId) {
                return { ...node, content };
              }
              if (node.children) {
                return { ...node, children: findAndUpdate(node.children) };
              }
              return node;
            });

          return { files: findAndUpdate(state.files) };
        }),

      setEditorActiveTabId: (editorActiveTabId) => set({ editorActiveTabId }),
    }),
    {
      name: 'nocoapp:editor',
      version: 1,
      storage: createAppStorage(),
    }
  )
);
