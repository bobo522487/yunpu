import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    // 与 AI Studio 环境一致：前端 3000；后端 API 在 3001（env.sh development）。
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // 本地默认指向后端 3001；其他环境用环境变量覆盖。
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
