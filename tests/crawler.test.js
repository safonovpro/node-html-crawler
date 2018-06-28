const fs =      require('fs');
const assert =  require('chai').assert;
const config =  require('./crawler.config');
const Crawler = require('../crawler');

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
                        assert(typeof result.links === 'object' && result.links.length === 1 && result.links[0].href === 'http://www.iana.org/domains/example');
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

    describe('Method _getUrlsOnHtml', () => {
        const html = fs.readFileSync(`${__dirname}/src/page-with-links.html`, 'utf-8');
        const links = crawler._getUrlsOnHtml('http://example.com/some/path', html);

        it(`Links from page ${__dirname}/src/page-with-links.html`, () => {
            assert(links.length === 3);
            assert(links[0].href === 'https://github.com/safonovpro/node-crawler-web-pages' && links[0].url === false );
            assert(links[1].href === '/other/path' && links[1].url === 'http://example.com/other/path' );
            assert(links[2].href === 'other/path' && links[2].url === 'http://example.com/some/other/path' );
        });
    });
});