const Crawler = require('./../classes/crawler');

const crawler = new Crawler({
    protocol: 'http:',
    domain: 'safonov.pro'
});

crawler.crawl();