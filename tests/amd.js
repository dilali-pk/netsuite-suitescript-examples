/**
 * Loads a SuiteScript AMD module in Node with the N/ modules it asks for
 * replaced by the mocks a test passes in. Relative dependencies load the
 * same way, so a script and its library are tested together.
 * @author Dilshad Ali
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const loadAmd = (file, mocks = {}) => {
    const absolute = path.resolve(ROOT, file);
    const source = fs.readFileSync(absolute, 'utf8');
    let exported;

    const define = (deps, factory) => {
        const resolved = deps.map((dep) => {
            if (dep in mocks) return mocks[dep];
            if (dep.startsWith('./')) return loadAmd(path.join(path.dirname(absolute), `${dep}.js`), mocks);
            return {};
        });
        exported = factory(...resolved);
    };

    new Function('define', source)(define);
    return exported;
};

/** A minimal N/query whose rows come from a handler(sql, params). */
const queryMock = (handler) => ({
    runSuiteQL: jest.fn(({ query, params }) => ({ asMappedResults: () => handler(query, params || []) })),
});

module.exports = { loadAmd, queryMock };
