import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Workspace paketleri (TS kaynak) pakete gömülür; node_modules bağımlılıkları dışarıda kalır.
const WORKSPACE = {
  '@glukoz/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  '@glukoz/metrics': fileURLToPath(new URL('../../packages/metrics/src/index.ts', import.meta.url)),
};

await build({
  entryPoints: ['src/server.ts', 'src/seed-mock.ts', 'src/snapshot.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  plugins: [
    {
      name: 'bundle-workspace',
      setup(b) {
        b.onResolve({ filter: /^@glukoz\/(shared|metrics)$/ }, (args) => ({
          path: WORKSPACE[args.path],
        }));
      },
    },
  ],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
process.stdout.write('api build ok\n');
