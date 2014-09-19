'use strict';
// Note: Setting LOCAL_ONLY environment variable will disable tests which
// talk to real servers
var mocha = require('mocha');
var should = require('should');
var sinon = require('sinon');
var util = require('util');
var fs = require('fs');
var path = require('path');
var http = require('http');

var markupDir = path.join(__dirname, 'platform_files_test_markup');

// Bad HTML markup to test against DOM
var badMarkups = [
  '<html><body>OOGIEBOOGIEBYE</body></html>',
  '<html><html></html>',
  '<html><body><body></html></html>',
  '<P>HI</P',
];

// This is used in a couple places to mock out 
function readMarkup(name) {
  var raw = fs.readFileSync(path.join(markupDir, name));
  return raw.toString();
}

function readHeaders(name) {
  var raw = fs.readFileSync(path.join(markupDir, name + '.headers'));
  var lines = raw.toString().split('\n');
  var headers = {};
  lines.forEach(function(e) {
    var firstSemi = e.indexOf(':');
    if (firstSemi !== -1) {
      var headerName = e.slice(0, firstSemi);
      var headerVal = e.slice(firstSemi + 1).trim();
      headers[headerName] = headerVal;
    }
  });
  return headers;
}

var server = http.createServer();
var paths = {
  '/releases': {markup: readMarkup('releases'), headers: readHeaders('releases')},
};

var ftpNumberDirs = [
  'mozilla-aurora-linux32_gecko',
  'mozilla-b2g28_v1_3t-linux32_gecko',
  'mozilla-b2g30_v1_4-linux64_gecko',
  'mozilla-central-linux32_gecko',
];

ftpNumberDirs.forEach(function(e) {
  paths['/pub/mozilla.org/b2g/tinderbox-builds/' + e] = {
    markup: readMarkup(e),
    headers: readHeaders(e)
  };
});

server.on('request', function(req, res) {
  var info = paths[req.url.trim()]
  if (info) {
    res.writeHead(200, info.headers);
    res.end(info.markup);
  } else {
    res.writeHead(500, {});
    console.log(Object.keys(paths));
    console.log(req.url);
    res.end("nope!");
  }
});

// For stubs
var request = require('request');

var subject = require('../misc/platform_files');


describe('figuring out a gecko version', function() {
  var sandbox = sinon.sandbox.create();

  afterEach(function() {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    describe('against real servers', function () {
      // We want to make sure that real servers have a chance to respond
      this.timeout(10000);

      it('should work', function(done) {
        var opts = {
          repoPath: 'releases/mozilla-b2g18',
          host: 'hg.mozilla.org',
        };
        subject.geckoVersion(opts, function(err, version) {
          should.not.exist(err);
          version.should.equal('18.0');
          done(err);
        });
      });
    });
  }

  ['1.0', '1.0.0', '1.0b1', '1.0a1'].forEach(function(ver) {
    it(util.format('should determine that "%s\\n" is "%s"', ver, ver), function(done) {
      var stub = sandbox.stub(request, 'get');
      stub.callsArgWithAsync(1, null, null, ver + '\n');
      subject.geckoVersion({}, function(err, version) {
        should.not.exist(err);
        version.should.equal(ver);
        done(err);
      });
    });
  });

  it('should invoke callback with error when the request fails', function(done) {
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, new Error('Failed'), null, null);
    subject.geckoVersion({}, function(err, version) {
      err.should.be.an.Error;
      done();
    });
        
  });

  ['1', '1b1', 'abcde'].forEach(function(ver) {
    it(util.format('should fail on %s', ver), function(done) {
      var stub = sandbox.stub(request, 'get');
      stub.callsArgWithAsync(1, null, null, ver + '\n');
      subject.geckoVersion({}, function(err, version) {
        err.should.be.an.Error;
        done();
      });
    });
  });
});


describe('checking a Url', function () {
  var sandbox = sinon.sandbox.create();

  afterEach(function() {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    this.timeout(10000);
    describe('against real servers', function() {
      it('should return true when the status code is successful', function (done) {
        subject.checkUrl('http://www.mozilla.org', function (result) {
          result.should.be.a.Boolean;
          result.should.be.true;
          done();
        });
      });

      it('should return false when the status code is not successful', function (done) {
        subject.checkUrl('http://www.mozilla.org/does-not-exist', function (result) {
          result.should.be.a.Boolean;
          result.should.be.false;
          done();
        });
      });
    });
  }

  it('should return true for a resource that is present', function (done) {
    var stub = sandbox.stub(request, 'head');
    stub.callsArgWithAsync(1, null, {statusCode: 200}, "");
    subject.checkUrl('fake', function (result) {
      result.should.be.a.Boolean;
      result.should.be.true;
      done();
    });
  });

  it('should return false for a resource that is unreachable', function (done) {
    var stub = sandbox.stub(request, 'head');
    stub.callsArgWithAsync(1, null, {statusCode: 301}, "");
    subject.checkUrl('fake', function (result) {
      result.should.be.a.Boolean;
      result.should.be.false;
      done();
    });
  });

  it('should return false for an internal request lib error', function (done) {
    var stub = sandbox.stub(request, 'head');
    stub.callsArgWithAsync(1, new Error('hi'), {statusCode: 200}, "");
    subject.checkUrl('fake', function (result) {
      result.should.be.a.Boolean;
      result.should.be.false;
      done();
    });
  });
});


describe('fetching a Url', function () {
  var sandbox = sinon.sandbox.create();

  afterEach(function() {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    this.timeout(10000);
    describe('against real servers', function() {
      it('should return true when the status code is successful', function (done) {
        subject.fetchUrl('http://www.mozilla.org', function (err, result) {
          should.not.exist(err);
          result.should.containEql('html');
          done(err);
        });
      });

      it('should return false when the status code is not successful', function (done) {
        subject.fetchUrl('http://www.mozilla.org/does-not-exist', function (err, result) {
          err.should.be.an.Error;
          done();
        });
      });
    });
  }

  it('should return true for a resource that is present', function (done) {
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, null, {statusCode: 200}, "ohai");
    subject.fetchUrl('fake', function (err, result) {
      should.not.exist(err);
      result.should.eql("ohai");
      done(err);
    });
  });

  it('should return false for a resource that is unreachable', function (done) {
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, null, {statusCode: 301}, "");
    subject.fetchUrl('fake', function (err, result) {
      err.should.be.an.Error;
      done();
    });
  });

  it('should return false for an internal request lib error', function (done) {
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, new Error('hi'), {statusCode: 200}, "");
    subject.fetchUrl('fake', function (err, result) {
      err.should.be.an.Error;
      done();
    });
  });
});


describe('building Ftp urls', function () {
  var sandbox = sinon.sandbox.create();

  afterEach(function () {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    describe('against real servers', function () {
      this.timeout(10000);
      it('should build a valid latest directory', function(done) {
        var opts = {
          findingLatest: true,
          bbPlatform: 'linux64_gecko'
        };
        subject.buildFtpUrl(opts, function (err, url) {
          should.not.exist(err);
          var e = 'https://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-central-linux64_gecko'
          url.should.equal(e);
          done(err);
        });
      });
    });
  }

  describe('for urls that don\'t point to a resource', function() {
    beforeEach(function() {
      var stub = sandbox.stub(request, 'head');
      stub.callsArgWithAsync(1, new Error('hi'), {statusCode: 200}, "");
    });

    it('should result in an error', function(done) {
      subject.buildFtpUrl({findingLatest: true}, function(err, url) {
        err.should.be.an.Error;
        done();
      });
    });
  });

  describe('without checking for existence', function() {
    beforeEach(function() {
      var stub = sandbox.stub(request, 'head');
      stub.callsArgWithAsync(1, null, {statusCode: 200}, "");
    });

    it('should build a latest directory with defaults', function(done) {
      subject.buildFtpUrl({findingLatest: true}, function(err, url) {
        should.not.exist(err);
        var e = 'https://ftp.mozilla.org/pub/mozilla.org/b2g/' +
                'tinderbox-builds/mozilla-central-linux64_gecko';
        url.should.equal(e);
        done(err);
      });
    });

    it('should build a full url with defaults', function(done) {
      subject.buildFtpUrl({}, function(err, url) {
        should.not.exist(err);
        var e = 'https://ftp.mozilla.org/pub/mozilla.org/b2g/' +
                'tinderbox-builds/mozilla-central-linux64_gecko/' +
                'latest/en-US/b2g-999a1.en-US.linux-x86_64';
        url.should.equal(e);
        done(err);
      });
    });

    it('should build a gecko URL by specifying everything', function(done) {
      var opts = {
        protocol: 'ftp',
        host: 'server',
        port: 8080,
        branch: 'branch',
        bbPlatform: 'bbplat',
        ftpProduct: 'ftpprod',
        timestamp: '1234567890',
        locale: 'en-CA',
        product: 'phone',
        version: '123a1',
        platform: 'platform',
        fileSuffix: '.junk',
      };
      subject.buildFtpUrl(opts, function(err, url) {
        should.not.exist(err);
        var e = 'ftp://server:8080/pub/mozilla.org/ftpprod/' +
                'tinderbox-builds/branch-bbplat/1234567890/' +
                'en-CA/phone-123a1.en-CA.platform.junk';
        url.should.equal(e);
        done(err);
      });
    });
    
    it('should build a gecko URL by specifying everything and skipping the localeSubDir', function(done) {
      var opts = {
        protocol: 'ftp',
        host: 'server',
        port: 8080,
        branch: 'branch',
        bbPlatform: 'bbplat',
        ftpProduct: 'ftpprod',
        timestamp: '1234567890',
        locale: 'en-CA',
        product: 'phone',
        version: '123a1',
        platform: 'platform',
        fileSuffix: '.junk',
        skipLocaleDir: true,
      };
      subject.buildFtpUrl(opts, function(err, url) {
        should.not.exist(err);
        var e = 'ftp://server:8080/pub/mozilla.org/ftpprod/' +
                'tinderbox-builds/branch-bbplat/1234567890/' +
                'phone-123a1.en-CA.platform.junk';
        url.should.equal(e);
        done(err);
      });
    });

    it('should build a latest directory by specifying everything', function(done) {
      var opts = {
        findingLatest: true,
        protocol: 'ftp',
        host: 'server',
        port: 8080,
        branch: 'branch',
        bbPlatform: 'bbplat',
        ftpProduct: 'ftpprod',
      };
      subject.buildFtpUrl(opts, function(err, url) {
        should.not.exist(err);
        var e = 'ftp://server:8080/pub/mozilla.org/ftpprod/' +
                'tinderbox-builds/branch-bbplat';
        url.should.equal(e);
        done(err);
      });
    });
  });
});





describe('figuring out the lastest directory number', function() {
  var sandbox = sinon.sandbox.create();

  afterEach(function () {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    describe('against a real server', function() {
      it('should find a directory for linux-x86_64 on mozilla-central', function(done) {
        var loc = 'https://ftp.mozilla.org/pub/mozilla.org/b2g/' +
                  'tinderbox-builds/mozilla-central-linux64_gecko';
        subject.getLatestDirNum(loc, function(err, dirName) {
          should.not.exist(err);
          dirName.should.be.a.Number;
          dirName.should.match(/^[0-9]{4,}$/);
          done(err);
        });
      });

      it('should error when no builds are present', function(done) {
        var loc = 'https://ftp.mozilla.org/pub/mozilla.org/b2g/' +
                  'tinderbox-builds/mozilla-b2g18-linux64_gecko';
        subject.getLatestDirNum(loc, function(err, dirName) {
          err.should.be.an.Error;
          done();
        });
      });
    });
  }

  it('should give valid data when builds exist', function(done) {
    var markup = readMarkup('mozilla-central-linux32_gecko');
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, null, {statusCode: 200}, markup);
    subject.getLatestDirNum('http://www.mozilla.org', function(err, result) {
      done(err);   
    });
  });

  it('should error when builds do not exist', function(done) {
    var markup = readMarkup('mozilla-b2g28_v1_3t-linux32_gecko');
    var stub = sandbox.stub(request, 'get');
    stub.callsArgWithAsync(1, null, {statusCode: 200}, markup);
    subject.getLatestDirNum('http://www.mozilla.org', function(err, result) {
      err.should.be.an.Error;
      done();
    });
  });

  badMarkups.forEach(function(badMarkup, i) {
    it('should error when markup is crazy version ' + (i + 1), function(done) {
      var stub = sandbox.stub(request, 'get');
      stub.callsArgWithAsync(1, null, {statusCode: 200}, badMarkup);
      subject.getLatestDirNum('http://www.mozilla.org', function(err, result) {
        err.should.be.an.Error;
        done();
      });
    });
  });

});


describe('determine which in a list of gecko repo names is a given b2g version', function () {
  // Made up version numbers
  var b2gRepos = [
    'mozilla-central',
    'releases/mozilla-b2g32_v1_5',
    'releases/mozilla-b2g33_v1_6d',
  ];

  it('should give mozilla-central for master', function() {
    subject.findB2GVer(b2gRepos, 'master').should.equal('mozilla-central');
  });

  it('should give releases/mozilla-b2g32_v1_5 for v1.5', function() {
    subject.findB2GVer(b2gRepos, 'v1.5').should.equal('releases/mozilla-b2g32_v1_5');
  });

  it('should give releases/mozilla-b2g33_v1_6d for v1.6d', function() {
    subject.findB2GVer(b2gRepos, 'v1.6d').should.equal('releases/mozilla-b2g33_v1_6d');
  });

  it('should give releases/mozilla-aurora for unknown 2.0 branch', function() {
    subject.findB2GVer(b2gRepos, 'v2.0').should.equal('releases/mozilla-aurora');
  });

  it('should give releases/mozilla-b2g34_v2_0 now that it knows about 2.0', function() {
    var with2 = b2gRepos.slice();
    with2.push('releases/mozilla-b2g34_v2_0');
    subject.findB2GVer(with2, 'v2.0').should.equal('releases/mozilla-b2g34_v2_0');
  });
});




describe('determine which gecko repo path belongs to a given b2g version', function() {
  var sandbox = sinon.sandbox.create();

  afterEach(function() {
    sandbox.restore();
  });

  if (!process.env.LOCAL_ONLY) {
    describe('against real servers', function () {
      it('should find that master branch uses mozilla-central', function (done) {
        subject.mapB2GVerToGeckoRepo('master', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('mozilla-central');
          done(err);
        });
      });

      it('should find that v1.4 branch uses releases/mozilla-b2g30_v1_4', function (done) {
        subject.mapB2GVerToGeckoRepo('v1.4', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('releases/mozilla-b2g30_v1_4');
          done(err);
        });
      });

      it('should assume mozilla-aurora for unknown b2g versions', function (done) {
        subject.mapB2GVerToGeckoRepo('nevergonnaletyoudown', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('releases/mozilla-aurora');
          done(err);
        });
      });
    });
  }

  var markup = readMarkup('releases');

  describe('with valid data', function() {
    before(function() {
      var stub = sandbox.stub(request, 'get');
      stub.callsArgWithAsync(1, null, {statusCode: 200}, markup);
    });


    ['cached', 'noncached'].forEach(function(e) {
      it('should find that master branch uses mozilla-central ' + e, function (done) {
        subject.mapB2GVerToGeckoRepo('master', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('mozilla-central');
          done(err);
        });
      });

      it('should find that v1.4 branch uses releases/mozilla-b2g30_v1_4', function (done) {
        subject.mapB2GVerToGeckoRepo('v1.4', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('releases/mozilla-b2g30_v1_4');
          done(err);
        });
      });

      it('should assume mozilla-aurora for unknown b2g versions', function (done) {
        subject.mapB2GVerToGeckoRepo('nevergonnaletyoudown', function(err, repoPath) {
          should.not.exist(err); 
          repoPath.should.equal('releases/mozilla-aurora');
          done(err);
        });
      });
    });
  });
});
