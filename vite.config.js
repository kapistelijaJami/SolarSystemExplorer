import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  base: './',
  resolve: {
    alias: {
	  '@': path.resolve(__dirname, 'src') //or do {'@': '/src'}, but it might not work everywhere
	}
  }
});