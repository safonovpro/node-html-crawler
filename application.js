/* eslint-disable no-console */
const Crawler = require('./crawler.js');
const download = require('image-downloader')

const domain = process.argv[2];
const crawler = new Crawler(domain);

crawler.crawl();
crawler.on('data', (data) => {
    console.log(data.result.statusCode, data.url);
    if (data.url.endsWith('.jpg')) {
	 options = {
	  url: data.url,
	  dest: '/home/florea/Pictures'                
	}
     
	download.image(options)
	  .then(({ filename }) => {

	    // saved to options.dest
	    console.log('Saved to', filename)  

	  })
	  .catch((err) => console.error(err));
    }
});
crawler.on('error', (error) => console.error(error));
crawler.on('end', () => console.log(`Finish! All urls on domain ${domain} were crawled!`));
