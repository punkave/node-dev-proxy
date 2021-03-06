var fs = require('fs');

var config = fs.existsSync(__dirname + '/config.js') ? require('./config.js') : {};

var proxyPort = config.proxyPort || 5050;

var nextPort = config.firstAppPort || 4000;

var sitesPath = config.sitesPath || '~/node-sites';

sitesPath = sitesPath.replace(/~/g, process.env.HOME);

var nodeCommand = config.nodeCommand || 'node';

var nextMessage = 1;

// Uniquely identify this instance of the server
var instance = Math.floor(Math.random() * 1000000000);

var fs = require('fs');
var glob = require('glob');
var _ = require('lodash');
var spawn = require('child_process').spawn;
var url = require('url');
var basename = require('path').basename;
var async = require('async');
var nunjucks = require('nunjucks');
var extend = require('extend');
var express = require('express');
var net = require('net');
var sys = require('sys');
var exec = require('child_process').exec;
var os = require('os');

nunjucks.configure('views', { autoescape: true });

var sites = {};

var monitor = express();
monitor.use(express.static(__dirname + '/public'));
monitor.use(express.bodyParser());

refresh();

fs.watch(sitesPath, { persistent: true }, function(event, filename) {
  refresh();
});

var http = require('http');
var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({ agent: http.globalAgent });

var server = require('http').createServer(dispatcher);

nunjucks.configure('views', {
    autoescape: false,
    express: monitor
});

monitor.get('/', function(req, res) {
  return res.render('monitor.html', { instance: instance });
});

monitor.post('/update', function(req, res) {
  var response = {
    status: 'ok',
    sites: {},
    instance: instance,
    last: nextMessage - 1
  };
  _.each(sites, function(site, name) {
    response.sites[name] = {
      name: name,
      running: !!site.child,
      ran: !!site.output.length,
      output: outputSince(site, req.body.since || 0)
    };
  });
  return res.send(response);
});

function outputSince(site, since) {
  return _.filter(site.output, function(message) {
    return (message.id > since);
  });
}

// Seems superfluous, we can just link to a site and let it autostart
// monitor.post('/launch', function(req, res) {
//   var site = sites[req.body.name];
//   if (!site.child) {
//     return launch(site, function(err) {
//       if (err) {
//         return res.send({ status: err });
//       } else {
//         return res.send({ status: 'ok' });
//       }
//     });
//   } else {
//     // Already running
//     return res.send({ status: 'ok' });
//   }
// });

monitor.post('/restart', function(req, res) {
  var site = sites[req.body.name];
  return async.series({
    kill: function(callback) {
      return kill(site, callback);
    },
    launch: function(callback) {
      send(site.name, 'system', "\n\n* * * RESTART * * *\n\n");
      return launch(site, callback);
    }
  }, function(err) {
    if (err) {
      console.error(err);
      return res.send({ status: err });
    } else {
      return res.send({ status: 'ok' });
    }
  });
});

monitor.post('/kill', function(req, res) {
  var site = sites[req.body.name];
  return kill(site, function() {
    return res.send({ status: 'ok' });
  });
});

function kill(site, callback) {
  if (!site.child) {
    return callback(null);
  }
  if (site.child) {
    site.child.on('close', function() {
      return callback(null);
    });
    site.child.kill();
  }
}

// The code below sets up proxy.pac automatically for OSX
if(os.platform() === 'darwin') {
  // We're gonna check if we're running a Wi-Fi connection right now
  exec("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I", function (error, stdout, stderr) {
    if (error !== null) return; // In case of error we panic and run away from here
    var usedHardwarePort = 'Ethernet';

    if(stdout.match(/state:\s+running/i)){
      usedHardwarePort = 'Wi-Fi';
    }

    var zoltarPacUrl = 'file://localhost' + __dirname + '/proxy.pac';

    exec("networksetup -getautoproxyurl " + usedHardwarePort, function (error, stdout, stderr) {
      if(stdout.match(/enabled:\s+no/i)){
        console.log('\n\nzoltar is now going to attempt to configure proxy.pac automatically. You may be prompted for your password.')
        exec('networksetup -setautoproxyurl ' + usedHardwarePort + ' "' + zoltarPacUrl + '"', function (error, stdout, stderr) {
          console.log("\nProxy ready.");
        });
      } else if(stdout.match(/enabled:\s+yes/i)){
        var existingPacUrl = stdout.match(/URL:\s+(.*?)\n/i)[1];

        if(existingPacUrl === zoltarPacUrl){
          console.log("\nProxy ready.");
        } else {
          console.log("\nIt seems like you're already using a *.pac file in your proxy settings.\n" +
            "You can either merge the currently used *.pac file with zoltar's proxy.pac,\n" +
            "or replace it by going to: \n" +
            "System Preferences -> Network -> Advanced ->\n" +
            "Proxies -> Automatic Configuration\n" +
            "\nProxy ready.");
        }
      }
    });
  });
} else {
  console.log("\n\nProxy ready. Be sure to install proxy.pac");
}

server.listen(proxyPort);

function dispatcher(req, res) {
  var parsed = url.parse(req.url);
  if (!parsed.hostname) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    return res.end('Not found');
  }
  var name = parsed.hostname;
  var matches = name.match(/^(.*)?\.dev$/);
  if (matches) {
    name = matches[1];
  }

  if (name === 'monitor') {
    return monitor(req, res);
  }

  if (!sites[name]) {
    // Not one of ours
    res.writeHead(200, {'Content-Type': 'text/plain'});
    return res.end('Hmm, there is no such dev site right now. TODO: list dev sites available here. HINT: never set this up as your proxy server for ALL sites. Use the provided proxy.pac file via System Preferences -> Network -> Advanced -> Proxies -> Automatic Configuration.');
  }

  // Talk to the appropriate server app, start one if needed
  return serveProxy(name, req, res);
}

function serveProxy(name, req, res)
{
  var site = sites[name];
  async.series({
    spinup: function(callback) {
      if (site.port) {
        return callback(null);
      }
      return launch(site, callback);
    },

    proxy: function(callback) {
      var target = 'http://localhost:' + site.port;
      var superEnd = res.end;
      res.end = function(data, encoding) {
        return superEnd.call(res, data, encoding);
      };
      // Workaround for https://github.com/nodejitsu/node-http-proxy/issues/529
      req.url = req.url.replace(/^\w+\:\/\/.*?\//, '/');
      return proxy.web(req, res, { target: target });
    }
  }, function(err) {
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end('An error occurred. See monitor.dev for details.');
    }
  });
}

function refresh()
{
  var newSites = {};
  var siteNames = glob.sync(sitesPath + '/*');
  siteNames = _.map(siteNames, function(siteName) {
    return basename(siteName).toLowerCase();
  });
  siteNames = _.filter(siteNames, function(siteName) {
    return siteName.match(/^[\w\-]+$/);
  });
  _.each(siteNames, function(siteName) {
    if (sites[siteName]) {
      newSites[siteName] = sites[siteName];
    } else {
      newSites[siteName] = { name: siteName, output: [] };
    }
  });
  var orphans = _.difference(_.keys(sites), _.keys(newSites));
  _.each(orphans, function(orphan) {
    if (orphan.child) {
      // Isn't that a charming line of code? Yikes
      orphan.child.kill();
      delete orphan.child;
      delete orphan.port;
    }
  });
  sites = newSites;
}

// Escape output suitably to be included in a pre tag
function esc(s) {
  s = s.toString('utf8');
  if (s === 'undefined') {
    s = '';
  }
  if (typeof(s) !== 'string') {
    s = s + '';
  }
  return s.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;').replace(/\r?\n/g, "\n");
}

function send(name, category, data) {
  var output = '<span class="' + category + '">' + esc(data) + '</span>\n';
  sites[name].output.push({
    id: nextMessage++,
    o: output
  });
}

function launch(site, callback) {
  site.port = nextPort++;

  // Spawn the app
  var env = {};
  extend(true, env, process.env);
  env.PORT = site.port;

  var alternatives = config.alternatives || [ 'start-dev', 'app.js', 'server.js', 'index.js' ];

  var pj = sitesPath + '/' + site.name + '/package.json';
  if (fs.existsSync(pj)) {
    try {
      var info = JSON.parse(fs.readFileSync(pj));
      if (info.main) {
        alternatives.unshift(info.main);
      }
    } catch (e) {
      // Not much use to us if it's invalid
    }
  }

  var main = _.find(alternatives, function(alternative) {
    if (fs.existsSync(sitesPath + '/' + site.name + '/' + alternative)) {
      return alternative;
    }
  });

  if (!main) {
    return callback('none of these exist: ' + alternatives.join(', ') + ' specify main: in package.json if you want to use something else.');
  }
  var viaNode = main.match(/\.js$/);
  var fullPath = sitesPath + '/' + site.name + '/' + main;
  var cmd = viaNode ? nodeCommand : fullPath;
  var args = viaNode ? [ fullPath ] : [];
  site.child = myspawn(cmd, args, {
    cwd: sitesPath + '/' + site.name,
    env: env
  });

  site.child.stdout.on('data', function(data) {
    send(site.name, 'stdout', data);
  });

  site.child.stderr.on('data', function(data) {
    send(site.name, 'stderr', data);
  });

  site.child.on('close', function(code) {
    delete site.child;
    delete site.port;
  });

  // Wait until we can successfully connect to the app
  var connected = false;
  var tries = 0;

  return async.until(function() {
    return connected;
  }, function(callback) {
    var socket = net.connect({port: site.port, host: 'localhost'}, function() {
      // Connection successful
      socket.end();
      connected = true;
      return callback(null);
    });
    socket.on('error', function(e) {
      tries++;
      socket.end();
      if (!site.child) {
        // Process died before we could connect to it
        send(site.name, 'system', '* * * PROCESS EXITED WITH NO CONNECTION * * *');
        return callback('failed');
      }
      if (tries === 30) {
        send(site.name, 'system', '* * * UNABLE TO CONNECT TO ' + site.name + ' AFTER 30 TRIES * * *');
        send(site.name, 'system', 'Did you remember to check the PORT environment variable ' + 'when deciding what port to listen to in your app?');
        return callback('failed');
      }
      return setTimeout(callback, 250);
    });
  }, function(err) {
    return callback(err);
  });
}

function myspawn(program, args, options) {
  return spawn(program, args, options);
}