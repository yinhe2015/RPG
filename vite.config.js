import {defineConfig} from 'vite';
import {createApiMiddleware, blockPrivateFiles} from './server/api.js';

export default defineConfig({
  build:{rollupOptions:{input:{game:'index.html',learn:'learn.html'}}},
  plugins: [{
    name: 'subject-quest-api',
    configureServer(server) {
      server.middlewares.use(blockPrivateFiles);
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(blockPrivateFiles);
      server.middlewares.use(createApiMiddleware());
    },
  }],
  server: {
    fs: {deny: ['.env', '.env.*', '**/*apikey*', '**/server/**', '**/server.js', '**/vite.config.*', '**/data/**', '**/accounts.json*','**/question-banks/**','**/pal/*.MKF','**/pal/*.EXE','**/pal/*.exe','**/pal/*.RPG']},
    watch: {ignored: ['**/data/**']},
  },
});
