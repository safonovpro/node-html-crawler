const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const url = require('url');
const punycode = require('punycode');

class Crawler extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      protocol: 'http:',
      domain: 'example.com',
      limitForConnections: 10,
      limitForRedirects: 5,
      timeout: 300,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      urlFilter: () => true,
    };

    if (typeof config === 'string') {
      this.config.domain = config.trim();
    } else if (typeof config === 'object') {
      this.config = { ...this.config, ...config };
    }

    this.config.domain = punycode.toASCII(this.config.domain);
    this.config.startUrl = `${this.config.protocol}//${this.config.domain}/`;

    // Other params
    this.countOfConnections = 0;
    this.waitingOfConnection = 0;
    this.startUrl = `${this.config.protocol}//${this.config.domain}/`;
    this.foundLinks = new Set();
    this.countOfProcessedUrls = 0;
  }

  crawl(urlString = this.startUrl, countOfRedirects = 0) {
    if (!this.foundLinks.has(urlString) && countOfRedirects < this.config.limitForRedirects) {
      const currentUrl = urlString;

      if (this.countOfConnections < this.config.limitForConnections) {
        this.foundLinks.add(currentUrl);

        this.getDataByUrl(currentUrl)
          .then((headers) => {
            if (headers.statusCode === 200 && /^text\/html/.test(headers.headers['content-type'])) {
              this.getDataByUrl(currentUrl, 'GET')
                .then((result) => {
                  result.links.forEach((link) => { if (link.url) this.crawl(link.url); });

                  this.generateEvents('data', { currentUrl, result });
                }).catch((error) => {
                  this.generateEvents('error', { currentUrl, error });
                });
            } else if (/30\d/.test(headers.statusCode)) {
              const { location } = headers.headers;
              const nextUrl = this.getInterestingFullUrl(location, currentUrl);

              headers.links.push({ href: location, url: nextUrl });

              if (nextUrl) {
                this.crawl(nextUrl, countOfRedirects + 1);
              }

              this.generateEvents('data', { currentUrl, result: headers });
            } else {
              this.generateEvents('data', { currentUrl, result: headers });
            }
          }).catch((error) => {
            this.generateEvents('error', { currentUrl, error });
          });
      } else {
        this.waitingOfConnection += 1;

        setTimeout(() => {
          this.waitingOfConnection -= 1;
          this.crawl(currentUrl, countOfRedirects);
        }, this.config.timeout);
      }
    }
  }

  getInterestingFullUrl(urlString, parentUrl, parentTagBaseHrefValue) {
    const urlObject = url.parse(urlString);
    let result = false;

    if (!this.isInterestingUrl(urlString)) return result;

    if (urlObject.protocol && urlObject.hostname) {
      result = `${urlObject.protocol}//${urlObject.host}${urlObject.path}`;
    } else if (parentUrl !== undefined) {
      const parentUrlObject = url.parse(parentUrl);

      if (!urlObject.protocol && /^\/\//.test(urlObject.pathname)) {
        result = parentUrlObject.protocol + urlObject.path;
      } else if (parentTagBaseHrefValue !== undefined) {
        result = `${parentTagBaseHrefValue.replace(/\/$/, '')}/${urlObject.path.replace(/^\//, '')}`;
      } else if (/^\//.test(urlObject.pathname)) {
        result = `${parentUrlObject.protocol}//${parentUrlObject.host}${urlObject.path}`;
      } else {
        result = `${parentUrlObject.protocol}//${parentUrlObject.host}${parentUrlObject.path.replace(/[^/]*$/, '')}${urlObject.path.replace(/^\.\//, '')}`;
      }
    }

    result = Crawler.removeDotsInUrl(result);
    result = Crawler.smartDecodeUrl(result);

    return result;
  }

  isInterestingUrl(urlString) {
    const urlObject = url.parse((/^\/\//.test(urlString.trim()) ? `http:${urlString}` : urlString));
    let result = false;

    if (/^https?:/.test(urlObject.protocol)) {
      if (urlObject.hostname) {
        if (urlObject.hostname.replace(/^w{3}\./, '') === this.config.domain.replace(/^w{3}\./, '')) {
          result = true;
        }
      }
    } else if (!urlObject.protocol && !urlObject.host && urlObject.path) {
      result = true;
    }

    if (result && !this.config.urlFilter(urlString)) {
      result = false;
    }

    return result;
  }

  static smartDecodeUrl(notDecodeUrl) {
    const urlArray = notDecodeUrl.split('/');
    let result = '';

    for (let i = 3; i < urlArray.length; i += 1) {
      const partPath = urlArray[i].split('').map((val) => ((val === '%') ? val : encodeURI(val))).join('');

      result += `/${partPath}`;
    }

    result = `${urlArray[0]}//${urlArray[2]}${result}`;

    return result;
  }

  static removeDotsInUrl(urlWithDots) {
    const urlArray = urlWithDots.split('/');
    let countOfDotted = 0;
    let result = '';

    for (let i = urlArray.length - 1; i > 2; i -= 1) {
      if (urlArray[i] === '..') {
        countOfDotted += 1;
      } else if (countOfDotted === 0) {
        result = `${urlArray[i]}${(i === urlArray.length - 1) ? '' : '/'}${result}`;
      } else {
        countOfDotted -= 1;
      }
    }

    result = `${urlArray[0]}//${urlArray[2]}/${result}`;

    return result;
  }

  getDataByUrl(urlString, method = 'HEAD') {
    const urlObject = url.parse(urlString);
    const options = {
      host: urlObject.hostname,
      port: (urlObject.port) ? urlObject.port : 80,
      path: urlObject.path,
      method,
      headers: this.config.headers,
    };
    let reqModule = http;

    if (urlObject.protocol === 'https:') {
      reqModule = https;
      options.port = (urlObject.port) ? urlObject.port : 443;
    }

    this.countOfConnections += 1;

    return new Promise((resolve, reject) => {
      const request = reqModule.request(options, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          this.countOfConnections -= 1;

          resolve({
            requestMethod: method,
            statusCode: response.statusCode,
            headers: response.headers,
            body,
            links: (response.statusCode === 200 && /^text\/html/.test(response.headers['content-type'])) ? this.getUrlsOnHtml(urlString, body) : [],
          });
        });
      });

      request.on('error', (error) => {
        this.countOfConnections -= 1;

        reject(error);
      });
      request.end();
    });
  }

  getUrlsOnHtml(currentUrl, html) {
    const base = Crawler.getTagsHref('base', html)[0];
    const result = [];

    Crawler.getTagsHref('a', html).forEach((href) => {
      if (result.find((value) => value.href === href) === undefined) {
        result.push({
          href,
          url: this.getInterestingFullUrl(href, currentUrl, base),
        });
      }
    });

    return result;
  }

  static getTagsHref(tagName, html) {
    const htmlWithoutComments = html.replace(/<!--(?:(?!-->)[\s\S])*-->/g, '');
    const reg = new RegExp(`<${tagName}\\s*[^>]*>`, 'gi');
    const foundTags = htmlWithoutComments.match(reg) || [];
    const hrefs = [];

    foundTags
      .map((val) => val.replace(new RegExp(`(^<${tagName}\\s*|\\s*\\/?>$)`, 'gi'), '').trim())
      .filter((val) => val.search(/(\s|^)href=/) > -1)
      .forEach((val) => {
        let strAttrs = val;
        let commas = false;
        let endChar = /(\s|$)/;
        const hrefPos = strAttrs.search(/(\s|^)href=/);

        strAttrs = (hrefPos) ? strAttrs.slice(hrefPos + 6) : strAttrs.slice(hrefPos + 5);

        if (/('|")/.test(strAttrs[0])) {
          [commas] = strAttrs;
          endChar = commas;
          strAttrs = strAttrs.slice(1);
        }

        hrefs.push(strAttrs.slice(0, strAttrs.search(endChar)));
      });

    return hrefs;
  }

  generateEvents(eventsType, data) {
    this.countOfProcessedUrls += 1;

    if (eventsType === 'data') {
      this.emit('data', { url: data.currentUrl, result: data.result });
    } else if (eventsType === 'error') {
      this.emit('error', new Error(`Error in ${data.currentUrl}: ${data.error}`));
    }

    if (this.waitingOfConnection === 0 && this.countOfProcessedUrls === this.foundLinks.size) this.emit('end');
  }
}

module.exports = Crawler;
