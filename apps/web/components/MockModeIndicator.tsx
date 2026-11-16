import React, { useSyncExternalStore } from 'react';
import { isMockMode, subscribeMockMode } from '../lib/api';

const MockModeIndicator: React.FC = () => {
  const mockMode = useSyncExternalStore(subscribeMockMode, isMockMode);

  if (!mockMode) return null;

  return (
    <div
      role="status"
      className="fixed bottom-3 right-3 z-50 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-600 shadow-sm backdrop-blur dark:text-amber-400"
    >
      Mock 模式 · 离线开发数据仅保存在本机
    </div>
  );
};

export default MockModeIndicator;
