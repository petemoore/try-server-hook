"use strict";

var util = require('util');
var when = require('when');
var platformFiles = require('../misc/platform_files.js');
var fork = require('child_process').fork;
var path = require('path');
var github = require('../misc/githubapi');
var logging = require('../misc/logging');

var log = logging.setup(__filename);

var BaseEventHandler = require('./base_event');

function jsonForPR(pr) {
  var rando = Math.floor(Math.random() * 100000);
  var data = {
    git: {
      git_revision: pr.base_sha,
      remote: pr.base_clone_url,
      pr_git_revision: pr.pr_sha,
      pr_remote: pr.pr_clone_url,
      github_pr_number: pr.number
    },
    tryhook_raw: {
      notes: 'This data is here for debugging, not downstream use',
    }
  };
  data.tryhook_raw[rando] = pr;
  return JSON.stringify(data, null, '  ');
}

function PREventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(PREventHandler, BaseEventHandler);

PREventHandler.prototype.name = 'Incoming Github API Pull Request Message';
PREventHandler.prototype.parse = function (msg) {
  var pr = {};
  var upstreamPr = msg.content.pull_request;
  pr.type = 'pull_request';
  pr.action = msg.content.action;
  pr.number = msg.content.number;
  pr.who = msg.content.sender.login;
  pr.base_owner = upstreamPr.base.repo.owner.login;
  pr.base_name = upstreamPr.base.repo.name;
  pr.base_label = upstreamPr.base.label;
  pr.base_git_url = upstreamPr.base.repo.git_url;
  pr.base_clone_url = upstreamPr.base.repo.clone_url
  pr.base_sha = upstreamPr.base.sha;
  pr.base_ref = upstreamPr.base.ref;
  pr.pr_label = upstreamPr.head.label;
  pr.pr_git_url = upstreamPr.head.repo.git_url;
  pr.pr_clone_url = upstreamPr.head.repo.clone_url;
  pr.pr_sha = upstreamPr.head.sha;
  pr.pr_ref = upstreamPr.head.ref;
  pr.pr_owner = upstreamPr.head.repo.owner.login;
  pr.pr_name = upstreamPr.head.repo.name;
  return pr;
}

PREventHandler.prototype.interesting = function (msg) {
  if (msg && msg.type && msg.type === 'pull_request') {
    switch(msg.content.action) {
      case 'opened':
      case 'synchronize':
      case 'reopened':
        return true;
        break;
      default:
        return false;
    }
  }
  return false;
}

function makePrCommitMsg(number, baseLabel, prBranch, ghUser, callback) {
  github.user.getFrom({user: ghUser}, function(err, result) {
    var fullName;
    if (err) {
      log.error(err, 'API Call to figure out username has failed for %s', ghUser);
      fullName = undefined;
    } else {
      fullName = result.name;
    }
    var nameString = util.format('%s (%s)', fullName, ghUser);
    if (typeof fullName === 'undefined') {
      nameString = ghUser;
    }
    var commitMsg = util.format('Gaia PR#%d: %s %s <-- %s',
                          number, nameString, baseLabel, prBranch);
    return callback(null, commitMsg);
  });
}


PREventHandler.prototype.handle = function (msg, callback) {
  if (!this.interesting(msg)) {
    log.debug('Ignoring uninteresting event');
    return callback(null);
  }

  try {
    var pr = this.parse(msg);
  } catch(err) {
    log.error(err, 'Failed to parse Github message');
    return callback(err, false);
  }

  makePrCommitMsg(pr.number, pr.base_label, pr.pr_ref, pr.who, function(err, commitMsg) {
    var child = fork(path.join(__dirname, '../misc/find_platform_files.js'));
  
    child.once('error', function(err) {
      log.error(err, 'Error while talking to child process that figures out building platform json files');
      callback(err);
    });

    child.once('message', function(msg) {
      child.kill();
      if (msg.err) {
        return callback(msg.err, false);
      }
      if (!msg.contents) {
        return callback(new Error('Could not determine Gecko files'), false);
      }
      log.debug('Fetched platform file values for %s', pr.base_ref);
      var user = pr.who;
      var contents = msg.contents;
      contents['gaia.json'] = jsonForPR(pr);
      return callback(null, null, {user: user, commit_message: commitMsg, contents: contents, pr: pr});
    })
    
    try {
      child.send(pr.base_ref);
    } catch (err) {
      child.kill();
      callback(err, true);
    }
  });
};

module.exports = PREventHandler;
