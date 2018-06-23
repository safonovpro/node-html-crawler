const Crawler = require('./../classes/crawler');

const crawler = new Crawler();

// crawler._getDataByUrl('http://example.com/', 'HEAD')
//     .then(response => {
//         console.log(typeof response.statusCode, typeof response.headers, response.body);
//     });

console.log(crawler._getFullUrl('//eltech.ru/some/path/'));