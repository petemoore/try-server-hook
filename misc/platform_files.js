'use strict';

var url = require('url');
var async = require('async');
var request = require('request');
var util = require('util');
var jsdom = require('jsdom');
var logging = require('./logging');

var log = logging.setup(__filename);

var bbToRealPlatform = {
  'linux32_gecko': 'linux-i686',
  'linux64_gecko': 'linux-x86_64',
  'linux64': 'linux-x86_64',
  'linux64_gecko-debug': 'linux-x86_64',
  'macosx64_gecko': 'mac64',
};

var platformToSuffix = {
  'linux-i686': '.tar.bz2',
  'linux-x86_64': '.tar.bz2',
  'mac64': '.dmg'
};

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
  var versionUrl = url.format(urlObj);
  log.debug('Getting version from %s', versionUrl);
  request.get(versionUrl, function (err, response, body) {
    if (err) {
      log.error(err, 'Getting version from %s', versionUrl);
      return callback(err);
    }
    var match = /^((\d+)\.{0,1})+(\d+)([ab]?\d+)?$/gm.exec(body);
    if (!match) {
      return callback(new Error(util.format('%s is not a valid version number', body)));
    }
    var version = match[0].replace(/\s+$/, '');
    log.debug('Version is %s', version);
    return callback(null, match[0]);
  });
}

// Check if a Url points to an existing resource
function checkUrl(urlToCheck, callback) {
  var reqOpts = {
    url: urlToCheck,
    headers: {
      'User-Agent': 'try-server-hook (gaia)',
      'Connection': 'close'
    },
  }
  log.debug('Checking Url: %s', urlToCheck);
  request.head(reqOpts, function (err, response, body) {
    if (err) {
      return callback(false);
    } else {
      return callback(response.statusCode >= 200 && response.statusCode < 300);
    }
  });
}

// Fetch a Url's eventual body
function fetchUrl(urlToFetch, callback) {
  var reqOpts = {
    url: urlToFetch,
    headers: {
      'User-Agent': 'try-server-hook (gaia)',
    },
  }
  log.debug('Fetching Url: %s', urlToFetch);
  request.get(reqOpts, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return callback(null, body);
    } else {
      return callback(new Error('Invalid response from server'));
    }

  });
}

// Build the Url for a bundle, optionally only the part of the
// url that points to the directory before the timestamp dir
function buildFtpUrl(options, callback) {
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
    util.format('%s-%s', options.branch || 'mozilla-central', options.bbPlatform || 'linux64_gecko'),
  ];
  if (!options.findingLatest) {
    path.push(options.timestamp || 'latest');
    if (!options.skipLocaleDir) {
      path.push(options.locale || 'en-US');
    }
    [
      util.format('%s-%s.%s.%s%s',
          options.product || 'b2g',
          options.version || '999a1',
          options.locale || 'en-US',
          options.platform || 'linux-x86_64',
          options.fileSuffix || '')
    ].forEach(function(e) { path.push(e)});
  }
  urlObj.pathname = path.join('/');
  var bundleUrl = url.format(urlObj);
  log.debug('Built Url: %s', bundleUrl);
  checkUrl(bundleUrl, function(there) {
    if (!there) {
      return callback(new Error('Url created but not there: ' + bundleUrl));
    }
    return callback(null, bundleUrl);
  });
}

// Determine the latest directory.  This is a unix timestamp representing
// the most recent gecko upload
function getLatestDirNum(loc, callback) {
  var potato = 'This ' + loc + ' document is a potato, not a directory listing';
  fetchUrl(loc, function(err, body) {
    if (err) {
      return callback(err);
    }

    try {
      jsdom.env(body, function(err, window) {
        log.debug('Created dom for %s:', loc);
        if (err) {
          return callback(new Error(potato));
        }
        var times = []; 
        var selector = 'table>tr>td:not(th):not(tf):nth-child(2)>a[href^="1"]'
        try {
          var datacells = window.document.querySelectorAll(selector);
        } catch (e) {
          return callback(new Error('Could not query the selector'));
        }
        if (datacells.length < 0) {
          log.debug('Query selector failed, has markup changed?');
          window.close();
          return callback(new Error('No potential builds to find'), false);
        }

        for (var i = 0; i < datacells.length; i++) {
          var content = datacells[i].innerHTML;
          var match = /^(\d{10})\/$/.exec(content);
          if (match) {
            times.push(Number(match[1]));
          }
        }
        if (times.length === 0) {
          window.close();
          return callback(new Error('No builds to find'));
        }
        window.close();
        return callback(null, Math.max.apply(Math, times));
      });
    } catch (e) {
      return callback(e);
    }
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
    // this should really deal with leading backslash
    var bits = e.split(/^releases\/mozilla-b2g\d+_?(.*)/);
    if (bits[1]) {
      var realB2GVer = bits[1].replace('_', '.');
      mapping[realB2GVer] = b2gGeckoRepos[idx];
    }
  });
  // This is a little hacky because we're assuming that
  // all versions of B2G that don't have a specific gecko
  // repo already are aurora.  I will live to regret this
  var geckoBranch;
  if (!mapping[b2gVer]) {
    log.debug('Using aurora because this non-master version of b2g doesn\'t have a gecko yet');
    geckoBranch = 'releases/mozilla-aurora';
  } else {
    geckoBranch = mapping[b2gVer];
  }
  log.debug('Found gecko branch: %s', geckoBranch);
  return geckoBranch;
}

// We can safely cache this data
var b2gVersionCache = {
  master: 'mozilla-central',
};

// Map a B2G Version, e.g. v1.3t, to a Gecko repo path, e.g. releases/mozilla-b2g28_v1_3t
function mapB2GVerToGeckoRepo(b2gVer, callback) {
  // These values are immutable, so let's just cache them!
  if (b2gVersionCache[b2gVer]) {
    return callback(null, b2gVersionCache[b2gVer]);
  }

  var potato = 'This hg.m.o document is a potato, not a directory listing';
  jsdom.env('http://hg.mozilla.org/releases', function(err, window) {
    log.debug('Built dom for repository mapping');
    if (err) {
      return callback(new Error(potato));
    }
    var names = ['mozilla-central', 'mozilla-aurora'];
    
    var datacells = window.document.querySelectorAll('table>tr>td:not(th):not(tf):first-child>a[href^="/releases/mozilla-b2g"]');
    if (datacells.length < 1) {
      window.close();
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
      window.close();
      return callback(new Error(potato));
    }
    window.close();
    var geckoRepoPath = findB2GVer(names, b2gVer)
    if (geckoRepoPath !== 'releases/mozilla-aurora') {
      b2gVersionCache[b2gVer] = geckoRepoPath;
    }
    return callback(null, geckoRepoPath);
  });
}

// I should write a fuzzUrl function that checks for one version
// higher if the url isn't found
// I recommend writing tests against:
//  * getUrls('v1.4', 'linux-x86_64',
//  * getUrls('v1.3t', 'linux-x86_64',
//  * getUrls('v2.0', 'linux-x86_64',
//  * getUrls('master', 'linux-x86_64',
function getUrls(b2gVer, bbPlatform, callback) {
  var buildUrl;
  var testsUrl;
  mapB2GVerToGeckoRepo(b2gVer, function (err, repoPath) {
    if (err) {
      return callback(err);
    }
    var branch = repoPath;
    var branchBits = branch.split('/');
    var ftpBranch = branchBits[branchBits.length - 1];
    var opts = {
      branch: ftpBranch,
      bbPlatform: bbPlatform,
      findingLatest: true,
    };
    if (bbPlatform.indexOf('gecko') <= -1) {
      opts.ftpProduct = 'firefox';
      opts.product = 'firefox';
      opts.skipLocaleDir = true;
    }
    var platform = bbToRealPlatform[bbPlatform];
    log.debug('%s has repo path of %s', b2gVer, repoPath);
    buildFtpUrl(opts, function (err, dUrl) {
      if (err) {
        return callback(err);
      }
      log.debug('Timestamp directory is %s', dUrl);
      getLatestDirNum(dUrl, function (err, latestDir) { 
        if (err) {
          return callback(err);
        }
        log.debug('Latest build dir is %s', latestDir);
        geckoVersion({repoPath: branch}, function (err, version) {
          if (err) {
            return callback(err);
          }
          log.debug('Gecko version is %s', version);
          opts.findingLatest = false;
          opts.version = version;
          opts.branch = ftpBranch;
          opts.platform = platform;
          opts.timestamp = latestDir;
          opts.fileSuffix = platformToSuffix[platform];
          buildFtpUrl(opts, function(err, bUrl) {
            log.debug('Browser Url for %s with %s is %s', bbPlatform, b2gVer, bUrl);
            if (err) {
              return callback(err);
            }
            buildUrl = bUrl;
            opts.fileSuffix = '.tests.zip';
            buildFtpUrl(opts, function(err, tUrl) {
              log.debug('Tests Url for %s with %s is %s', b2gVer, bbPlatform, tUrl);
              if (err) {
                return callback(err);
              }
              testsUrl = tUrl;
              return callback(null, {installer_url: buildUrl, test_url: testsUrl});
            });
          });
        });
      });
    });
  });
}

var data = {}



function all(b2gVer, callback) {
  if (data[b2gVer]) {
    return callback(null, data[b2gVer]);
  }

  function x(platform, callback) {
    getUrls(b2gVer, platform, function (err, data) {
      if (err) {
        return callback(err);
      }
      return callback(null, data);
    });
  }
  var allFiles = {};
  var platforms = Object.keys(bbToRealPlatform);
  async.map(platforms, x, function(err, results) {
    if (err) {
      return callback(err);
    }
    results.forEach(function(e,idx) {
      var platformName = platforms[idx];
      var key;
      if (platformName.indexOf('gecko') <= -1) {
        key = 'firefox-' + platformName + '.json';
      } else {
        key = platforms[idx].replace(/_gecko(-debug)?$/,'$1') + '.json'
      }
      allFiles[key] = e;
    });
    data[b2gVer]= allFiles;
    return callback(null, allFiles);
  });

}

module.exports = {
  geckoVersion: geckoVersion,
  checkUrl: checkUrl,
  fetchUrl: fetchUrl,
  buildFtpUrl: buildFtpUrl,
  getLatestDirNum: getLatestDirNum,
  getUrls: getUrls,
  findB2GVer: findB2GVer,
  mapB2GVerToGeckoRepo: mapB2GVerToGeckoRepo,
  all: all
}
