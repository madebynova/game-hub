import { defineConfig, type Plugin } from 'vite';

/**
 * Inlines the built JS and CSS into dist/index.html so the production build is a
 * single self-contained file.
 *
 * Why: the deployed game must work as a plain website (Netlify serves dist/), and
 * also survive being copied to a locked-down machine and opened straight off disk.
 * A single HTML file with no external requests does both. Disable with
 * `npm run build:multi` if assets ever grow large enough to make one file silly.
 */
function singleFile(): Plugin {
  return {
    name: 'runout:single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let js = '';
      let css = '';

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && fileName.endsWith('.js')) {
          js += output.code;
          delete bundle[fileName];
        } else if (output.type === 'asset' && fileName.endsWith('.css')) {
          css += typeof output.source === 'string' ? output.source : '';
          delete bundle[fileName];
        }
      }

      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;

      let source = typeof html.source === 'string' ? html.source : String(html.source);

      // Drop the tags pointing at the files we just absorbed.
      source = source
        .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>\s*/gi, '')
        .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>\s*/gi, '')
        .replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>\s*/gi, '');

      if (css) {
        source = source.replace(
          /<\/head>/i,
          () => `<style>${css}</style>\n</head>`,
        );
      }
      if (js) {
        // Escaped so a literal "</script>" inside the code cannot close the tag.
        const safe = js.replace(/<\/script>/gi, '<\/script>');
        source = source.replace(/<\/body>/i, () => `<script>${safe}</script>\n</body>`);
      }

      html.source = source;
    },
  };
}

export default defineConfig(({ mode }) => {
  const inlineEverything = mode !== 'multifile';

  return {
    // Relative asset URLs: the build works from any subpath, and from file://.
    base: './',
    plugins: inlineEverything ? [singleFile()] : [],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2022',
      cssCodeSplit: false,
      // Fold images/fonts into the bundle as data URIs when inlining.
      assetsInlineLimit: inlineEverything ? Number.MAX_SAFE_INTEGER : 4096,
      rollupOptions: {
        output: inlineEverything
          ? {
              // A classic script (no ES module) so file:// has nothing to fetch.
              format: 'iife',
              inlineDynamicImports: true,
            }
          : {},
      },
    },
    server: {
      open: true,
    },
  };
});
