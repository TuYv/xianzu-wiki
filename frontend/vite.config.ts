import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 部署到 GitHub Pages 项目站点时设 VITE_BASE=/<repo>/(如 /xianzu-wiki/);
// 本地与根域名部署保持默认 '/'。
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  // 仅本地开发用:把 /api 代理到本地编辑器后端(生产静态站不走后端)。
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
