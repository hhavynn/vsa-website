'use strict';

process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
require('react-scripts/config/env');
process.env.HOST ||= '127.0.0.1';

const fs = require('fs');
const configPath = require.resolve('react-scripts/config/webpackDevServer.config');
const createConfig = require(configPath);
const paths = require('react-scripts/config/paths');
const evalSourceMap = require('react-dev-utils/evalSourceMapMiddleware');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');
const noopServiceWorker = require('react-dev-utils/noopServiceWorkerMiddleware');
const DevServer = require('webpack-dev-server');
if (!DevServer.prototype.close) {
  DevServer.prototype.close = function close(callback = () => {}) {
    this.stopCallback(callback);
  };
}

// CRA 5 emits removed WDS 4 options. Adapt its config to the patched WDS 5
// without ejecting or changing the production build pipeline.
require.cache[configPath].exports = (proxy, allowedHost) => {
  const config = createConfig(proxy, allowedHost);
  const https = config.https;
  delete config.https;
  delete config.onBeforeSetupMiddleware;
  delete config.onAfterSetupMiddleware;
  if (!config.proxy) delete config.proxy;
  config.server = https ? { type: 'https', options: https === true ? {} : https } : 'http';
  config.host = process.env.HOST || '127.0.0.1';
  config.allowedHosts = 'auto';
  config.headers = {};
  config.devMiddleware.publicPath = paths.publicUrlOrPath;
  config.setupMiddlewares = (middlewares, server) => {
    const hostGuard = middlewares.findIndex(({ name }) => name === 'host-header-check');
    const originGuard = middlewares.findIndex(({ name }) => name === 'cross-origin-header-check');
    if (hostGuard < 0 || originGuard < 0) throw new Error('Development server security guards are missing');
    const guardedIndex = Math.max(hostGuard, originGuard) + 1;
    const sourceMap = evalSourceMap({ get _stats() { return server.stats; } });
    const craMiddlewares = [{
      name: 'cra-source-map',
      middleware(req, res, next) {
        if (!req.url.startsWith('/__get-internal-source')) return next();
        const id = typeof req.query.fileName === 'string'
          ? req.query.fileName.match(/^webpack-internal:\/\/\/(.+)$/)?.[1] : null;
        if (!id) return res.status(400).end('Invalid source request');
        const compilation = server.stats?.compilation;
        if (!compilation) return res.status(503).end('Compilation in progress');
        const sourceModule = Array.from(compilation.modules)
          .find((entry) => compilation.chunkGraph.getModuleId(entry) === id);
        if (!sourceModule?.originalSource()) return res.status(404).end('Source unavailable');
        return sourceMap(req, res, next);
      },
    }];
    if (fs.existsSync(paths.proxySetup)) {
      const router = require('express').Router();
      require(paths.proxySetup)(router);
      craMiddlewares.push({ name: 'cra-proxy', middleware: router });
    }
    return [
      ...middlewares.slice(0, guardedIndex),
      ...craMiddlewares,
      ...middlewares.slice(guardedIndex),
      { name: 'cra-served-path', middleware: redirectServedPath(paths.publicUrlOrPath) },
      { name: 'cra-service-worker', middleware: noopServiceWorker(paths.publicUrlOrPath) },
    ];
  };
  return config;
};

require('react-scripts/scripts/start');
