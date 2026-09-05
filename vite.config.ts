import { defineConfig } from 'vite';

// Project-page default for GitHub Pages (whoislewis/personal -> /personal/).
// Switch to '/' once a custom domain (whoislewis.nl) is wired up with a CNAME.
export default defineConfig({
  base: '/personal/',
  build: {
    target: 'es2020',
  },
});
