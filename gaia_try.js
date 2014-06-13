var fs = require('fs');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var hg = require('hg');
var temp = require('temp');
var util = require('util');
var rimraf = require('rimraf');
var exec = require('child_process').exec;

var hgId = require('./hg_id');


var SSH_USER = process.env.SSH_USER || 'gaiabld';
var SSH_KEY = process.env.SSH_KEY || '~/.ssh/user_rsa';
var SSH_CMD = process.env.SSH_CMD || util.format('ssh -i %s -l %s', SSH_KEY, SSH_USER);
var HG_URL = process.env.HG_URL || 'ssh://hg.mozilla.org/integration/gaia-try';
//var HG_URL = process.env.HG_URL || 'ssh://hg.mozilla.org/users/jford_mozilla.com/gaia-try';

console.log('Using ' + SSH_CMD + ' to talk to ' + HG_URL);


function showHgOutput(output) {
  if (!output) {
    console.log('No HG Output');
    return
  }
  output.forEach(function (e) {
    var func = console.error;
    body = e.body.replace(/\n$/, '')
    // Output, Result, Debug, Error
    switch (e.channel) {
      case 'o':
      case 'r':
      case 'd':
        func = console.log;
        break;
    }
    func(body);
  });
}


function handleErr(repo, err, retry, callback) {
  console.log('Cleaning up ' + repo.path + ' after failure ' + err);
  rimraf(repo.path, function (rmrferr) {
    if (rmrferr) {
      console.warn('ERROR CLEANING UP ' + repo.path);
    }
    callback(err, retry);
  });
}


function commit(user, message, contents, callback) {
  var repoDir = temp.path({prefix: 'gaia-try-hg'});
  var gaiaJsonPath = path.join(repoDir, 'gaia.json');
  var commitOpts = {
    '--message': message,
    '--user': user
  }

  hg.clone(HG_URL, repoDir, {'--ssh': SSH_CMD}, function(err, output) {
    if (err) {
      console.log('Failed to clone ' + HG_URL); 
      return callback(err, true);
    };
    var repo = new hg.HGRepo(repoDir); // The convenience API sucks
    console.log('Cloned to ' + repoDir);
    showHgOutput(output);

    fs.writeFile(gaiaJsonPath, contents, function (err) {
      if (err) handleErr(repo, err, true, callback);
      console.log('Wrote new gaia.json to ' + gaiaJsonPath);
      showHgOutput(output);

      repo.commit(commitOpts, function (err, out) {
        showHgOutput(output);
        if (err) handleErr(repo, err, true, callback);
        console.log('Commit success');

        repo.push(HG_URL, {'--ssh': SSH_CMD, '--force': ''}, function(err, output) {
          if (err) handleErr(repo, err, true, callback);
          showHgOutput(output);
          hgId(repo, function (err, id) {
            if (err) handleErr(repo, err, false, callback);
            rimraf(repo.path, function(err) {
              if (err) {
                console.warn('Commit succedded, delete failed ' + err);
              }
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
