// This script must be loaded after SystemJS and Babel Standalone.
// It hooks into SystemJS to transpile .ts and .tsx files on the fly.

declare var System: any;
declare var Babel: any;

(function () {
  if (typeof System === 'undefined' || typeof Babel === 'undefined') {
    console.error('SystemJS or Babel Standalone not found. Ensure they are loaded before this script.');
    return;
  }

  const systemInstantiate = System.constructor.prototype.instantiate;

  System.constructor.prototype.instantiate = function (url: string, parent: string) {
    // Only transpile local .ts/.tsx files, not CDN modules
    if ((url.endsWith('.ts') || url.endsWith('.tsx')) && !url.includes('aistudiocdn.com')) {
      return fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.statusText}`);
          }
          return response.text();
        })
        .then(source => {
          // console.log(`Transpiling: ${url}`);
          const isTSX = url.endsWith('.tsx');
          const presets = ['typescript', 'react'];

          // Babel.transform options
          // Fix: Removed inaccessible type `Babel.TransformOptions` and use `any`.
          const transformOptions: any = { 
            presets: presets,
            filename: url, // Crucial for Babel to correctly identify file type
            sourceMaps: 'inline', // Embed source maps for debugging
            // For SystemJS, modules usually need to be transformed to System.register format
            // However, since we're using import maps for external modules,
            // we can aim for ESM directly and let SystemJS handle it.
            // If issues arise, a specific 'systemjs' plugin/preset might be needed.
            // For simplicity and common use, directly outputting ESM is usually fine with SystemJS.
          };

          const transformed = Babel.transform(source, transformOptions);
          
          // Return the transformed code as a JavaScript module
          return systemInstantiate.call(this, 'data:text/javascript;base64,' + btoa(transformed.code || ''), parent);
        })
        .catch(error => {
          console.error(`Error transpiling ${url}:`, error);
          throw error;
        });
    }

    // For other files (e.g., .js, or already transpiled modules), use the default instantiate
    return systemInstantiate.call(this, url, parent);
  };
})();