import { defineConfig, searchForWorkspaceRoot } from 'vite'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwind()],
  base: './',
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/*.local.json', '**/*.lazyfit-backup.json'],
    },
  },
})
