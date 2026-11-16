import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import { maybeEnableMock } from './features/auth/enableMock';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Mock 后端只在 dev + VITE_ENABLE_MOCK=1 时加载注册；生产构建整条链被剔除。
void maybeEnableMock();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);