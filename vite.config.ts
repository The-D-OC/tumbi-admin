import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only admin tool. Bound to localhost so it isn't exposed on your network.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5177 },
});
