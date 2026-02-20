import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        // VitePWA({
        //     registerType: 'autoUpdate',
        //     includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        //     manifest: {
        //         name: 'StatSea Network Monitor',
        //         short_name: 'StatSea',
        //         description: 'Advanced Network Monitoring Dashboard',
        //         theme_color: '#0f172a',
        //         background_color: '#0f172a',
        //         display: 'standalone',
        //         icons: [
        //             {
        //                 src: 'pwa-icon.svg',
        //                 sizes: '192x192 512x512',
        //                 type: 'image/svg+xml',
        //                 purpose: 'any maskable'
        //             }
        //         ]
        //     }
        // })
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8001',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        }
    }
})
