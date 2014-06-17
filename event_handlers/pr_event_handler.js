"use strict";

var util = require('util');

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

PREventHandler.prototype = Object.create(BaseEventHandler.prototype);
PREventHandler.prototype.constructor = PREventHandler;

PREventHandler.prototype.name = 'Incoming Pull Request';
PREventHandler.prototype.parse = function (msg) {
  var pr = {};
  var upstream_pr = msg.content.pull_request;
  pr.type = 'pull_request';
  pr.action = msg.content.action;
  pr.number = msg.content.number;
  pr.who = msg.content.sender.login;
  pr.base_owner = upstream_pr.base.repo.owner.login;
  pr.base_name = upstream_pr.base.repo.name;
  pr.base_label = upstream_pr.base.label;
  pr.base_git_url = upstream_pr.base.repo.git_url;
  pr.base_clone_url = upstream_pr.base.repo.clone_url
  pr.base_sha = upstream_pr.base.sha;
  pr.pr_label = upstream_pr.head.label;
  pr.pr_git_url = upstream_pr.head.repo.git_url;
  pr.pr_clone_url = upstream_pr.head.repo.clone_url;
  pr.pr_sha = upstream_pr.head.sha;
  pr.pr_owner = upstream_pr.head.repo.owner.login;
  pr.pr_name = upstream_pr.head.repo.name;
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
    return callback(null);
  }

  try {
    var pr = this.parse(msg);
  } catch(e) {
    return callback(e);
  }

  var commit_message = util.format('Gaia PR#%d: %s <-- %s', pr.number, pr.base_label, pr.pr_label);
  var user = pr.who;
  var contents = jsonForPR(pr);

  return callback(null, {user: user, commit_message: commit_message, contents: contents, pr: pr});
};

module.exports = PREventHandler;
