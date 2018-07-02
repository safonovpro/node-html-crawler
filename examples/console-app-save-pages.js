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