import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Geliştirmede /api aynı origin'den gider; çerez sorunu ve CORS istisnası olmaz.
    proxy: { '/api': { target: 'http://localhost:3100', changeOrigin: false } },
  },
});
