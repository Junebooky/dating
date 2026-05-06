import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');

      Object.entries(env).forEach(([key, value]) => {
        process.env[key] ??= value;
      });
    },
    configureServer(server) {
      server.middlewares.use('/api/weather/kma', async (request, response) => {
        try {
          const { default: handler } = await import('./api/weather/kma.js');
          await handler(request, response);
        } catch (error) {
          console.error('Local weather API failed', error);
          if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json');
          }
          response.end(JSON.stringify({ error: '로컬 날씨 API를 실행하지 못했습니다.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localApiPlugin(), react()],
})
