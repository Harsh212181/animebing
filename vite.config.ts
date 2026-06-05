import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// ❌ VitePWA removed — no more manifest / service worker

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
        },
        '/anime': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      // ❌ VitePWA({ ... }) removed
    ],
    define: {
      'process.env': env,
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_SITE_URL': JSON.stringify(env.VITE_SITE_URL),
      'import.meta.env.MODE': JSON.stringify(mode),
      __VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'components'),
        '@types': path.resolve(__dirname, 'src/types'),
      },
    },
    build: {
      minify: 'terser',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          }
        }
      },
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
    },
  };
});