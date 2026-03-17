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
// ✅ FIX: PROPER PROXY CONFIGURATION
proxy: {
 '/api': {
  target: 'http://localhost:3000',
 changeOrigin: true,
 secure: false,
 rewrite: (path) => path,
},
 '/anime': {
   target: 'http://localhost:3000',
 changeOrigin: true,
 secure: false,
}
}
},
plugins: [
react(),
VitePWA({
registerType: 'autoUpdate',
manifest: {
  name: 'Animabingwatch - Anime & Movies',
  short_name: 'Animabingwatch',
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
    'process.env': env,
    'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
    'import.meta.env.VITE_SITE_URL': JSON.stringify(env.VITE_SITE_URL),
    'import.meta.env.MODE': JSON.stringify(mode),
    // ✅ FIX: USE RELATIVE PATH FOR PROXY
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
