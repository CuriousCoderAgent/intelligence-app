import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { deckPlugin } from './scripts/lib/vite-deck.mjs'

// `base: './'` keeps every asset path relative, so the build works at a domain
// root (Vercel, Netlify) and under a sub-path (GitHub Pages) without changes.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    deckPlugin(),
    react(),
    // "single" mode is a plain build without the service worker, for previews.
    mode !== 'single' &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Lumen',
          short_name: 'Lumen',
          description: 'One idea per swipe. Facts worth your scroll.',
          theme_color: '#0e0f33',
          background_color: '#0e0f33',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // The app, fonts and every card pack are precached, so the whole deck
          // reads offline. Packs are small hashed files, so a deploy that adds
          // cards only downloads the new packs. Card images are cached as they
          // are viewed so a large image library does not bloat the install.
          globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
          runtimeCaching: [
            {
              urlPattern: /\.(?:webp|avif|jpe?g)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'card-images',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
              },
            },
          ],
        },
      }),
  ],
}))
