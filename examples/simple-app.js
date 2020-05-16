/* eslint-disable no-console */
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler(domain);

crawler.crawl();
crawler.on('data', (data) => console.log(data.result.statusCode, data.url));
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${domain} a crawled!`));
