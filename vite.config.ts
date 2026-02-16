import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Prevent Vite from replacing process.env with statically analyzed values
    // so we can use our runtime polyfill in index.html
    'process.env': 'window.process.env'
  }
});