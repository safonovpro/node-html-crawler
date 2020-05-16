/* eslint-disable no-console */
const fs = require('fs');
const url = require('url');
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler({
  domain,
  timeout: 500,
});

crawler.crawl();
crawler.on('data', (data) => {
  if (!data.url || !data.result.body) return false;

  const urlString = data.url;
  const html = data.result.body;
  const urlObject = url.parse(urlString);
  const pathArray = urlObject.pathname.split('/');
  let path = `${__dirname}/${domain}`;

  if (!fs.existsSync(path)) fs.mkdirSync(path);

  for (let i = 1; i < pathArray.length; i += 1) {
    if (i !== pathArray.length - 1) {
      path = `${path}/${pathArray[i]}`;

      if (!fs.existsSync(path)) fs.mkdirSync(path);
    } else {
      path = (pathArray[i]) ? `${path}/${pathArray[i].replace(/\.html?$/, '')}` : `${path}/index`;
      path = (urlObject.query) ? `${path}-${urlObject.query}.html` : `${path}.html`;

      fs.writeFileSync(path, html);
      console.log('saved', urlString);
    }
  }

  return true;
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`All pages a saved in folder ${__dirname}/${domain}!`));
