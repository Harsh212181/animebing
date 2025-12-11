  import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 5173,
      host: true,
    },

    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Animabing - Anime & Movies',
          short_name: 'Animabing',
          description: 'Download and watch anime in Hindi for free',
          theme_color: '#8B5CF6',
          background_color: '#0a0c1c',
          display: 'standalone',
          icons: [
            {
              src: '/favicon.ico',
              sizes: '64x64',
              type: 'image/x-icon'
            }
          ]
        }
      })
    ],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || 'http://localhost:3000/api'),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'components'),
        '@types': path.resolve(__dirname, 'src/types'),
      },
    },

    // Production optimization
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  };
});
