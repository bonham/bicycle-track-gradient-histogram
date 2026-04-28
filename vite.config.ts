import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'
import alias from '@rollup/plugin-alias'

const projectRootDir = resolve(__dirname);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    alias(),
    vue(),
    vueDevTools(),
  ],
  server: {
    port: 4000,
    host: true
  },
  resolve: {
    alias: {
      '@': resolve(projectRootDir, 'src'),
      '@gradhist/elevation-cursor-sync': resolve(projectRootDir, 'packages/elevation-cursor-sync/src/index.ts'),
      '@gradhist/elevation-chart': resolve(projectRootDir, 'packages/elevation-chart/src/index.ts'),
      '@gradhist/track-map-utils': resolve(projectRootDir, 'packages/track-map-utils/src/index.ts'),
      '~bootstrap': resolve(__dirname, 'node_modules/bootstrap'),
      '~bootstrap-icons': resolve(__dirname, 'node_modules/bootstrap-icons')
    }
  },



  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          'import',
          'mixed-decls',
          'color-functions',
          'global-builtin',
        ],
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ol: ['ol'],
          vue: ['vue'],
          'chart.js': ['chart.js'],
          '@garmin/fitsdk': ['@garmin/fitsdk'],
          readDroppedFile: ['@/lib/fileReader/readDroppedFile'],
        }
      },
      external: [
        'src/__tests__',
      ],

    }
  }
})
