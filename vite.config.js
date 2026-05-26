import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['nonexperimental-pseudofeverish-ouida.ngrok-free.dev','https://k1716qb3-5173.asse.devtunnels.ms'],
    proxy: {
      '/hentaicity-search': {
        target: 'https://www.hentaicity.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hentaicity-search/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        player: 'player.html'
      }
    }
  }
});
