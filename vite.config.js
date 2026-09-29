import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    open: true
  },
  build: {
    outDir: 'dist',
    // three.js はアプリ本体より大きい依存のため、独立チャンクに分離して
    // アプリ側の修正だけの再デプロイ時にキャッシュを維持する
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 100 }
          ]
        }
      }
    },
    // three は単体で 500kB を超えるため、閾値を上げて実質的な警告だけ残す
    chunkSizeWarningLimit: 700
  }
});
