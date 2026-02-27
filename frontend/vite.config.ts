import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  optimizeDeps: {
    include: ['react-window'],
  },
  build: {

    commonjsOptions: {
      include: [/react-window/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})