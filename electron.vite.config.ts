import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        'react-router-dom': resolve('src/renderer/src/lib/react-router-dom.tsx'),
        react: resolve('node_modules/react'),
        'react-dom': resolve('node_modules/react-dom'),
        'react-dnd': resolve('node_modules/react-dnd'),
        'react-dnd-html5-backend': resolve('node_modules/react-dnd-html5-backend'),
        'dnd-core': resolve('node_modules/dnd-core')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
