import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        'react-router-dom': resolve(__dirname, 'src/renderer/src/lib/react-router-dom.tsx'),
        react: dirname(require.resolve('react/package.json')),
        'react-dom': dirname(require.resolve('react-dom/package.json')),
        'react-dnd': dirname(require.resolve('react-dnd/package.json')),
        'react-dnd-html5-backend': dirname(require.resolve('react-dnd-html5-backend/package.json')),
        'dnd-core': dirname(require.resolve('dnd-core/package.json'))
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
