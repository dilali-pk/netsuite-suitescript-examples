/**
 * Name:        Order Intake Client
 * Purpose:     The outside half of the order intake integration: a channel
 *              system posting an order to the DA Order Intake RESTlet with
 *              Token Based Authentication (OAuth 1.0, HMAC-SHA256).
 * Runtime:     Node 18 or later. No dependencies: signing uses node:crypto.
 * Config:      Environment variables NS_ACCOUNT, NS_CONSUMER_KEY,
 *              NS_CONSUMER_SECRET, NS_TOKEN_ID, NS_TOKEN_SECRET, NS_SCRIPT,
 *              NS_DEPLOY. Secrets never live in code.
 * @author      Dilshad Ali
 */
'use strict';

const crypto = require('node:crypto');

// ----------------------------------------------------------------------
// OAUTH 1.0 SIGNING
// ----------------------------------------------------------------------

/** RFC 3986 encoding, stricter than encodeURIComponent. */
const rfc3986 = (value) =>
    encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Account 1234567_SB1 is host 1234567-sb1 and realm 1234567_SB1. */
const restletUrl = (account) =>
    `https://${account.toLowerCase().replace(/_/g, '-')}.restlets.api.netsuite.com/app/site/hosting/restlet.nl`;

const signatureBase = (method, baseUrl, params) => {
    const normalized = Object.keys(params)
        .sort()
        .map((key) => `${rfc3986(key)}=${rfc3986(params[key])}`)
        .join('&');
    return [method.toUpperCase(), rfc3986(baseUrl), rfc3986(normalized)].join('&');
};

/**
 * Builds the Authorization header for one request. nonce and timestamp
 * can be passed in so the signature is reproducible in tests.
 */
const authorizationHeader = ({ method, baseUrl, query, creds, nonce, timestamp }) => {
    const oauth = {
        oauth_consumer_key: creds.consumerKey,
        oauth_nonce: nonce || crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
        oauth_token: creds.tokenId,
        oauth_version: '1.0',
    };
    const key = `${rfc3986(creds.consumerSecret)}&${rfc3986(creds.tokenSecret)}`;
    const base = signatureBase(method, baseUrl, { ...query, ...oauth });
    const signature = crypto.createHmac('sha256', key).update(base).digest('base64');

    const fields = { realm: creds.account.toUpperCase(), ...oauth, oauth_signature: signature };
    return 'OAuth ' + Object.entries(fields).map(([k, v]) => `${k}="${rfc3986(v)}"`).join(', ');
};

// ----------------------------------------------------------------------
// CLIENT
// ----------------------------------------------------------------------

const postOrder = async (order, env = process.env) => {
    const creds = {
        account: env.NS_ACCOUNT,
        consumerKey: env.NS_CONSUMER_KEY,
        consumerSecret: env.NS_CONSUMER_SECRET,
        tokenId: env.NS_TOKEN_ID,
        tokenSecret: env.NS_TOKEN_SECRET,
    };
    const query = { script: env.NS_SCRIPT, deploy: env.NS_DEPLOY };
    const baseUrl = restletUrl(creds.account);

    const response = await fetch(`${baseUrl}?${new URLSearchParams(query)}`, {
        method: 'POST',
        headers: {
            Authorization: authorizationHeader({ method: 'POST', baseUrl, query, creds }),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
    return body;
};

if (require.main === module) {
    postOrder({
        externalId: `WEB-${Date.now()}`,
        customerExternalId: 'WEB-CUST-1001',
        memo: 'Sample order from the intake client',
        lines: [
            { sku: 'SKU-100', quantity: 2, rate: 49.5 },
            { sku: 'SKU-200', quantity: 1 },
        ],
    })
        .then((result) => console.log(result))
        .catch((error) => {
            console.error(error.message);
            process.exitCode = 1;
        });
}

module.exports = { rfc3986, restletUrl, signatureBase, authorizationHeader, postOrder };
