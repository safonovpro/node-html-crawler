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

  describe('Method getDataByUrl', () => {
    for(let protocol of ['http', 'https']) {
      const url = `${protocol}://example.com/`;

      it(`Method GET, URL is ${url}`, () => {
        return firstCrawlerForTest.getDataByUrl(url, 'GET')
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
      return firstCrawlerForTest.getDataByUrl('http://yandex.ru/')
        .then(result => {
          assert(typeof result.requestMethod === 'string' && result.requestMethod === 'HEAD');
          assert(typeof result.statusCode === 'number' && /30\d/.test(result.statusCode));
          assert(typeof result.headers === 'object' && result.headers['location'] === 'https://yandex.ru/');
          assert(typeof result.body === 'string' && result.body.length === 0);
        });
    });
  });

  describe('Method getInterestingFullUrl', () => {
    const conditions = config['getInterestingFullUrl'];

    for(let condition of conditions) {
      it(`Full url from ${condition.in.urlString}`, () => {
        assert(firstCrawlerForTest.getInterestingFullUrl(condition.in.urlString, condition.in.parentUrl, condition.in.parentTagBaseHrefValue) === condition.out);
      });
    }
  });

  describe('Method isInterestingUrl', () => {
    const conditions = config['isInterestingUrl'];

    for(let url in conditions) {
      if(conditions.hasOwnProperty(url)) {
        it(`${url} an internal and not only hash?`, () => {
          assert(firstCrawlerForTest.isInterestingUrl(url) === conditions[url]);
        });
      }
    }
  });

  describe('Method removeDotsInUrl', () => {
    const conditions = config['removeDotsInUrl'];

    for(let url in conditions) {
      it(`${url} without sots is ${conditions[url]}`, () => {
        assert(Crawler.removeDotsInUrl(url) === conditions[url]);
      });
    }
  });

  describe('Method smartDecodeUrl', () => {
    const conditions = config['smartDecodeUrl'];

    for(let url in conditions) {
      it(`${url} after decode is ${conditions[url]}`, () => {
        assert(Crawler.smartDecodeUrl(url) === conditions[url], `Incoming: ${Crawler.smartDecodeUrl(url)}`);
      });
    }
  });

  describe('Method removeDotsInUrl', () => {
    const conditions = config['removeDotsInUrl'];

    for(let url in conditions) {
      it(`${url} without sots is ${conditions[url]}`, () => {
        assert(Crawler.removeDotsInUrl(url) === conditions[url]);
      });
    }
  });

  describe('Method getUrlsOnHtml', () => {
    const html = fs.readFileSync(`${__dirname}/src/page-with-links.html`, 'utf-8');
    const links = firstCrawlerForTest.getUrlsOnHtml('http://example.com/some/path', html);
    const htmlWithTagBase = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
    const linksWithTagBase = firstCrawlerForTest.getUrlsOnHtml('http://example.com/some/path', htmlWithTagBase);

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
      assert(linksWithTagBase[2].href === 'other/path?a=1&b=2&c=3#hash' && linksWithTagBase[2].url === 'https://example.com/other/path?a=1&b=2&c=3');
      assert(linksWithTagBase[3] === undefined);
    });
  });

  describe('Method getTagsHref', () => {
    const html = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
    const baseHref = Crawler.getTagsHref('base', html);
    const aHrefs = Crawler.getTagsHref('a', html);
    const h2Hrefs = Crawler.getTagsHref('h2', html);

    it(`Check href of tag base from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
      assert(baseHref.length === 1);
      assert(baseHref[0] === 'https://example.com/');
    });

    it(`Check href of tags a from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
      assert(aHrefs.length === 3);
      assert(aHrefs[0] === 'https://github.com/safonovpro/node-html-crawler');
      assert(aHrefs[1] === '/other/path');
      assert(aHrefs[2] === 'other/path?a=1&b=2&c=3#hash');
      assert(aHrefs[3] === undefined);
    });

    it(`Check attrs tag h2 from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
      assert(h2Hrefs.length === 0);
    });
  });

  describe('Method generateEvents', () => {
    const countOfLinks = 3;
    let results = [];
    let isEnded = false;

    for (let i = 0; i < countOfLinks; i++) {
      firstCrawlerForTest.foundLinks.add(`link-${i}`);
    }

    firstCrawlerForTest.on('data', data => results.push(data));
    firstCrawlerForTest.on('end', () => isEnded = true);

    for (let i = 0; i < countOfLinks; i++) {
      firstCrawlerForTest.generateEvents('data', {currentUrl: `current-url-${i}`, result: `result-${i}`});
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