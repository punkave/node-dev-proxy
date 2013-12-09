# node-dev-proxy

<a href="http://apostrophenow.org/"><img src="https://raw.github.com/punkave/node-dev-proxy/master/logos/logo-box-madefor.png" align="right" /></a>

node-dev-proxy launches your node-powered sites on demand when you access them by their actual names. No more "node app", no more "http://localhost:3000".

node-dev-proxy also provides a simple web-based console where you can see the output of all of your apps and easily shut them down, launch more, or visit their homepages.

<img src="https://raw.github.com/punkave/node-dev-proxy/master/screenshot1.png" />

## Setting up node-dev-proxy

First, move your node-powered sites to `~/node-sites`. Each one should have an `app.js` file. The layout looks like this:

    ~/node-sites/site1/app.js
    ~/node-sites/site2/app.js
    ~/node-sites/site3/app.js

Etc. Don't put anything that isn't a node-powered website in this folder.

Now pick up `node-dev-proxy` from github:

    git clone https://github.com/punkave/node-dev-proxy
    cd node-dev-proxy

Now start the proxy:

    node app

Next, **configure your system to use the provided `proxy.pac` file for webserver proxy configuration.** All the major web browsers provide a way to do this, so this works across Windows, Linux and Mac. On a Mac you can just do it system-wide:

* Go to System Preferences
* Open "Network"
* Click "Advanced"
* Click "Proxies"
* Click the "Browse" button for "Automatic Proxy Configuration"
* Pick the `proxy.pac` file that came with `node-dev-proxy`

## Launching Your Sites

Now, try visiting one of your sites! If you have `~/node-sites/site1/app.js` then you can visit:

    http://site1.dev

(Note: **Chrome will be a pain at first and insist you don't really mean it if you just type site1.dev without the http.** But it'll get over it after it sees you mean it the first couple times.)

Boom! Your site fires up in the background and you see the homepage.

## Viewing the Console

Try visiting:

    http://monitor.dev

You can see all the console output of each site. There is an "x" to shut each site down. If you double-click the tab for a site that is already running, a new browser window is opened to visit that site. And, if you click one of the tabs at right for sites not already running, they start up and open in your browser.

## Restarting a Site

Currently: click the "x," then click the appropriate tab at right to launch the site again. We'll be adding a "refresh" icon.

## About P'unk Avenue and Apostrophe

`node-dev-proxy` was created at [P'unk Avenue](http://punkave.com) to support our work developing projects with Apostrophe, an open-source content management system built on node.js. `node-dev-proxy` isn't mandatory for Apostrophe and vice versa, but they play very well together. If you like `node-dev-proxy` you should definitely [check out the Apostrophe sandbox project](http://github.com/punkave/apostrophe-sandbox).

## Support

Feel free to open issues on [github](http://github.com/punkave/node-dev-proxy). We welcome pull requests.

<a href="http://punkave.com/"><img src="https://raw.github.com/punkave/node-dev-proxy/master/logos/logo-box-builtby.png" /></a>




