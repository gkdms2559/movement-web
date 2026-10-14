import { defineConfig } from 'vite'

declare const process: {
  env: Record<string, string | undefined>
}

// GitHub Pages serves this repository from /<repository-name>/.
// Keep local development at /, while making the production build portable
// when it runs in GitHub Actions (including after a repository rename).
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'movement-web'
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
  },
  base: isGitHubPagesBuild ? `/${repositoryName}/` : '/',
  build: {
    rollupOptions: {
      input: ['index.html', 'examples/watering.html', 'examples/kitty-flip.html', 'examples/words-in-motion.html'],
    },
  },
})
