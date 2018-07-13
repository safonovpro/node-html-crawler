const fs = require('fs');
const Crawler = require('../crawler');

const domain = process.argv[2];
const crawler = new Crawler(domain);
const siteTree = {pages: [], urls: {}, redirects: {}};

crawler.crawl();
crawler.on('data', data => {
    siteTree.urls[data.url] = data.result.statusCode;
    siteTree.pages.push({
        url: data.url,
        links: data.result.links
    });

    process.stdout.write(`\r${crawler.countOfProcessedUrls} out of ${crawler.foundLinks.size}`);

    if(/30\d/.test(data.result.statusCode) && data.result.links.length) siteTree.redirects[data.url] = data.result.links[0].url;
});
crawler.on('error', error => console.error(error));
crawler.on('end', () => {
    const resultFilePath = `${__dirname}/${domain}.csv`;

    fs.writeFileSync(resultFilePath, 'url;href;status\r\n');

    for(let pageIndex in siteTree.pages) {
        const urlOfPage = siteTree.pages[pageIndex].url;

        for(let linkIndex in siteTree.pages[pageIndex].links) {
            const urlOfLink = siteTree.pages[pageIndex].links[linkIndex].url;

            if(urlOfLink) {
                const hrefOfLink = siteTree.pages[pageIndex].links[linkIndex].href;
                const statusCodeOfLink = (/30\d/.test(siteTree.urls[urlOfLink])) ? getFinalStatusCodeOfRedirects(urlOfLink) : siteTree.urls[urlOfLink];

                fs.appendFileSync(resultFilePath, `${urlOfPage};${hrefOfLink};${statusCodeOfLink}\r\n`);
            }
        }
    }

    console.log(`\r\nFinish! All ${crawler.foundLinks.size} links on pages on domain ${domain} a checked!`);
});

function getFinalStatusCodeOfRedirects(url) {
    if(/30\d/.test(siteTree.urls[url])) {
        return getFinalStatusCodeOfRedirects(siteTree.redirects[url]);
    } else {
        return siteTree.urls[url];
    }
}