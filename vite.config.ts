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
              }
          }
      }
    },
    esbuild: {
      drop: ['console', 'debugger'],
    }
  }
})