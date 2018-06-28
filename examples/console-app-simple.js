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