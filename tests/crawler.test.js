const assert =  require('chai').assert;
const config =  require('./crawler.config');
const Crawler = require('../classes/crawler');

const crawler = new Crawler();

describe('Class Crawler', () => {
    describe('Method _getDataByURL', () => {
        for(let protocol of ['http', 'https']) {
            const url = `${protocol}://example.com/`;

            it(`Method GET, URL is ${url}`, () => {
                return crawler._getDataByUrl(url, 'GET')
                    .then(result => {
                        assert(typeof result.requestMethod === 'string' && result.requestMethod === 'GET');
                        assert(typeof result.statusCode === 'number' && result.statusCode === 200);
                        assert(typeof result.headers === 'object' && result.headers['content-type'] === 'text/html');
                        assert(typeof result.body === 'string' && result.body.length > 0);
                        assert(typeof result.links === 'object' && result.links.length === 1 && result.links[0] === 'http://www.iana.org/domains/example');
                    });
            });
        }

        it(`Method HEAD, URL is http://yandex.ru/`, () => {
            return crawler._getDataByUrl('http://yandex.ru/')
                .then(result => {
                    assert(typeof result.requestMethod === 'string' && result.requestMethod === 'HEAD');
                    assert(typeof result.statusCode === 'number' && /30\d/.test(result.statusCode));
                    assert(typeof result.headers === 'object' && result.headers['location'] === 'https://yandex.ru/');
                    assert(typeof result.body === 'string' && result.body.length === 0);
                });
        });
    });

    describe('Method _isInterestingUrl', () => {
        const conditions = config['_isInterestingUrl'];

        for(let url in conditions) {
            if(conditions.hasOwnProperty(url)) {
                it(`${url} an internal and not only hash?`, () => {
                    assert(crawler._isInterestingUrl(url) === conditions[url]);
                });
            }
        }
    });

    describe('Method _getInterestingFullUrlWithoutAuthAndHash', () => {
        const conditions = config['_getInterestingFullUrlWithoutAuthAndHash'];

        for(let condition of conditions) {
            it(`Full url from ${condition.in.urlString}`, () => {
                assert(crawler._getInterestingFullUrlWithoutAuthAndHash(condition.in.urlString, condition.in.parentUrl, condition.in.parentTagBaseHrefValue) === condition.out);
            });
        }
    });
});