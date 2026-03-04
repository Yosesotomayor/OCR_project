import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer' // Instala esto: npm view rollup-plugin-visualizer

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Esto te dirá exactamente qué librería está "engordando" tu bundle
    visualizer({
      open: true,
      filename: 'bundle-analysis.html',
      gzipSize: true,
    }),
  ],

  optimizeDeps: {
    include: ['react-window'],
  },

  build: {
    // 1. Divide y vencerás: Separamos las librerías pesadas del código de tu app
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Agrupamos todo lo de node_modules en un chunk llamado 'vendor'
            return 'vendor';
          }
        },
      },
    },
    // 2. Limpieza de logs en producción
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    commonjsOptions: {
      include: [/react-window/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})