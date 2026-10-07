import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function suppressViteHmrPlugin(): Plugin {
  return {
    name: 'suppress-vite-hmr-noise',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: `
(function() {
  try {
    var origDefine = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
      if (obj === window && prop === 'ethereum') {
        try {
          return origDefine.call(Object, obj, prop, Object.assign({}, descriptor, { configurable: true }));
        } catch (_) {
          try {
            if (descriptor && 'value' in descriptor) {
              window.ethereum = descriptor.value;
            }
          } catch (__) {}
          return obj;
        }
      }
      return origDefine.apply(Object, arguments);
    };
  } catch (_) {}

  function isFiltered(args) {
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      var str = typeof a === 'string' ? a : ((a && (a.message || a.stack || String(a))) || '');
      if (
        str.indexOf('[vite]') !== -1 ||
        str.indexOf('[hmr]') !== -1 ||
        str.indexOf('WebSocket') !== -1 ||
        str.indexOf('ws://') !== -1 ||
        str.indexOf('wss://') !== -1 ||
        str.indexOf('vite-hmr') !== -1 ||
        str.indexOf('24678') !== -1
      ) {
        return true;
      }
    }
    return false;
  }

  var origErr = console.error;
  console.error = function() {
    if (isFiltered(arguments)) return;
    return origErr.apply(console, arguments);
  };

  var origWarn = console.warn;
  console.warn = function() {
    if (isFiltered(arguments)) return;
    return origWarn.apply(console, arguments);
  };

  var origInfo = console.info;
  console.info = function() {
    if (isFiltered(arguments)) return;
    return origInfo.apply(console, arguments);
  };

  var origDebug = console.debug;
  console.debug = function() {
    if (isFiltered(arguments)) return;
    return origDebug.apply(console, arguments);
  };

  var origLog = console.log;
  console.log = function() {
    if (isFiltered(arguments)) return;
    return origLog.apply(console, arguments);
  };

  window.addEventListener('error', function(e) {
    var msg = (e && (e.message || e.filename || (e.error && (e.error.message || e.error.stack)))) ? String(e.message || e.filename || e.error.message) : '';
    if (
      msg.indexOf('[vite]') !== -1 ||
      msg.indexOf('[hmr]') !== -1 ||
      msg.indexOf('WebSocket') !== -1 ||
      msg.indexOf('vite-hmr') !== -1 ||
      msg.indexOf('ethereum') !== -1
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    var reason = e && e.reason ? String(e.reason.message || e.reason.stack || e.reason) : '';
    if (
      reason.indexOf('[vite]') !== -1 ||
      reason.indexOf('[hmr]') !== -1 ||
      reason.indexOf('WebSocket') !== -1 ||
      reason.indexOf('vite-hmr') !== -1
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);

  if (typeof window !== 'undefined' && window.WebSocket) {
    var OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      var u = String(url || '');
      if (u.indexOf('24678') !== -1 || protocols === 'vite-hmr' || u.indexOf('token=') !== -1) {
        return {
          url: u,
          readyState: 3,
          bufferedAmount: 0,
          extensions: '',
          protocol: '',
          binaryType: 'blob',
          onopen: null,
          onclose: null,
          onerror: null,
          onmessage: null,
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return false; },
          send: function() {},
          close: function() {},
        };
      }
      return new OrigWS(url, protocols);
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.WebSocket.CONNECTING = OrigWS.CONNECTING;
    window.WebSocket.OPEN = OrigWS.OPEN;
    window.WebSocket.CLOSING = OrigWS.CLOSING;
    window.WebSocket.CLOSED = OrigWS.CLOSED;
  }
})();
            `,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      suppressViteHmrPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'GamblePause Client Management & Assessment System',
          short_name: 'GamblePause',
          description: 'Client management and offline-capable assessment tracking system for GamblePause Initiative Africa.',
          theme_color: '#DC2626',
          background_color: '#F8F9FA',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['medical', 'health', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Cache assessment forms and clinical workflows for offline access by counsellors & clients
              urlPattern: /\/api\/(forms|workflows).*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'gamblepause-forms-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Dynamic client and case data cache with network-first priority
              urlPattern: /\/api\/(clients|staff|submissions|case-notes).*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gamblepause-data-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
