# Crawler of web-pages for node.js

**Simple for use crawler** (spider) of site web pages by domain name.
Written for node.js, using ES6.
Provides a very simple event interface using `EventEmitter`.
Be sure, by reading the instruction and examples.

## Main goals of the module

* Find all the links on the site's HTML pages
* Get headers for all the links found
* Load the contents of all found HTML pages

## Instruction

Install with npm:

    npm install node-crawler --save

Include module in script:

```js
const Crawler = require('node-crawler');
```

Create instance of a class `Crawler` by passing the domain name:

```js
const crawler = Crawler({domain: 'example.com'});
```

Start crawling and subscribe to events:

```js
crawler.crawl();
crawler.on('data', data => { ... }); // some html-page a loaded
crawler.on('error', error => { ... }); // error in crawling
crawler.on('end', () => { ... }); // all pages found are crawled and loaded
```
    
When creating an instance of a class, you can pass parameters:

```js
crawler.crawl({
    protocol: 'https:', // default 'http:'
    domain: 'safonov.pro', // default 'example.com'
    limitForConnections: 15, // number of simultaneous connections, default 10
    limitForRedirects: 5, // possible number of redirects, default 3
    timeout: 500 // number of milliseconds between pending connection, default 100 
});
```
    
Event `date` returns the following data:

```js
    {
        
    }
```

## Examples

### Simple console application

The application finds all the URLs and outputs to the console the server response code and the full URL of the document.
```js
const commandLineArgs = require('command-line-args');
const Crawler = require('../crawler');

const config = commandLineArgs([
    {name: 'protocol', alias: 'p', defaultValue: 'http:'},
    {name: 'domain', alias: 'd', defaultValue: 'safonov.pro'},
    {name: 'connections', alias: 'c'},
    {name: 'redirects', alias: 'r'},
    {name: 'timeout', alias: 't'}
]);
const crawler = new Crawler(config);

crawler.crawl();
crawler.on('data', data => console.log(data.result.statusCode, data.url));
crawler.on('error', error => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${config.domain} a crawled!`));
```

### Find bad internal links on site

Application ... 

```js

```

### Download all html-pages from site

Application

```js
const fs = require('fs');
const url = require('url');
const commandLineArgs = require('command-line-args');
const Crawler = require('../crawler');

const config = commandLineArgs([
    {name: 'protocol', alias: 'p', defaultValue: 'http:'},
    {name: 'domain', alias: 'd', defaultValue: 'safonov.pro'},
    {name: 'connections', alias: 'c'},
    {name: 'redirects', alias: 'r'},
    {name: 'timeout', alias: 't'}
]);
const crawler = new Crawler(config);

crawler.crawl();
crawler.on('data', data => save(data.url, data.result.body));
crawler.on('error', error => console.error(error));
crawler.on('end', () => console.log(`All pages from domain ${config.domain} a saved in folder ${__dirname}/${config.domain}!`));

function save(urlString, html) {
    if(!urlString || !html) return false;

    const urlObject = url.parse(urlString);
    const pathArray = urlObject.pathname.split('/');
    let path = `${__dirname}/${config.domain}`;

    if(!fs.existsSync(path)) fs.mkdirSync(path);

    for(let i = 1; i < pathArray.length; i++) {
         if(i !== pathArray.length - 1) {
             path = `${path}/${pathArray[i]}`;

             if(!fs.existsSync(path)) fs.mkdirSync(path);
         } else {
             path = (pathArray[i]) ? `${path}/${pathArray[i].replace(/\.html?$/,'')}`: `${path}/index`;
             path = (urlObject.query) ? `${path}-${urlObject.query}.html` : `${path}.html`;

             fs.writeFileSync(path, html);
             console.log('saved', urlString);
         }
    }

    return true;
}
```