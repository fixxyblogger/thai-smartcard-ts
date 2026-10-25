import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    platform: 'neutral',
    fixedExtension: true,
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { pcsc: 'src/pcsc/index.ts' },
    format: ['esm', 'cjs'],
    platform: 'node',
    target: 'node20',
    deps: {
      neverBundle: ['pcsc-mini'],
    },
    fixedExtension: true,
    dts: true,
    sourcemap: true,
    clean: false,
  },
]);
