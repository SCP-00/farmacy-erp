import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  // CDN base path: configurable via VITE_CDN_URL (default / para desarrollo)
  base: process.env.VITE_CDN_URL || '/',

  plugins: [
    // Compresión Brotli en build de producción
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,       // Comprimir archivos > 1KB
      deleteOriginFile: false,
      filter: /\/\.(js|css|html|svg|json|xml|txt|ico|woff2)$/,
    }),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest: service worker custom con push notifications
      srcDir: '.',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'sitemap.xml',
        'offline.html',
        'icons/*.svg',
      ],
      manifest: {
        name: 'Farmacy — Tu farmacia digital',
        short_name: 'Farmacy',
        description: 'Catálogo de medicamentos INVIMA, suplementos y cuidado personal. Tu farmacia de confianza en Pereira.',
        theme_color: '#0F6E56',
        background_color: '#F5F8F6',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'es',
        categories: ['health', 'medical', 'pharmacy', 'shopping'],
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon.svg',     sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icons/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Buscar productos',
            short_name: 'Buscar',
            description: 'Busca medicamentos y productos',
            url: '/productos',
            icons: [{ src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
          },
          {
            name: 'Contacto',
            short_name: 'Contacto',
            description: 'Encuentra nuestras sucursales',
            url: '/sucursales',
            icons: [{ src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
          },
        ],
      },
      // injectManifest: self.__WB_MANIFEST se inyecta en sw.ts durante build
      // navigateFallback se maneja en el SW custom (sw.ts) para tener control total
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Vendor core (React + ReactDOM + Router)
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-router')) {
            return 'vendor-core'
          }
          // Helmet SEO (rara vez cambia)
          if (id.includes('react-helmet-async') ||
              id.includes('react-side-effect') ||
              id.includes('invariant') ||
              id.includes('shallowequal')) {
            return 'vendor-seo'
          }
          // React Query + Devtools
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query'
          }
          // Charts (recharts ocupa ~500KB)
          if (id.includes('recharts') ||
              id.includes('d3-')) {
            return 'vendor-charts'
          }
          // UI icons
          if (id.includes('lucide-react')) {
            return 'vendor-ui'
          }
          // Toast notifications
          if (id.includes('react-hot-toast') ||
              id.includes('goober')) {
            return 'vendor-toast'
          }
          // Zustand state management
          if (id.includes('zustand') ||
              id.includes('use-sync-external-store')) {
            return 'vendor-state'
          }
        },
      },
    },
  },
})
