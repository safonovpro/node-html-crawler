const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const url = require('url');

class Crawler extends EventEmitter {
    constructor(config) {
        super();

        this.config = config || {};

        // Default values
        this.config.domain = (this.config.domain === undefined) ? 'example.com' : this.config.domain.trim();
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

    _getDataByUrl(urlString, method = 'GET') {
        const urlObject = url.parse(urlString);
        const reqModule = (urlObject.protocol === 'https:') ? https : http;
        const options = {
            host: urlObject.hostname,
            port: (urlObject.port) ? urlObject.port : (urlObject.protocol === 'https:') ? 443 : 80,
            path: urlObject.path,
            method: method,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        return new Promise((resolve, reject) => {
            let request = reqModule.request(options, (response) => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', chunk => body += chunk);
                response.on('end', () => resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: body
                }));
            });

            request.on('error', error => reject(error));
            request.end();
        });
    }
}

module.exports = Crawler;