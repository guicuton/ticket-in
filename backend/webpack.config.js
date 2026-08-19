const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      additionalModuleDirs: [path.resolve(__dirname, '..', 'node_modules')],
    }),
  ],
});
