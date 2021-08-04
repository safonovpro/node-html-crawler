![logo node crawler](./logo.png)


[![npm package](https://nodei.co/npm/node-html-crawler.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-html-crawler)

![build status](https://github.com/safonovpro/node-html-crawler/actions/workflows/tests.yml/badge.svg)
[![dependency status](https://david-dm.org/safonovpro/node-html-crawler/status.svg)](https://david-dm.org/safonovpro/node-html-crawler)

# Crawler of html-pages for node.js

**Simple in use crawler** (spider) of site web pages by domain name.
Written for node.js, using ES6.
Provides a very simple event interface using `EventEmitter`.
Be sure, by reading the instruction and examples.

## Main goals of the module

* Find all the links on the site's HTML pages
* Get headers for all the links found
* Load the contents of all found HTML pages

## Instruction

Install with npm:

    npm install node-html-crawler --save

Include module in script:

```js
const Crawler = require('node-html-crawler');
```

Create instance of a class `Crawler` by passing the domain name:

```js
const crawler = new Crawler('example.com');
```

Or with more advanced settings:

```js
const crawler = new Crawler({
    protocol: 'https:', // default 'http:'
    domain: 'safonov.pro', // default 'example.com'
    limitForConnections: 15, // number of simultaneous connections, default 10
    limitForRedirects: 5, // possible number of redirects, default 5
    timeout: 500, // number of milliseconds between pending connection, default 300
    headers: {
      'User-Agent': 'Mozilla/5.0', // default header
      'Cookie': 'name=value', // advanced header
    },
    urlFilter: (url) => true, // default filter
});
```

Start crawling and subscribe to events:

```js
crawler.crawl();
crawler.on('data', data => { ... }); // some html-page a loaded
crawler.on('error', error => { ... }); // error in crawling
crawler.on('end', () => { ... }); // all pages found are crawled and loaded
```
    
Event `data` returns the following data:

```js
{
    url: 'http://example.com/some/path',
    result: {
      requestMethod: 'HEAD', // or GET for html-page
      statusCode: 200,
      headers: {
          server: 'Apache/2.4.7 (Ubuntu)',
          'content-type': 'text/html; charset=UTF-8'
          // and other headers
      },
      body: '<html>...</html>', // html content
      links: [ // found links in html content, for 301 only one item
          {
              href: '/other/path', // value attr href in html page
              url: 'http://example.com/other/path' // full internal links, for external is false
          },
          // other found links
      ]
    }
}
```

### Using the `urlFilter` option

Sometimes you want more control over which pages are crawled. Maybe you only want to skip pages that match a pattern, or some similar type of thing. For these situations you can use the `urlFilter` option to supply a filter function.

The `urlFilter` option should be a function which accepts a single argument which is the URL being considered for crawling. This function's prime objective is for _exclusion_, not inclusion. If your function returns a falsey value, then the URL will be skipped even if it otherwise would have been included.

## Examples

### Simple console application

Application finds all the URLs and outputs to the console the server response code and the full URL of the document.

    node examples/simple-app.js safonov.pro

```js
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler(domain);

crawler.crawl();
crawler.on('data', (data) => console.log(data.result.statusCode, data.url));
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${domain} a crawled!`));
```

### Find bad internal links on site

Application looks for links on all pages of the site and saves their statuses in the csv-file. Thus, you can find bad internal links.

    node examples/check-ex-links-on-domain.js safonov.pro

```js
const fs = require('fs');
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler({
  domain,
  timeout: 500,
});
const siteTree = { pages: [], urls: {}, redirects: {} };
const getFinalStatusCodeOfRedirects = (url) => {
  if (/30\d/.test(siteTree.urls[url])) return getFinalStatusCodeOfRedirects(siteTree.redirects[url]);

  return siteTree.urls[url];
};

crawler.crawl();
crawler.on('data', (data) => {
  siteTree.urls[data.url] = data.result.statusCode;
  siteTree.pages.push({
    url: data.url,
    links: data.result.links,
  });

  process.stdout.write(`\r${crawler.countOfProcessedUrls} out of ${crawler.foundLinks.size}`);

  if (/30\d/.test(data.result.statusCode) && data.result.links[0].url) siteTree.redirects[data.url] = data.result.links[0].url;
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => {
  const resultFilePath = `${__dirname}/${domain}.csv`;

  fs.writeFileSync(resultFilePath, 'url;href;status\r\n');

  siteTree.pages.forEach((page, pageIndex) => {
    const urlOfPage = siteTree.pages[pageIndex].url;

    siteTree.pages[pageIndex].links.forEach((link, linkIndex) => {
      const urlOfLink = siteTree.pages[pageIndex].links[linkIndex].url;

      if (urlOfLink) {
        const hrefOfLink = siteTree.pages[pageIndex].links[linkIndex].href;
        const statusCodeOfLink = (/30\d/.test(siteTree.urls[urlOfLink])) ? getFinalStatusCodeOfRedirects(urlOfLink) : siteTree.urls[urlOfLink];

        if (statusCodeOfLink) {
          fs.appendFileSync(resultFilePath, `"${urlOfPage}";"${hrefOfLink}";"${statusCodeOfLink}"\r\n`);
        }
      }
    });
  });

  console.log(`\r\nFinish! All ${crawler.foundLinks.size} links on pages on domain ${domain} a checked!`);
});
```

### Download all html-pages from site

Application downloads all the html-pages of the site by sorting them into folders.

    node examples/save-pages.js safonov.pro

```js
const fs = require('fs');
const url = require('url');
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler({
  domain,
  timeout: 500,
});

crawler.crawl();
crawler.on('data', (data) => {
  if (!data.url || !data.result.body) return false;

  const urlString = data.url;
  const html = data.result.body;
  const urlObject = url.parse(urlString);
  const pathArray = urlObject.pathname.split('/');
  let path = `${__dirname}/${domain}`;

  if (!fs.existsSync(path)) fs.mkdirSync(path);

  for (let i = 1; i < pathArray.length; i += 1) {
    if (i !== pathArray.length - 1) {
      path = `${path}/${pathArray[i]}`;

      if (!fs.existsSync(path)) fs.mkdirSync(path);
    } else {
      path = (pathArray[i]) ? `${path}/${pathArray[i].replace(/\.html?$/, '')}` : `${path}/index`;
      path = (urlObject.query) ? `${path}-${urlObject.query}.html` : `${path}.html`;

      fs.writeFileSync(path, html);
      console.log('saved', urlString);
    }
  }

  return true;
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`All pages a saved in folder ${__dirname}/${domain}!`));
```
