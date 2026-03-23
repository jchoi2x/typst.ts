import { defineConfig } from 'vite';
import { TypstPlugin } from '@jchoi2x/vite-plugin-typst';

export default defineConfig({
  plugins: [TypstPlugin({compiler: 'typst-cli'})],
});
