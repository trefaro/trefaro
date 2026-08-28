const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/server'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        // The shipped translation catalogues (E22). Copied rather than
        // imported: the server compiles against `@trefaro/shared-models` and
        // nothing else shared, and client text is not a contract layer. The
        // three places this path lives are here, `I18N_CATALOGUE_DIR` in
        // `env.ts`, and the `COPY` in `infra/docker/server.Dockerfile` - a
        // missing one of the three is an instance whose interface renders keys.
        {
          input: '../../libs/shared-i18n/catalogues',
          glob: '*.json',
          output: 'assets/i18n',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
