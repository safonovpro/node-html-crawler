const fs =      require('fs');
const assert =  require('chai').assert;
const config =  require('./crawler.config');
const Crawler = require('../crawler');

const firstCrawlerForTest = new Crawler();

describe('Class Crawler', () => {
    describe('Method constructor', () => {
        const domain = 'сафонов.pro';
        const domainInPunycode = 'xn--80ae6adbow.pro';
        const secondCrawlerForTest = new Crawler(domain);
        const settingsForTherdCrawler = {
            protocol: 'https:',
            domain,
            limitForConnections: 30,
            limitForRedirects: 5,
            timeout: 500
        };
        const thirdCrawlerForTest = new Crawler(settingsForTherdCrawler);

        it('Set domain by string, other setting by default', () => {
            assert(secondCrawlerForTest.config.domain === domainInPunycode, `Domain is ${secondCrawlerForTest.config.domain}, not ${domainInPunycode}`);
            // Default settings
            assert(secondCrawlerForTest.config.protocol === 'http:');
            assert(secondCrawlerForTest.config.limitForConnections === 10);
            assert(secondCrawlerForTest.config.limitForRedirects === 3);
            assert(secondCrawlerForTest.config.timeout === 100);
        });

        it('Costume settings', () => {
            assert(thirdCrawlerForTest.config.protocol === settingsForTherdCrawler.protocol);
            assert(thirdCrawlerForTest.config.domain === domainInPunycode,  `Domain is ${secondCrawlerForTest.config.domain}, not ${domainInPunycode}`);
            assert(thirdCrawlerForTest.config.limitForConnections === settingsForTherdCrawler.limitForConnections);
            assert(thirdCrawlerForTest.config.limitForRedirects === settingsForTherdCrawler.limitForRedirects);
            assert(thirdCrawlerForTest.config.timeout === settingsForTherdCrawler.timeout);
        });
    });

    describe('Method _getDataByURL', () => {
        for(let protocol of ['http', 'https']) {
            const url = `${protocol}://example.com/`;

            it(`Method GET, URL is ${url}`, () => {
                return firstCrawlerForTest._getDataByUrl(url, 'GET')
                    .then(result => {
                        assert(typeof result.requestMethod === 'string' && result.requestMethod === 'GET');
                        assert(typeof result.statusCode === 'number' && result.statusCode === 200);
                        assert(typeof result.headers === 'object' && /^text\/html/.test(result.headers['content-type']));
                        assert(typeof result.body === 'string' && result.body.length > 0);
                        assert(typeof result.links === 'object' && result.links.length === 1 && result.links[0].href === 'http://www.iana.org/domains/example');
                    });
            });
        }

        it(`Method HEAD, URL is http://yandex.ru/`, () => {
            return firstCrawlerForTest._getDataByUrl('http://yandex.ru/')
                .then(result => {
                    assert(typeof result.requestMethod === 'string' && result.requestMethod === 'HEAD');
                    assert(typeof result.statusCode === 'number' && /30\d/.test(result.statusCode));
                    assert(typeof result.headers === 'object' && result.headers['location'] === 'https://yandex.ru/');
                    assert(typeof result.body === 'string' && result.body.length === 0);
                });
        });
    });

    describe('Method _getInterestingFullUrl', () => {
        const conditions = config['_getInterestingFullUrl'];

        for(let condition of conditions) {
            it(`Full url from ${condition.in.urlString}`, () => {
                assert(firstCrawlerForTest._getInterestingFullUrl(condition.in.urlString, condition.in.parentUrl, condition.in.parentTagBaseHrefValue) === condition.out);
            });
        }
    });

    describe('Method _isInterestingUrl', () => {
        const conditions = config['_isInterestingUrl'];

        for(let url in conditions) {
            if(conditions.hasOwnProperty(url)) {
                it(`${url} an internal and not only hash?`, () => {
                    assert(firstCrawlerForTest._isInterestingUrl(url) === conditions[url]);
                });
            }
        }
    });

    describe('Method _removeDotsInUrl', () => {
        const conditions = config['_removeDotsInUrl'];

        for(let url in conditions) {
            it(`${url} without sots is ${conditions[url]}`, () => {
                assert(firstCrawlerForTest._removeDotsInUrl(url) === conditions[url]);
            });
        }
    });

    describe('Method _smartDecodeUrl', () => {
        const conditions = config['_smartDecodeUrl'];

        for(let url in conditions) {
            it(`${url} after decode is ${conditions[url]}`, () => {
                assert(firstCrawlerForTest._smartDecodeUrl(url) === conditions[url], `Incoming: ${firstCrawlerForTest._smartDecodeUrl(url)}`);
            });
        }
    });

    describe('Method _removeDotsInUrl', () => {
        const conditions = config['_removeDotsInUrl'];

        for(let url in conditions) {
            it(`${url} without sots is ${conditions[url]}`, () => {
                assert(firstCrawlerForTest._removeDotsInUrl(url) === conditions[url]);
            });
        }
    });

    describe('Method _getUrlsOnHtml', () => {
        const html = fs.readFileSync(`${__dirname}/src/page-with-links.html`, 'utf-8');
        const links = firstCrawlerForTest._getUrlsOnHtml('http://example.com/some/path', html);
        const htmlWithTagBase = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
        const linksWithTagBase = firstCrawlerForTest._getUrlsOnHtml('http://example.com/some/path', htmlWithTagBase);

        it(`Links from page ${__dirname}/src/page-with-links.html`, () => {
            assert(links.length === 3);
            assert(links[0].href === 'https://github.com/safonovpro/node-html-crawler' && links[0].url === false );
            assert(links[1].href === '/other/path' && links[1].url === 'http://example.com/other/path');
            assert(links[2].href === 'other/path' && links[2].url === 'http://example.com/some/other/path');
        });

        it(`Links from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
            assert(linksWithTagBase.length === 3);
            assert(linksWithTagBase[0].href === 'https://github.com/safonovpro/node-html-crawler' && linksWithTagBase[0].url === false);
            assert(linksWithTagBase[1].href === '/other/path' && linksWithTagBase[1].url === 'https://example.com/other/path');
            assert(linksWithTagBase[2].href === 'other/path' && linksWithTagBase[2].url === 'https://example.com/other/path');
            assert(linksWithTagBase[3] === undefined);
        });
    });

    describe('Method _getTagAttrs', () => {
        const html = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
        const tagBaseAttrs = firstCrawlerForTest._getTagAttrs('base', html);
        const tagAAttrs = firstCrawlerForTest._getTagAttrs('a', html);

        it(`Check attrs tag base from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
            assert(tagBaseAttrs.length === 1);
            assert(tagBaseAttrs[0].href === 'https://example.com/');
        });

        it(`Check attrs tag a from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
            assert(tagAAttrs.length === 4);
            assert(tagAAttrs[0].href === 'https://github.com/safonovpro/node-html-crawler');
            assert(tagAAttrs[1].href === '/other/path');
            assert(tagAAttrs[2].href === 'other/path');
            assert(tagAAttrs[3].href === undefined);
        });
    });

    describe('Method _generateEvents', () => {
        const countOfLinks = 3;
        let results = [];
        let isEnded = false;

        for (let i = 0; i < countOfLinks; i++) {
            firstCrawlerForTest.foundLinks.add(`link-${i}`);
        }

        firstCrawlerForTest.on('data', data => results.push(data));
        firstCrawlerForTest.on('end', () => isEnded = true);

        for (let i = 0; i < countOfLinks; i++) {
            firstCrawlerForTest._generateEvents('data', {currentUrl: `current-url-${i}`, result: `result-${i}`});
        }

        it('Events "data"', () => {
            assert(results.length === countOfLinks);

            for(let i = 0; i < countOfLinks; i++) {
                assert(results[i].url === `current-url-${i}` && results[i].result === `result-${i}`);
            }
        });

        it('Events "end"', () => {
            assert(isEnded);
        });
    });
});