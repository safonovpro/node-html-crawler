const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const url = require('url');
const punycode = require('punycode');

class Crawler extends EventEmitter {
    constructor(config) {
        super();

        this.config = (typeof config === 'object') ? config : {};

        // Default config values
        this.config.protocol = (this.config.protocol === undefined) ? 'http:' : this.config.protocol.trim();
        this.config.domain = (typeof config === 'string') ? punycode.toASCII(config.trim()) : (this.config.domain === undefined) ? 'example.com' : punycode.toASCII(this.config.domain.trim());
        this.config.limitForConnections = (this.config.limitForConnections === undefined) ? 10 : parseInt(this.config.limitForConnections);
        this.config.limitForRedirects = (this.config.limitForRedirects === undefined) ? 3 : parseInt(this.config.limitForRedirects);
        this.config.timeout = (this.config.timeout === undefined) ? 100 : parseInt(this.config.timeout);

        // Other params
        this.countOfConnections = 0;
        this.waitingOfConnection = 0;
        this.startUrl = `${this.config.protocol}//${this.config.domain}/`;
        this.foundLinks = new Set();
        this.countOfProcessedUrls = 0;
    }

    crawl(urlString = this.startUrl, countOfRedirects = 0) {
        if(!this.foundLinks.has(urlString) && countOfRedirects < this.config.limitForRedirects) {
            const currentUrl = urlString;

            if(this.countOfConnections < this.config.limitForConnections) {
                this.foundLinks.add(currentUrl);

                this._getDataByUrl(currentUrl)
                    .then(result => {
                        if(result.statusCode === 200 && /^text\/html/.test(result.headers['content-type'])) {
                            this._getDataByUrl(currentUrl, 'GET')
                                .then(result => {
                                    for(let link of result.links) {
                                        if(link.url) this.crawl(link.url);
                                    }

                                    this._generateEvents('data', {currentUrl, result});
                                }).catch(error => {
                                    this._generateEvents('error', {currentUrl, error});
                                });
                        } else if(/30\d/.test(result.statusCode)) {
                            const location = result.headers['location'];
                            const nextUrl = this._getInterestingFullUrl(location, currentUrl);

                            result.links.push({href: location, url: nextUrl});

                            if(nextUrl) {
                                this.crawl(nextUrl, ++countOfRedirects);
                            }

                            this._generateEvents('data', {currentUrl, result});
                        } else {
                            this._generateEvents('data', {currentUrl, result});
                        }
                    }).catch(error => {
                        this._generateEvents('error', {currentUrl, error});
                    });
            } else {
                this.waitingOfConnection++;

                setTimeout(() => {
                    this.waitingOfConnection--;
                    this.crawl(currentUrl, countOfRedirects);
                }, this.config.timeout);
            }
        }
    }

    _getInterestingFullUrl(urlString, parentUrl, parentTagBaseHrefValue) {
        const urlObject = url.parse(urlString);
        let result = false;

        if(!this._isInterestingUrl(urlString)) return result;

        if(urlObject.protocol && urlObject.hostname) {
           result = urlObject.protocol + '//' + urlObject.host + urlObject.path;
        } else if(parentUrl !== undefined) {
            const parentUrlObject = url.parse(parentUrl);

            if(!urlObject.protocol && /^\/\//.test(urlObject.pathname)) {
                result = parentUrlObject.protocol + urlObject.path;
            } else if(parentTagBaseHrefValue !== undefined) {
                result = parentTagBaseHrefValue.replace(/\/$/, '') + '/' + urlObject.path.replace(/^\//, '');
            } else if(/^\//.test(urlObject.pathname)) {
                result = parentUrlObject.protocol + '//' + parentUrlObject.host + urlObject.path;
            } else {
                result = parentUrlObject.protocol + '//' + parentUrlObject.host + parentUrlObject.path.replace(/[^\/]*$/,'') + urlObject.path.replace(/^\.\//, '');
            }
        }

        result = this._removeDotsInUrl(result);
        result = this._smartDecodeUrl(result);

        return result;
    }

    _isInterestingUrl(urlString) {
        let urlObject = url.parse((/^\/\//.test(urlString.trim()) ? `http:${urlString}` : urlString));
        let result = false;

        if(/^https?:/.test(urlObject.protocol)) {
            if(urlObject.hostname) {
                if(urlObject.hostname.replace(/^w{3}\./, '') === this.config.domain.replace(/^w{3}\./, '')) {
                    result = true;
                }
            }
        } else if(!urlObject.protocol && !urlObject.host && urlObject.path) {
            result = true;
        }

        return result;
    }

    _smartDecodeUrl(url) {
        const urlArray = url.split('/');
        let result = '';

        for(let i = 3; i < urlArray.length; i++) {
            const partPath = urlArray[i].split('').map(val => (val === '%') ? val : encodeURI(val)).join('');

            result += `/${partPath}`;
        }

        result = `${urlArray[0]}//${urlArray[2]}${result}`;

        return result;
    }

    _removeDotsInUrl(url) {
        const urlArray = url.split('/');
        let countOfDotted = 0;
        let result = '';

        for (let i = urlArray.length - 1; i > 2; i--) {
            if(urlArray[i] === '..') {
                countOfDotted++;
            } else {
                if(countOfDotted === 0) {
                    result = `${urlArray[i]}${(i === urlArray.length - 1) ? '' : '/'}` + result;
                } else {
                    countOfDotted--;
                }
            }
        }

        result = `${urlArray[0]}//${urlArray[2]}/${result}`;

        return result;
    }

    _getDataByUrl(urlString, method = 'HEAD') {
        const urlObject = url.parse(urlString);
        const reqModule = (urlObject.protocol === 'https:') ? https : http;
        const options = {
            host: urlObject.hostname,
            port: (urlObject.port) ? urlObject.port : (urlObject.protocol === 'https:') ? 443 : 80,
            path: urlObject.path,
            method: method,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        this.countOfConnections++;

        return new Promise((resolve, reject) => {
            let request = reqModule.request(options, (response) => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', chunk => body += chunk);
                response.on('end', () => {
                    this.countOfConnections--;

                    resolve({
                        requestMethod: method,
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: body,
                        links: (response.statusCode === 200 && /^text\/html/.test(response.headers['content-type'])) ? this._getUrlsOnHtml(urlString, body) : []
                    });
                });
            });

            request.on('error', error => {
                this.countOfConnections--;

                reject(error)
            });
            request.end();
        });
    }

    _getUrlsOnHtml(currentUrl, html) {
        const base = this._getTagsHref('base', html)[0];
        const result = [];

        this._getTagsHref('a', html).forEach(href => {
            if(result.find(value => value === href) === undefined) {
                result.push({
                    href: href,
                    url: this._getInterestingFullUrl(href, currentUrl, base)
                });
            }
        });

        return result;
    }

    _getTagsHref(tagName, html) {
        const reg = new RegExp(`<${tagName}\s*[^>]*>`,'gi');
        const foundTags = html.match(reg);
        const hrefs = [];

        for(let i in foundTags) {
            let strWithTagAttrs = foundTags[i].replace(new RegExp(`(^<${tagName}\s*|\s*\/?>$)`, 'gi'), '').trim();
            let hrefPosition = strWithTagAttrs.search(/(\s|^)href=/);

            if(~hrefPosition) {
                let commas = false;
                let endCharacter = /(\s|$)/;

                strWithTagAttrs = (hrefPosition) ? strWithTagAttrs.slice(hrefPosition + 6) : strWithTagAttrs.slice(hrefPosition + 5);

                if(/('|")/.test(strWithTagAttrs[0])) {
                    commas = strWithTagAttrs[0];
                    endCharacter = commas;
                    strWithTagAttrs = strWithTagAttrs.slice(1);                    
                }

                hrefs.push(strWithTagAttrs.slice(0, strWithTagAttrs.search(endCharacter)));
            }
        }

        return hrefs;
    }

    _generateEvents(eventsType, data) {
        this.countOfProcessedUrls++;

        if(eventsType === 'data') {
            this.emit('data', {url: data.currentUrl, result: data.result});
        } else if(eventsType === 'error') {
            this.emit('error', new Error(`Error in ${data.currentUrl}: ${data.error}`));
        }

        if(this.waitingOfConnection === 0 && this.countOfProcessedUrls === this.foundLinks.size) this.emit('end');
    }
}

module.exports = Crawler;
