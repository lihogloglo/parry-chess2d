import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    base: '/parry-chess2d/',
    build: {
        outDir: 'docs',
        assetsDir: 'assets',
        sourcemap: true,
    },
    server: {
        port: 3000,
        open: true,
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/stockfish.js/stockfish.wasm',
                    dest: 'assets'
                },
                {
                    src: 'node_modules/stockfish.js/stockfish.wasm.js',
                    dest: 'assets'
                }
            ]
        })
    ],
    // Handle stockfish.js web worker
    optimizeDeps: {
        exclude: ['stockfish.js']
    }
});
