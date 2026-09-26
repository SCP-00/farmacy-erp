// ESLint — Farmacy backend (Express + TypeScript)
// Filosofía: reglas de CORRECCIÓN como error; estilo como warn (presupuesto
// de deuda visible) para no bloquear el desarrollo ni los CI.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.cjs'],
  rules: {
    // ── Errores (corrección) ─────────────────────────────
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'none', // catch (err) sin usar es común y legítimo aquí
    }],
    'no-useless-catch': 'error',
    'no-async-promise-executor': 'error',
    'no-cond-assign': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-func-assign': 'error',
    'no-irregular-whitespace': 'error',
    'no-unreachable': 'error',
    'no-unsafe-negation': 'error',
    'use-isnan': 'error',
    'require-atomic-updates': 'warn',

    // ── Presupuesto de deuda (warn) ──────────────────────
    // any explícito queda visible, no bloqueante: el objetivo es que el
    // número BAJE con el tiempo, no un big-bang imposible.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}
