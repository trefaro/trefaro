import nx from '@nx/eslint-plugin';

/**
 * Workspace lint configuration.
 *
 * The module boundaries below encode two architecture rules: the two clients are
 * separate applications that share libraries but never each other's code, and
 * shared libraries stay independent of any application. The server's *internal*
 * layering is enforced in `apps/server/eslint.config.mjs`, because it lives
 * inside a single project and Nx boundaries only work between projects.
 */
export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Each application may use shared libraries and nothing from a
            // sibling application. The participant client is mobile-first and
            // the organizer client desktop-first; letting one import the other
            // would quietly merge them back into a single app.
            {
              sourceTag: 'scope:user-client',
              onlyDependOnLibsWithTags: ['scope:user-client', 'scope:shared'],
            },
            {
              sourceTag: 'scope:admin-client',
              onlyDependOnLibsWithTags: ['scope:admin-client', 'scope:shared'],
            },
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: ['scope:server', 'scope:shared'],
            },
            // Shared libraries must stay usable by both clients and the server,
            // so they may never depend on an application.
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // Models are the common vocabulary: they may not pull in Angular or
            // NestJS through a feature library.
            {
              sourceTag: 'type:models',
              onlyDependOnLibsWithTags: ['type:models'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
