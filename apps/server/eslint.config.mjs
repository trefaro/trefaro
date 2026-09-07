import baseConfig from '../../eslint.config.mjs';

/**
 * Strict layering, enforced by the linter.
 *
 * Nx's module boundaries work between projects; the server's layers live inside
 * one project, so they are enforced here instead. Without a mechanical check,
 * "only the data access layer talks to the database" degrades into a comment —
 * and the promise that the database can be swapped by replacing one layer is
 * worth exactly as much as the rule that keeps it true.
 */

/** Importing any of these means the file knows about the database. */
const ormMessage =
  'The business layer must not know the ORM. Declare a repository port next to the module and let the data access layer implement it.';

const persistencePackages = [
  { name: 'typeorm', message: ormMessage },
  { name: '@nestjs/typeorm', message: ormMessage },
  {
    name: 'pg',
    message:
      'The business layer must not know the database driver. Go through a repository port.',
  },
];

const businessLayerRules = {
  'no-restricted-imports': [
    'error',
    {
      paths: persistencePackages,
      patterns: [
        {
          group: ['**/data-access', '**/data-access/**'],
          message:
            'The business layer must not reach into the data access layer. Depend on a port; the composition root binds the implementation.',
        },
      ],
    },
  ],
};

export default [
  ...baseConfig,
  {
    // Core business layer.
    files: ['src/app/business/**/*.ts'],
    rules: businessLayerRules,
  },
  {
    // A plug-in mirrors the same layering internally, and the reference plug-in
    // has to hold to it — phase 4 plug-ins are copied from it.
    files: ['src/plugins/*/business/**/*.ts'],
    rules: businessLayerRules,
  },
  {
    // "A plug-in imports from `plugin-api` and from nowhere else inside the
    // server" was a sentence in the contract's docstring until AP 2 of phase 4,
    // and the reference plug-in's own controller was already reaching past it
    // for the enabled guard. Now the linter says it, and the answer to the
    // violation was a port rather than an exception: the guard moved into
    // `plugin-api` and asks the manager through `PLUGIN_ENABLED`.
    //
    // A regex over the import path rather than negated globs, for the reason
    // the data access layer's rule gives: ESLint's glob negation does not
    // apply to relative paths starting with `..`.
    files: ['src/plugins/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '/app/(?!business/plugin-api)',
              message:
                'A plug-in may only import the host through `app/business/plugin-api`. If it needs something else, the contract gets a port — and that port is a versioned change to the contract.',
            },
          ],
        },
      ],
    },
  },
  {
    // The data access layer implements the business layer's ports and reads the
    // plug-in contract; it must not reach for a business service or a barrel.
    // Expressed as a regex rather than negated globs, because ESLint's glob
    // negation does not apply to relative paths starting with `..`.
    files: ['src/app/data-access/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '/business/(?!plugin-api)(?!.*/ports/)',
              message:
                "The data access layer may only depend on the business layer's ports and on the plug-in contract, not on its services.",
            },
          ],
        },
      ],
    },
  },
];
