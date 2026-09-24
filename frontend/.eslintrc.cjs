// ESLint — Farmacy frontend (React 19 + Vite + TS)
// Misma filosofía que el backend: corrección = error, estilo/typed-lint = warn.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'dev-dist/', '*.cjs'],
  rules: {
    // ── Errores (corrección) ─────────────────────────────
    'react-hooks/rules-of-hooks': 'error', // crítico en React
    'react-hooks/exhaustive-deps': 'warn', // deps de hooks: warn (muy ruidoso como error en código legado)
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'none',
    }],
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'use-isnan': 'error',

    // ── Presupuesto de deuda (warn) ──────────────────────
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}
