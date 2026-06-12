import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React — sabse pehle load hoga, sabse important
            'vendor-react': ['react', 'react-dom'],
            // Router + Helmet — alag chunk
            'vendor-router': ['react-router-dom', 'react-helmet-async'],
            // Admin panel — sirf admin use karta hai, lazy load hoga
            'vendor-admin': [
              './src/components/admin/AdminDashboard',
              './src/components/admin/AdminLogin',
              './src/components/admin/AddAnimeForm',
              './src/components/admin/AnimeListTable',
              './src/components/admin/EpisodesManager',
              './src/components/admin/PartnerManager',
              './src/components/admin/PollManager',
              './src/components/admin/ReportsManager',
              './src/components/admin/SettingsPanel',
              './src/components/admin/SocialMediaManager',
              './src/components/admin/FeaturedAnimeManager',
            ],
          },
        },
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