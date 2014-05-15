var fs = require('fs');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var hg = require('hg');
var temp = require('temp');
var util = require('util');
var rimraf = require('rimraf');
var exec = require('child_process').exec;

var eventPr = require('../event_gaia_try');
var hgId = require('./hg_id');


var SSH_USER = process.env.SSH_USER || 'gaiabld';
var SSH_KEY = process.env.SSH_KEY || '~/.ssh/user_rsa';
var SSH_CMD = process.env.SSH_CMD || util.format('ssh -i %s -l %s', SSH_KEY, SSH_USER);
var HG_URL = process.env.HG_URL || 'ssh://hg.mozilla.org/integration/gaia-try';

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


function createJson(pr) {
  var rando = Math.floor(Math.random() * 100000);
  var data = {
    git: {
      git_revision: 'replacedByPrNumber',
      remote: pr.base_clone_url,
      github_pr_number: pr.number
    },
    tryhook_raw: {
      notes: 'This data is here for debugging, not downstream use',
    }
  };
  data.tryhook_raw[rando] = pr;
  return JSON.stringify(data, null, '  ');
}


function handleErr(repo, err, callback) {
  console.log('Cleaning up ' + repo.path + ' after failure ' + err);
  rimraf(repo.path, function (rmrferr) {
    if (rmrferr) {
      console.warn('ERROR CLEANING UP ' + repo.path);
    }
    callback(err);
  });
}


function run(pr, callback) {
  if (!eventPr.validate(pr)) {
    return callback(new Error('Invalid pull request, cannot create a repository'));
  }
  var repoDir = temp.path({prefix: 'gaia-try-hg'});
  var gaiaJsonPath = path.join(repoDir, 'gaia.json');
  var commitOpts = {
    '--message': util.format('Gaia PR#%d: %s <-- %s',
                    pr.number, pr.base_label, pr.pr_label),
    '--user': pr.who
  }
  var jsonData = createJson(pr); 

  hg.clone(HG_URL, repoDir, {'--ssh': SSH_CMD}, function(err, output) {
    if (err) {
      console.log('Failed to clone ' + HG_URL); 
      return callback(err);
    };
    var repo = new hg.HGRepo(repoDir); // The convenience API sucks
    console.log('Cloned to ' + repoDir);
    showHgOutput(output);

    fs.writeFile(gaiaJsonPath, jsonData, function (err) {
      if (err) handleErr(repo, err, callback);
      console.log('Wrote new gaia.json to ' + gaiaJsonPath);
      showHgOutput(output);

      repo.commit(commitOpts, function (err, out) {
        showHgOutput(output);
        if (err) handleErr(repo, err, callback);
        console.log('Commit success');

        repo.push(HG_URL, {'--ssh': SSH_CMD, '--force': ''}, function(err, output) {
          if (err) handleErr(repo, err, callback);
          showHgOutput(output);
          hgId(repo, function (err, id) {
            if (err) handleErr(repo, err, callback);
            rimraf(repo.path, function(err) {
              if (err) {
                console.warn('ERROR REPO ON SUCCESS: ' + err);
              }
              callback(null, id);
            });
          });
        });
      });
    });
  });
}


module.exports = {
  run: run,
}
