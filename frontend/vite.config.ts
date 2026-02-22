import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/upload': 'http://localhost:5001',
      '/upload-stream': 'http://localhost:5001',
      '/send-email': 'http://localhost:5001',
      '/send-slack': 'http://localhost:5001',
      '/push-to-sheets': 'http://localhost:5001',
      '/pdf': 'http://localhost:5001',
      '/auth': 'http://localhost:5001',
    },
  },
})
