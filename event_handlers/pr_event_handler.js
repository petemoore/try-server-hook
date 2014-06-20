"use strict";

var util = require('util');
var when = require('when');
var debug = require('debug')('try-server-hook:pr_event_handler');
var platformFiles = require('../misc/platform_files.js');
var fork = require('child_process').fork;
var path = require('path');

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

PREventHandler.prototype.name = 'Incoming Github API Message';
PREventHandler.prototype.parse = function (msg) {
  var pr = {};
  var upstream_pr = msg.content.pull_request;
  pr.type = 'pull_request';
  pr.action = msg.content.action;
  pr.number = msg.content.number;
  pr.who = msg.content.sender.login;
  //pr.base_owner = upstream_pr.base.repo.owner.login;
  //pr.base_name = upstream_pr.base.repo.name;
  pr.base_label = upstream_pr.base.label;
  pr.base_git_url = upstream_pr.base.repo.git_url;
  pr.base_clone_url = upstream_pr.base.repo.clone_url
  pr.base_sha = upstream_pr.base.sha;
  pr.base_ref = upstream_pr.base.ref;
  pr.pr_label = upstream_pr.head.label;
  pr.pr_git_url = upstream_pr.head.repo.git_url;
  pr.pr_clone_url = upstream_pr.head.repo.clone_url;
  pr.pr_sha = upstream_pr.head.sha;
  pr.pr_ref = upstream_pr.head.ref;
  //pr.pr_owner = upstream_pr.head.repo.owner.login;
  //pr.pr_name = upstream_pr.head.repo.name;
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


PREventHandler.prototype.handle = function (msg, callback) {
  if (!this.interesting(msg)) {
    debug('Ignoring uninteresting event');
    return callback(null);
  }

  try {
    var pr = this.parse(msg);
  } catch(err) {
    debug('Failed to parse Github message');
    return callback(err, false);
  }

  var child = fork(path.join(__dirname, '../misc/find_platform_files.js'));
  
  child.once('error', function(err) {
    debug('Error while talking to child process that figures out building platform json files');
    callback(err);
  });

  child.once('message', function(msg) {
    child.kill();
    if (msg.err) {
      callback(err);
    }
    debug('Fetched platform file values for %s', pr.base_ref);
    var commitMsg = util.format('Gaia PR#%d: %s <-- %s', pr.number, pr.base_label, pr.pr_label);
    var user = pr.who;
    var contents = msg.contents;
    contents['gaia.json'] = jsonForPR(pr);
    return callback(null, null, {user: user, commit_message: commitMsg, contents: contents, pr: pr});
  })

  try {
    child.send(pr.base_ref);
  } catch (err) {
    callback(err);
  }

/*
  var commitMsg = util.format('Gaia PR#%d: %s <-- %s', pr.number, pr.base_label, pr.pr_label);
  var user = pr.who;
  debug('About to fetch platform files for %s', pr.base_ref);
  platformFiles.all(pr.base_ref, function(err, contents) {
    if (err) {
      return callback(err, true);
    }
    debug('Fetched platform files for %s', pr.base_ref);
    contents['gaia.json'] = jsonForPR(pr);
    return callback(null, null, {user: user, commit_message: commitMsg, contents: contents, pr: pr});
  });
*/
};

module.exports = PREventHandler;
