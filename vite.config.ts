import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // ── Migration shim aliases ─────────────────────────────────────────────
      // Components import from 'firebase/firestore' and 'firebase/auth'.
      // We redirect those to our Supabase-backed shims so no component
      // file needs to change.
      'firebase/firestore': path.resolve(__dirname, 'src/lib/firestoreShim.ts'),
      'firebase/auth':      path.resolve(__dirname, 'src/lib/supabaseAuth.ts'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
