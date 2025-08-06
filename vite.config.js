import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    loader: 'jsx',               // Treat .js files as JSX
    include: /src\/.*\.js$/,     // Only apply inside src/
  }
})
