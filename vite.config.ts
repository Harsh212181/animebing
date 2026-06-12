import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all env vars from .env files (no harm, but we won't expose them all)
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
        },
      },
    },
    plugins: [react()],
    define: {
      // ✅ Specific safe variables instead of the whole process.env
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_SITE_URL': JSON.stringify(env.VITE_SITE_URL),
      'import.meta.env.MODE': JSON.stringify(mode),
      __VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
      // 👆 ab sirf chuninda variables hi client ke paas jaayenge, pura process.env nahi
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
            'vendor-react': ['react', 'react-dom'],
            'vendor-router': ['react-router-dom', 'react-helmet-async'],
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