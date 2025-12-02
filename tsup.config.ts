import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'agents/index': 'src/agents/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: [
    '@solana/web3.js',
    '@coral-xyz/anchor',
  ],
  banner: {
    js: `/**
 * @aegis/sdk - TypeScript SDK for Aegis Protocol
 * @license MIT
 */`,
  },
});
