import * as esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { join, sep } from 'path';

// Config output
const BUILD_DIRECTORY = 'dist';
const PRODUCTION = process.env.NODE_ENV === 'production';

// Config entrypoint files
const ENTRY_POINTS = ['src/index.ts'];
const WIDGET_ENTRY = 'src/widget.ts';

// Config dev serving
const LIVE_RELOAD = !PRODUCTION;
const SERVE_PORT = 3000;
const SERVE_ORIGIN = `http://localhost:${SERVE_PORT}`;

// Build widget bundle (for CDN)
const widgetContext = await esbuild.context({
  bundle: true,
  entryPoints: [WIDGET_ENTRY],
  outfile: `${BUILD_DIRECTORY}/shipnetwork-zone-map.js`,
  minify: PRODUCTION,
  sourcemap: PRODUCTION ? false : 'inline',
  target: 'es2020',
  format: 'iife',
  globalName: 'ShipNetworkZoneMap',
  external: [], // Bundle everything
  define: {
    'process.env.NODE_ENV': JSON.stringify(PRODUCTION ? 'production' : 'development'),
  },
  loader: {
    '.css': 'text',
  },
});

// Build regular app
const context = await esbuild.context({
  bundle: true,
  entryPoints: ENTRY_POINTS,
  outdir: BUILD_DIRECTORY,
  minify: PRODUCTION,
  sourcemap: !PRODUCTION,
  target: PRODUCTION ? 'es2020' : 'esnext',
  inject: LIVE_RELOAD ? ['./bin/live-reload.js'] : undefined,
  define: {
    SERVE_ORIGIN: JSON.stringify(SERVE_ORIGIN),
  },
});

// Build files in prod
if (PRODUCTION) {
  await context.rebuild();
  await widgetContext.rebuild();
  context.dispose();
  widgetContext.dispose();
  console.log('✅ Production build complete!');
  console.log('📦 Widget bundle: dist/shipnetwork-zone-map.js');
}

// Watch and serve files in dev
else {
  await context.watch();
  await widgetContext.watch();
  await context
    .serve({
      servedir: BUILD_DIRECTORY,
      port: SERVE_PORT,
    })
    .then(logServedFiles);
  console.log('\n🔧 Widget bundle also building in watch mode...');
}

/**
 * Logs information about the files that are being served during local development.
 */
function logServedFiles() {
  /**
   * Recursively gets all files in a directory.
   * @param {string} dirPath
   * @returns {string[]} An array of file paths.
   */
  const getFiles = (dirPath) => {
    const files = readdirSync(dirPath, { withFileTypes: true }).map((dirent) => {
      const path = join(dirPath, dirent.name);
      return dirent.isDirectory() ? getFiles(path) : path;
    });

    return files.flat();
  };

  const files = getFiles(BUILD_DIRECTORY);

  const filesInfo = files
    .map((file) => {
      if (file.endsWith('.map')) return;

      // Normalize path and create file location
      const paths = file.split(sep);
      paths[0] = SERVE_ORIGIN;

      const location = paths.join('/');

      // Create import suggestion
      const tag = location.endsWith('.css')
        ? `<link href="${location}" rel="stylesheet" type="text/css"/>`
        : `<script defer src="${location}"></script>`;

      return {
        'File Location': location,
        'Import Suggestion': tag,
      };
    })
    .filter(Boolean);

  // eslint-disable-next-line no-console
  console.table(filesInfo);
}
