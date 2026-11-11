'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/**'] },
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser, define: 'readonly' },
        },
    },
    {
        files: ['commerce/**/*.js'],
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'script',
            globals: { ...globals.browser, define: 'readonly' },
        },
    },
    {
        files: ['integration/**/*.js', 'tests/**/*.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...globals.jest },
        },
    },
];
