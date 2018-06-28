# Crawler of web-pages for node.js

**Simple crawler** (spider) of site web pages by domain name. Written for node.js, using ES6. Provides a very simple event interface using `EventEmitter`.

## Main goals of the module

* Find all the links on the site's HTML pages;
* Get headers for all the links found;
* Load the contents of all found HTML pages;