import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    pcsc: 'src/pcsc/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node20',
  deps: {
    neverBundle: ['pcsc-mini'],
  },
  dts: true,
  sourcemap: true,
  clean: true,
});
