const fs = require('fs');
const { assert } = require('chai');
const config = require('./crawler.config');
const Crawler = require('../crawler');

const firstCrawlerForTest = new Crawler();

describe('Constructor', () => {
  const domain = 'сафонов.pro';
  const domainInPunycode = 'xn--80ae6adbow.pro';
  const secondCrawlerForTest = new Crawler(domain);
  const settingsForThirdCrawler = {
    protocol: 'https:',
    domain,
    limitForConnections: 30,
    limitForRedirects: 5,
    timeout: 500,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; YandexAccessibilityBot/3.0; +http://yandex.com/bots)',
      // eslint-disable-next-line quote-props
      'Cookie': 'name=value',
    },
    urlFilter: () => true,
  };
  const thirdCrawlerForTest = new Crawler(settingsForThirdCrawler);

  it('Set domain by string and other setting by default', () => {
    const protocol = 'http:';

    assert.deepEqual(Object.assign(secondCrawlerForTest.config, { urlFilter: 1 }), {
      domain: domainInPunycode,
      protocol,
      limitForConnections: 10,
      limitForRedirects: 5,
      startUrl: `${protocol}//${domainInPunycode}/`,
      timeout: 300,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      urlFilter: 1,
    });
  });

  it('Costume settings', () => {
    assert.deepEqual(thirdCrawlerForTest.config, {
      ...settingsForThirdCrawler,
      domain: domainInPunycode,
      startUrl: `${settingsForThirdCrawler.protocol}//${domainInPunycode}/`,
    });
  });
});

describe('Method getDataByUrl', () => {
  ['http', 'https'].forEach((protocol) => {
    const url = `${protocol}://example.com/`;

    it(`Method GET, URL is ${url}`, () => firstCrawlerForTest.getDataByUrl(url, 'GET')
      .then((result) => {
        assert.strictEqual(result.requestMethod, 'GET');
        assert.strictEqual(result.statusCode, 200);
        assert.isObject(result.headers);
        assert.match(result.headers['content-type'], /^text\/html/);
        assert.isString(result.body);
        assert.isNotEmpty(result.body);
        assert.isArray(result.links);
        assert.lengthOf(result.links, 1);
        assert.strictEqual(result.links[0].href, 'https://www.iana.org/domains/example');
      }));
  });

  it('Method HEAD, URL is http://yandex.ru/', () => firstCrawlerForTest.getDataByUrl('http://yandex.ru/')
    .then((result) => {
      assert.strictEqual(result.requestMethod, 'HEAD');
      assert.isNumber(result.statusCode);
      assert.strictEqual(result.statusCode.toString().slice(0, 2), '30');
      assert.isObject(result.headers);
      assert.strictEqual(result.headers.location, 'https://yandex.ru/');
      assert.isString(result.body);
      assert.isEmpty(result.body);
    }));
});

describe('Method getInterestingFullUrl', () => {
  const conditions = config.getInterestingFullUrl;

  conditions.forEach((condition) => {
    it(`Full url from ${condition.in.urlString}`, () => {
      const data = [
        condition.in.urlString,
        condition.in.parentUrl,
        condition.in.parentTagBaseHrefValue,
      ];

      assert.strictEqual(firstCrawlerForTest.getInterestingFullUrl(...data), condition.out);
    });
  });
});

describe('Method isInterestingUrl', () => {
  const conditions = config.isInterestingUrl;

  Object.entries(conditions).forEach(([url, isInteresting]) => {
    it(`${url} an internal and not only hash?`, () => {
      assert.strictEqual(firstCrawlerForTest.isInterestingUrl(url), isInteresting);
    });
  });
});

describe('Method isInterestingUrl with urlFilter enabled', () => {
  const filteredCrawler = new Crawler({ urlFilter: (value) => !!value.match(/www/, 'i') });

  const conditions = config.isInterestingUrlWithFilter;

  Object.entries(conditions).forEach(([url, isInteresting]) => {
    it(`${url} an internal and not only hash and not filtered?`, () => {
      assert.strictEqual(filteredCrawler.isInterestingUrl(url), isInteresting);
    });
  });
});

describe('Method removeDotsInUrl', () => {
  const conditions = config.removeDotsInUrl;

  Object.entries(conditions).forEach(([url, urlAfterRemovedDots]) => {
    it(`${url} without sots is ${conditions[url]}`, () => {
      assert.strictEqual(Crawler.removeDotsInUrl(url), urlAfterRemovedDots);
    });
  });
});

describe('Method smartDecodeUrl', () => {
  const conditions = config.smartDecodeUrl;

  Object.entries(conditions).forEach(([url, urlAfterDecode]) => {
    it(`${url} after decode is ${conditions[url]}`, () => {
      assert.strictEqual(Crawler.smartDecodeUrl(url), urlAfterDecode);
    });
  });
});

describe('Method getUrlsOnHtml', () => {
  const html = fs.readFileSync(`${__dirname}/src/page-with-links.html`, 'utf-8');
  const links = firstCrawlerForTest.getUrlsOnHtml('http://example.com/some/path', html);
  const htmlWithTagBase = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
  const linksWithTagBase = firstCrawlerForTest.getUrlsOnHtml('http://example.com/some/path', htmlWithTagBase);

  it(`Links from page ${__dirname}/src/page-with-links.html`, () => {
    assert.lengthOf(links, 3);
    assert.deepEqual(links, [
      { href: 'https://github.com/safonovpro/node-html-crawler', url: false },
      { href: '/other/path', url: 'http://example.com/other/path' },
      { href: 'other/path', url: 'http://example.com/some/other/path' },
    ]);
  });

  it(`Links from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
    assert.lengthOf(linksWithTagBase, 3);
    assert.deepEqual(linksWithTagBase, [
      { href: 'https://github.com/safonovpro/node-html-crawler', url: false },
      { href: '/other/path', url: 'https://example.com/other/path' },
      { href: 'other/path?a=1&b=2&c=3#hash', url: 'https://example.com/other/path?a=1&b=2&c=3' },
    ]);
  });
});

describe('Method getTagsHref', () => {
  const html = fs.readFileSync(`${__dirname}/src/page-with-links-and-tag-base.html`, 'utf-8');
  const baseHref = Crawler.getTagsHref('base', html);
  const aHrefs = Crawler.getTagsHref('a', html);
  const h2Hrefs = Crawler.getTagsHref('h2', html);

  it(`Check href of tag base from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
    assert.lengthOf(baseHref, 1);
    assert.deepEqual(baseHref, ['https://example.com/']);
  });

  it(`Check href of tags a from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
    assert.lengthOf(aHrefs, 3);
    assert.deepEqual(aHrefs, [
      'https://github.com/safonovpro/node-html-crawler',
      '/other/path',
      'other/path?a=1&b=2&c=3#hash',
    ]);
  });

  it(`Check attrs tag h2 from page ${__dirname}/src/page-with-links-and-tag-base.html`, () => {
    assert.isEmpty(h2Hrefs);
  });
});

describe('Method generateEvents', () => {
  const countOfLinks = 3;
  const results = [];
  let isEnded = false;

  for (let i = 0; i < countOfLinks; i += 1) {
    firstCrawlerForTest.foundLinks.add(`link-${i}`);
  }

  firstCrawlerForTest.on('data', (data) => results.push(data));
  firstCrawlerForTest.on('end', () => { isEnded = true; });

  for (let i = 0; i < countOfLinks; i += 1) {
    firstCrawlerForTest.generateEvents('data', { currentUrl: `current-url-${i}`, result: `result-${i}` });
  }

  it('Events "data"', () => {
    assert.strictEqual(results.length, countOfLinks);

    for (let i = 0; i < countOfLinks; i += 1) {
      assert.strictEqual(results[i].url, `current-url-${i}`);
      assert.strictEqual(results[i].result, `result-${i}`);
    }
  });

  it('Events "end"', () => {
    assert.isTrue(isEnded);
  });
});
