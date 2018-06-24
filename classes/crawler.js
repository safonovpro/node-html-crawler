const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const url = require('url');
const cheerio = require('cheerio');

class Crawler extends EventEmitter {
    constructor(config) {
        super();

        this.config = config || {};

        // Default values
        this.config.protocol = (this.config.protocol === undefined) ? 'http:' : this.config.protocol.trim();
        this.config.domain = (this.config.domain === undefined) ? 'example.com' : this.config.domain.trim();
        this.config.limitForConnections = (this.config.limitForConnections === undefined) ? 10 : parseInt(this.config.limitForConnections);
        this.config.limitForRedirects = (this.config.limitForRedirects === undefined) ? 3 : parseInt(this.config.limitForRedirects);
        this.config.timeout = (this.config.timeout === undefined) ? 100 : parseInt(this.config.timeout);

        this.countOfConnections = 0;
        this.startUrl = `${this.config.protocol}//${this.config.domain}/`;
        this.foundLinks = new Set();
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
                                    console.log(result.statusCode, currentUrl); // Место для события data

                                    const $ = cheerio.load(result.body);
                                    const base = ($('base[href]').length > 0) ? $('base').attr('href').replace(/\/+$/, '') + '/' : undefined;

                                    for(let link of result.links) {
                                        const nextUrl = this._getInternalFullUrlWithoutAuthAndHash(link, currentUrl, base);

                                        if(nextUrl) this.crawl(nextUrl);
                                    }
                                }).catch(error => console.error(`Error in ${currentUrl}: ${error}`));
                        } else if(/30\d/.test(result.statusCode)) {
                            console.log(result.statusCode, currentUrl); // Место для события data

                            const nextUrl = this._getInternalFullUrlWithoutAuthAndHash(result.headers['location'], currentUrl);

                            if(nextUrl) this.crawl(nextUrl, ++countOfRedirects);
                        } else {
                            console.log(result.statusCode, currentUrl); // Место для события data
                        }
                    }).catch(error => console.error(`Error in ${currentUrl}: ${error}`));
            } else {
                setTimeout(() => {
                    this.crawl(currentUrl, countOfRedirects);
                }, this.config.timeout);
            }
        }
    }

    _getInternalFullUrlWithoutAuthAndHash(urlString, parentUrl, parentTagBaseHrefValue) {
        let result = false;

        if(this._isInternalUrlAndNotOnlyHash(urlString)) {
            const urlObject = url.parse(urlString);

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
                    result = parentUrlObject.protocol + '//' + parentUrlObject.host + parentUrlObject.path.replace(/[^\/]*$/,'') + urlObject.path;
                }
            }
        }

        return result;
    }

    _isInternalUrlAndNotOnlyHash(urlString) {
        let urlObject = url.parse(urlString);
        let result = false;

        if(urlObject.hostname) {
            if(urlObject.hostname.replace(/^w{3}\./, '') === this.config.domain.replace(/^w{3}\./, '')) {
                result = true;
            }
        } else if(/^\/\//.test(urlObject.pathname)) {
           urlObject = url.parse('protocol:' + urlString);

            if(urlObject.hostname.replace(/^w{3}\./, '') === this.config.domain.replace(/^w{3}\./, '')) {
                result = true;
            }
        } else if(urlObject.path) {
            result = true;
        }

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
                        links: (response.statusCode === 200 && /^text\/html/.test(response.headers['content-type'])) ? this._getUrlsOnHtml(body) : []
                    });
                });
            });

            request.on('error', error => reject(error));
            request.end();
        });
    }

    _getUrlsOnHtml(html) {
        const $ = cheerio.load(html);
        const result = [];

        $('a').each((index, element) => {
            const href = $(element).attr('href');

            if(result.find((value) => (value === href)) === undefined) {
                result.push(href);
            }
        });

        return result;
    }
}

module.exports = Crawler;