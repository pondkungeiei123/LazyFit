import { defineConfig, searchForWorkspaceRoot } from 'vite'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwind()],
  base: './',
  server: {
    watch: { ignored: ['**/.android-tools/**'] },
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.android-tools/**', '**/*.local.json', '**/*.lazyfit-backup.json'],
    },
  },
})
