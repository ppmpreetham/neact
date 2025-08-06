import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    loader: 'jsx',               // Treat .js files as JSX
    include: /dist\/.*\.js$/,     // Only apply inside src/
  }
})
