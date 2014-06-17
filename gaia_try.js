"use strict";
var debug = require('debug')('try-server-hook:gaia_try');
var fs = require('fs');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var hg = require('hg');
var temp = require('temp');
var util = require('util');
var rimraf = require('rimraf');
var exec = require('child_process').exec;

var config = require('./config');
var hgId = require('./hg_id');


function showHgOutput(output) {
  if (!output) {
    debug('No HG Output');
    return
  }
  output.forEach(function (e) {
    debug(e.body.replace(/\n$/, ''));
  });
}


function handleErr(repo, err, retry, output, callback) {
  debug('Failed command output:');
  showHgOutput(output);
  debug('Cleaning up ' + repo.path + ' after failure ' + err);
  rimraf(repo.path, function (rmrferr) {
    if (rmrferr) {
      debug('Failed to clean up %s', repo.path);
    }
    callback(err, retry);
  });
}


function commit(user, message, contents, platformDict, callback) {
  var repoDir = temp.path({prefix: 'gaia-try-hg'});
  var gaiaJsonPath = path.join(repoDir, 'gaia.json');
  var commitOpts = {
    '--message': message,
    '--user': user
  }
  var ssh_cmd = util.format('ssh -i %s -l %s', 
                            config.get('HG_KEY'),
                            config.get('HG_USER'));
  var hg_url = config.get('HG_REPOSITORY');

  debug('Using %s to talk to %s', ssh_cmd, hg_url);

  hg.clone(hg_url, repoDir, {'--ssh': ssh_cmd}, function(err, output) {
    if (err) {
      debug('Failed to clone %s', hg_url); 
      showHgOutput(output);
      return callback(err, true);
    };
    var repo = new hg.HGRepo(repoDir); // The convenience API sucks
    debug('Cloned to %s', repoDir);
    fs.writeFile(gaiaJsonPath, contents, function (err) {
      if (err) handleErr(repo, err, true, callback);
      debug('Wrote new gaia.json to %s', gaiaJsonPath);

      repo.commit(commitOpts, function (err, output) {
        if (err) handleErr(repo, err, true, output, callback);
        debug('Commit success');
        repo.push(hg_url, {'--ssh': ssh_cmd, '--force': ''}, function(err, output) {
          if (err) handleErr(repo, err, true, output, callback);
          hgId(repo, function (err, id) {
            if (err) handleErr(repo, err, false, callback);
            rimraf(repo.path, function(err) {
              if (err) {
                debug('Commit succedded, delete failed ' + err);
              }
              debug('Created commit %s', id);
              callback(null, null, id);
            });
          });
        });
      });
    });
  });
}


module.exports = {
  commit: commit,
}
