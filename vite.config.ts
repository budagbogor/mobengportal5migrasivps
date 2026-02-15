import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['@google/genai', 'uuid', 'react-markdown', 'remark-gfm'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-media': ['react-webcam', '@mediapipe/camera_utils', '@mediapipe/face_mesh']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        headers: {
          'Authorization': 'Bearer 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'
        }
      }
    }
  },
});