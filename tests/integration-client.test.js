'use strict';

const crypto = require('node:crypto');
const client = require('../integration/order_intake_client');

describe('Order intake client signing', () => {
    test('encodes the characters encodeURIComponent leaves alone', () => {
        expect(client.rfc3986("a b!*'()")).toBe('a%20b%21%2A%27%28%29');
    });

    test('derives the RESTlet host from a sandbox account id', () => {
        expect(client.restletUrl('1234567_SB1')).toBe(
            'https://1234567-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl'
        );
    });

    test('sorts parameters into the signature base string', () => {
        const base = client.signatureBase('post', 'https://x.test/r', { deploy: '1', a: 'b c' });
        expect(base).toBe('POST&https%3A%2F%2Fx.test%2Fr&a%3Db%2520c%26deploy%3D1');
    });

    test('signs with consumer and token secrets as an HMAC-SHA256 key', () => {
        const creds = { account: '1234567_sb1', consumerKey: 'ck', consumerSecret: 'cs', tokenId: 'ti', tokenSecret: 'ts' };
        const baseUrl = 'https://1234567-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl';
        const query = { script: '10', deploy: '1' };
        const header = client.authorizationHeader({ method: 'POST', baseUrl, query, creds, nonce: 'n1', timestamp: 1700000000 });

        const expected = crypto
            .createHmac('sha256', 'cs&ts')
            .update(
                client.signatureBase('POST', baseUrl, {
                    ...query,
                    oauth_consumer_key: 'ck',
                    oauth_nonce: 'n1',
                    oauth_signature_method: 'HMAC-SHA256',
                    oauth_timestamp: '1700000000',
                    oauth_token: 'ti',
                    oauth_version: '1.0',
                })
            )
            .digest('base64');

        expect(header.startsWith('OAuth realm="1234567_SB1"')).toBe(true);
        expect(header).toContain(`oauth_signature="${client.rfc3986(expected)}"`);
    });
});
