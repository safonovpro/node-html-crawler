const assert =  require('chai').assert;
const Crawler = require('../classes/crawler');

const crawler = new Crawler();

describe('Class Crawler', () => {
    describe('Method _getDataByURL', () => {
        for(let protocol of ['http', 'https']) {
            const url = `${protocol}://example.com/`;

            it(`Method GET, URL is ${url}`, () => {
                return crawler._getDataByUrl(url)
                    .then(result => {
                        assert(typeof result.statusCode === 'number' && result.statusCode === 200);
                        assert(typeof result.headers === 'object' && result.headers['content-type'] === 'text/html');
                        assert(typeof result.body === 'string' && result.body.length > 0);
                    });
            });
        }

        it(`Method HEAD, URL is http://yandex.ru/`, () => {
            return crawler._getDataByUrl('http://yandex.ru/')
                .then(result => {
                    assert(typeof result.statusCode === 'number' && /30\d/.test(result.statusCode));
                    assert(typeof result.headers === 'object' && result.headers['location'] === 'https://yandex.ru/');
                    assert(typeof result.body === 'string' && result.body.length === 0);
                });
        });
    });

    describe('Method _isInternalUrlAndNotOnlyHash', () => {
        const urls = {
            'http://example.com' : true,
            'https://www.example.com/some/path' : true,
            '//www.example.com/some/path' : true,
            '/some/path': true,
            'some/path': true,
            'http://safonov.pro' : false,
            'https://www.safonov.pro/some/path' : false,
            '//www.safonov.pro/some/path' : false,
            'mailto:alexey@safonov.pro': false,
            'tg://resolve?domain=safonovpro': false,
            'viber://chat?number=+79213126942': false,
            '#garget': false
        };

        for(let url in urls) {
            it(`${url} an internal and not only hash?`, () => {
                assert(crawler._isInternalUrlAndNotOnlyHash(url) === urls[url]);
            });
        }
    });
});