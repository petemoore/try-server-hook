"use strict";

var url = require('url');
var async = require('async');
var request = require('request');
var util = require('util');
var jsdom = require('jsdom');

var bbToRealPlatform = {
  'linux32_gecko': 'linux-i686',
  'linux64_gecko': 'linux-x86_64',
  'macosx64': 'mac64',
};

var realPlatformToBB = {
  'linux-i686': 'linux32_gecko',
  'linux-x86_64': 'linux64_gecko',
  'mac64': 'macosx64',
};

var platformToSuffix = {
  'linux-i686': '.tar.bz2',
  'linux-x86_64': '.tar.bz2',
  'mac64': '.dmg'
};

var ffosBranchToGeckoBranch = {
  master: 'mozilla-central',
  'v2.0': 'mozilla-aurora',
  'v1.4': 'mozilla-b2g30_v1_4',
  'v1.3': 'mozilla-b2g28_v1_3',
  'v1.3t': 'mozilla-b2g28_v1_3_t',
};

var validVersion = /^((\d+)\.{0,1})+(\d+)([ab]?\d+)?$/gm

/*
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.linux-i686.tar.bz2' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.linux-i686.tests.zip' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.linux-x86_64.tar.bz2' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.linux-x86_64.tests.zip' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s-debug/latest/en-US/b2g-%d.0a1.en-US.linux-x86_64.tar.bz2' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s-debug/latest/en-US/b2g-%d.0a1.en-US.linux-x86_64.tests.zip' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.mac64.dmg' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s/latest/en-US/b2g-%d.0a1.en-US.mac64.tests.zip' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s-debug/latest/en-US/b2g-%d.0a1.en-US.mac64.dmg' % (pf, mc_gecko_version),
'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s-debug/latest/en-US/b2g-%d.0a1.en-US.mac64.tests.zip' % (pf, mc_gecko_version),
*/

// Figure out which version of Gecko a given repository is
function geckoVersion (options, callback) {
  //http://hg.mozilla.org/mozilla-central/file/16f3cac5e8fe/browser/config/version.txt
  var pathComponents = [
    options.repoPath || 'mozilla-central',
    'raw-file',
    options.branch || 'default',
    options.product || 'browser',
    'config',
    'version.txt'
  ];
  var urlObj = {
    protocol: options.protocol || 'https',
    hostname: options.host || 'hg.mozilla.org',
    port: options.port,
    pathname: pathComponents.join('/')
  };
  request(url.format(urlObj), function (err, response, body) {
    if (err) {
      return callback(err);
    }
    var match = validVersion.exec(body);
    if (!match) {
      return callback(new Error('%s is not a valid version number' % body));
    }
    return callback(null, match[0]);
  });
}

// Check if a URL points to an existing resource
function checkURL(url, callback) {
  var reqOpts = {
    url: url,
    method: 'HEAD',
    headers: {'User-Agent': 'try-server-hook (gaia)'},
  }
  request(reqOpts, function (err, response, body) {
    if (err) {
      return callback(false);
    }
    return callback(response.statusCode >= 200 && response.statusCode < 300);
  });
}

// Build the URL for a bundle, optionally only the part of the
// url that points to the directory before the timestamp dir
function buildBundleURL(options, callback) {
  var urlObj = {
    protocol: options.protocol || 'https',
    hostname: options.host || 'ftp.mozilla.org',
    port: options.port,
  };
//'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-%s-debug/latest/en-US/b2g-%d.0a1.en-US.mac64.tests.zip' % (pf, mc_gecko_version),
  var path = [
    'pub',
    'mozilla.org',
    options.ftpProduct || 'b2g',
    'tinderbox-builds',
    util.format('%s-%s', options.branch || 'mozilla-central', options.bbPlatform || 'linux64'),
  ];
  if (!options.findingLatest) {
    [
      options.timestamp || 'latest',
      options.locale || 'en-US',
      util.format('%s-%s.%s.%s%s',
          options.product || 'b2g',
          options.version || '999a1',
          options.locale || 'en-US',
          options.platform || 'linux-x86_64',
          options.fileSuffix || '')
    ].forEach(function(e) { path.push(e)});
  }
  urlObj.pathname = path.join('/');
  var bundleURL = url.format(urlObj);
  checkURL(bundleURL, function(there) {
    if (!there) {
      return callback(new Error('URL created but not there: ' + bundleURL));
    }
    return callback(null, bundleURL);
  });
}

// Determine the latest directory.  This is a unix timestamp representing
// the most recent gecko upload
function getLatestDirNum(loc, callback) {
  var potato = 'This ' + loc + ' document is a potato, not a directory listing';
  jsdom.env(loc, function(err, window) {
    if (err) {
      return callback(new Error(potato));
    }
    var times = []; 
    // Use a[href^="1"]???
    var datacells = window.document.querySelectorAll('table>tr>td:not(th):not(tf):nth-child(2)>a[href^="1"]');
    // 3, one for Parent Directory, one for latest dir
    if (datacells.length < 0) {
      return callback(new Error('No potential builds to find'));
    }

    for (var i = 0; i < datacells.length; i++) {
      var content = datacells[i].innerHTML;
      var match = /^(\d{10})\/$/.exec(content);
      if (match) {
        times.push(Number(match[1]));
      }
    }
    if (times.length === 0) {
      return callback(new Error('No builds to find'));
    }
    return callback(null, Math.max.apply(Math, times));
  });
}

// Given a list of Gecko branches, figure out
// what the corresponding gecko branch is called
function findB2GVer (b2gGeckoRepos, b2gVer) {
  var mapping = {
    master: 'mozilla-central',
  };
  // Need to figure out how to handle the case where
  // a numbered gaia branch is aurora
  b2gGeckoRepos.forEach(function(e, idx) {
    var bits = e.split(/^releases\/mozilla-b2g\d+_?(.*)/);
    if (bits[1]) {
      var realB2GVer = bits[1].replace('_', '.');
      mapping[realB2GVer] = b2gGeckoRepos[idx];
    }
  });
  // This is a little hacky because we're assuming that
  // all versions of B2G that don't have a specific gecko
  // repo already are aurora.  I will live to regret this
  if (!mapping[b2gVer]) {
    console.log('NOTICE: using aurora because this non-master version of b2g doesn\'t have a gecko yet');
    return 'releases/mozilla-aurora';
  } else {
    return mapping[b2gVer];
  }
}

// Map a B2G Version, e.g. v1.3t, to a Gecko repo path, e.g. releases/mozilla-b2g28_v1_3t
function mapB2GVerToGeckoRepo(b2gVer, callback) {
  var potato = 'This hg.m.o document is a potato, not a directory listing';
  jsdom.env('http://hg.mozilla.org/releases', function(err, window) {
    if (err) {
      return callback(new Error(potato));
    }
    var names = ['mozilla-central', 'mozilla-aurora'];
    var datacells = window.document.querySelectorAll('table>tr>td:not(th):not(tf):first-child>a[href^="/releases/mozilla-b2g"]');
    if (datacells.length < 1) {
      return callback(new Error(potato));
    }

    for (var i = 0; i < datacells.length; i++) {
      var content = datacells[i].href;
      var match = /^http[s]?:\/\/hg.mozilla.org\/(releases\/.*)\/$/g.exec(content);
      if (match) {
        names.push(match[1]);
      }
    }

    if (names.length === 0) {
      return callback(new Error(potato));
    }
    return callback(null, findB2GVer(names, b2gVer));
  });
}

// I should write a fuzzURL function that checks for one version
// higher if the url isn't found
// I recommend writing tests against:
//  * getURLs('v1.4', 'linux-x86_64',
//  * getURLs('v1.3t', 'linux-x86_64',
//  * getURLs('v2.0', 'linux-x86_64',
//  * getURLs('master', 'linux-x86_64',
function getURLs(b2gVer, platform, callback) {
  var buildURL;
  var testsURL;
  mapB2GVerToGeckoRepo(b2gVer, function (err, repoPath) {
    var branch = repoPath;
    var branchBits = branch.split('/');
    var ftpBranch = branchBits[branchBits.length - 1];
    var opts = {
      branch: ftpBranch,
      bbPlatform: realPlatformToBB[platform],
      findingLatest: true,
    };
    if (err) {
      return callback(err);
    }
    buildBundleURL(opts, function (err, dURL) {
      if (err) {
        return callback(err);
      }
      getLatestDirNum(dURL, function (err, latestDir) { 
        if (err) {
          return callback(err);
        }
        geckoVersion({repoPath: branch}, function (err, version) {
          if (err) {
            return callback(err);
          }
          opts.findingLatest = false;
          opts.version = version;
          opts.branch = ftpBranch;
          opts.platform = platform;
          opts.timestamp = latestDir;
          opts.fileSuffix = platformToSuffix[platform];
          buildBundleURL(opts, function(err, bURL) {
            if (err) {
              return callback(err);
            }
            buildURL = bURL;
            opts.fileSuffix = '.tests.zip';
            buildBundleURL(opts, function(err, tURL) {
              if (err) {
                return callback(err);
              }
              testsURL = tURL;
              return callback(null, {installer_url: buildURL, test_url: testsURL});
            });
          });
        });
      });
    });
  });
}

module.exports = {
  geckoVersion: geckoVersion,
  checkURL: checkURL,
  buildBundleURL: buildBundleURL,
  getURLs: getURLs,
  mapB2GVerToGeckoRepo: mapB2GVerToGeckoRepo
}
