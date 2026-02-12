import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '')

  return {
    plugins: [react()],
    base: './', // Penting agar aset terbaca di Android (file://)
    build: {
      outDir: 'dist',
      target: 'es2020', // Modern JS for faster execution on mobile webviews
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      minify: 'esbuild',
      rollupOptions: {
          output: {
              manualChunks: {
                  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                  'vendor-ui': ['recharts', 'html-to-image'],
                  'vendor-query': ['@tanstack/react-query'],
                  'vendor-data': ['@supabase/supabase-js', 'xlsx'],
                  'vendor-capacitor': ['@capacitor/core', '@capacitor/filesystem', '@capacitor/share', 'capacitor-native-biometric'],
              },
              // Cache headers untuk optimasi bandwidth
              assetFileNames: 'assets/[name]-[hash][extname]',
          }
      },
      // Tambah cache headers untuk static assets
      headers: {
        // Cache untuk JS, CSS files (hash-based, tidak akan berubah)
        '**/*.js': {
          headers: [
            {
              name: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        '**/*.css': {
          headers: [
            {
              name: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        // Cache untuk gambar dan font
        '**/*.{png,jpg,jpeg,svg,ico,webp,woff,woff2}': {
          headers: [
            {
              name: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        // HTML tidak di-cache (selalu ambil yang terbaru)
        '**/*.html': {
          headers: [
            {
              name: 'Cache-Control',
              value: 'public, max-age=0, must-revalidate'
            }
          ]
        }
      }
    },
    esbuild: {
      drop: ['console', 'debugger'],
    }
  }
})