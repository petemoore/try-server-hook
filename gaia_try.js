'use strict';

var util = require('util');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var fs = require('fs');
var promisedFs = nodefn.liftAll(fs);

// I'd love for this to be lifted to a promised api
var hg = require('hg');
var temp = require('temp');
var rimraf = require('rimraf');

var config = require('./config');
var logging = require('./misc/logging');

var log = logging.setup(__filename);

// For now, we aren't using tmpfs backed storage because
// it's limited to 5mb on heroku
if (false) { 
  var tmpDir = fs.existsSync('/dev/shm') ? '/dev/shm/' : undefined;
}
  

function showHgOutput(output) {
  return when.promise(function(resolve) {
    if (!output) {
      resolve(true);
    }
    output.forEach(function(e) {
      log.trace(e.body.replace(/\n$/, ''));
    });
    resolve(true);
  });
}


// We're assuming output like this:
/*
[ { channel: 'o',
    length: 40,
    body: 'd235f11748f18837088cd1f0c0f84ed6df3def2c' },
  { channel: 'r', length: 4, body: '' } ]
*/
function hgId(repo, callback) {

  if (!repo || !repo.path) {
    return callback(new Error('Repo object is malformed'));
  }
  repo.log({'--limit': 1, '--template': '{node}'}, function (err, output) {
    var id;
    if (err) {
      log.error(err, "Trying to run hg log on new commit");
      return callback(err);
    }
    if (output.length != 2) {
      return callback(new Error('Incorrect amount of output for hgId'));
    } else if (output[0].channel !== 'o') {
      return callback(new Error('Output from hgId should be on stdout'));
    } else if (output[0].length !== 40 || output[0].body.length !== 40) {
      return callback(new Error('Node for hgId ought to be 40 chars'));
    } else if (output[1].body.length !== 0) {
      return callback(new Error('Expected extraneous output differs from expected content'));
    }
    id = output[0].body;
    log.debug('HG id: ' + id);
    return callback(null, id);
  });
}


function handleErr(repo, err, retry, output, callback) {
  log.error(err, 'Failed to run hg command');
  showHgOutput(output);
  log.debug('Cleaning up ' + repo.path + ' after failure');
  rimraf(repo.path, function (rmrferr) {
    if (rmrferr) {
      log.error(rmrferr, 'Failed to clean up %s', repo.path);
    }
    return callback(err, retry);
  });
}

// This function should be altered to:
//  * not use fs.existsSync
//  * use promisedFs.exists
function writeFiles(directory, contents) {
  var files = Object.keys(contents);
  var promises = [];
  var newFiles = [];
  files.forEach(function(fileName) {
      var fullFileName = path.join(directory, fileName);
      // Ugh.  This should really use the promise interface
      if (!fs.existsSync(fullFileName)) {
        log.debug('Found new file %s', fileName);
        newFiles.push(fileName);
      }
      var stringToWrite = contents[fileName];
      if (typeof stringToWrite === 'object') {
        stringToWrite = JSON.stringify(stringToWrite, null, '  ');
      }
      promises.push(promisedFs.writeFile(fullFileName, stringToWrite));
  });
  return when.all(promises).then(function() { return when.resolve(newFiles)});
}


function commit(user, message, contents, callback) {
  var repoDir = temp.path({prefix: 'gaia-try-hg', dir: tmpDir});
  log.debug('Repository path is %s', repoDir);

  var commitOpts = {
    '--message': message,
    '--user': user
  }
  var sshCmd = util.format('ssh -i %s -l %s', 
                            config.get('HG_KEY'),
                            config.get('HG_USER'));
  var hgUrl = config.get('HG_REPOSITORY');

  log.info('Cloning %s to %s using %s', hgUrl, repoDir, sshCmd);

  hg.clone(hgUrl, repoDir, {'--ssh': sshCmd}, function(err, output) {
    if (err) {
      log.error(err, 'Failed to clone %s', hgUrl); 
      showHgOutput(output);
      return callback(err, true);
    };
    log.info('Cloned to %s', repoDir);
    var repo = new hg.HGRepo(repoDir); // The convenience API sucks
  
    writeFiles(repo.path, contents).then(function(newFiles) {
      log.info('Wrote repository contents to %s', Object.keys(contents).join(', '));
      repo.add(newFiles, function (err, output) {
        if (err) {
          log.error(err, 'Adding files to repository');
          rimraf(repo.path, function (rmerr) {
            log.error(rmerr);
          });
          return callback(err, true);
        }
        if (newFiles.length > 0) {
          log.debug('Added %s to repository', newFiles.join(', '));
        } else {
          log.debug('No files need to be added');
        }
        repo.commit(commitOpts, function(err, output) {
          if (err) {
            log.error(err, 'Commiting to repository');
            rimraf(repo.path, function (rmerr) {
              log.error(rmerr);
            });
            return callback(err, true);
          }
          log.debug('Committed to repository');
          repo.push(hgUrl, {'--ssh': sshCmd}, function(err, output) {
            if (err) {
              log.error(err, 'Pusing to repository');
              rimraf(repo.path, function (rmerr) {
                log.error(rmerr);
              });
              return callback(err, true);
            }
            log.info('Pushed to %s', hgUrl);
            hgId(repo, function(err, id) {
              if (err) {
                log.error(err, 'Identifying head');
                rimraf(repo.path, function (rmerr) {
                  log.error(rmerr);
                });
                return callback(err, true);
              }
              log.info('Created commit %s', id);
              rimraf(repo.path, function(err) {
                if(err) {
                  log.error(err, 'Cleanup failure in %s', repodir);
                }
                callback(null, null, id);
              });
            });
          });
        });
      });
    }).done();
  });
}


module.exports = {
  commit: commit,
  writeFiles: writeFiles,
}
