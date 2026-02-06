import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import * as dotenv from 'dotenv';
import { devtools } from '@tanstack/devtools-vite';

// Load .env.local (TanStack Start/Vite convention)
dotenv.config({ path: '.env.local', quiet: true });
// Also load .env as fallback
dotenv.config({ quiet: true });

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    // Important: this must come first so devtools source injection stays stable
    // between SSR + client builds (avoids hydration mismatches in dev).
    devtools(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
