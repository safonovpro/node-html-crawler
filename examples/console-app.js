const Crawler = require('./../classes/crawler');

const protocol = 'http:';
const domain = 'safonov.pro';
const crawler = new Crawler({protocol, domain});

crawler.crawl();
crawler.on('data', data => console.log(data.result.statusCode, data.url));
crawler.on('error', error => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${domain} a crawled!`));