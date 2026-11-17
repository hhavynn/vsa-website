import path from 'node:path';
import { Config } from '@remotion/cli/config';

// H.264 MP4, 1080p30, high quality. Rendering is local only.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(18);
Config.setConcurrency(null);

// The shared stage lives in ../../src (the website). Make every import of
// React resolve to this project's copy so hooks share one React instance.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
    },
  },
}));
