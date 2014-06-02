"use strict";

var when = require('when');
var util = require('util');

var GaiaTryEvents = require('./commit_events');

function Filter() {

}

Filter.prototype = {
  parse: function (obj) {
    return obj;
  },
  validate: function (obj) {
    return true;
  },
  interesting: function(obj) {
    return false;
  },
  handle: function(obj) {
    console.log('This is where I *would* handle the object if I were implemented');
  }
};


function jsonForPR(pr) {
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



function PullRequestToTryCommitFilter(commitEvents) {
  this.commitEvents = commitEvents;
};

PullRequestToTryCommitFilter.prototype = {
  parse: function (obj) {
    var pr = {};
    var upstream_pr = obj.content.pull_request;
    pr.type = 'pull_request';
    pr.action = obj.content.action;
    pr.number = obj.content.number;
    pr.who = obj.content.sender.login;
    pr.base_label = upstream_pr.base.label;
    pr.base_git_url = upstream_pr.base.repo.git_url;
    pr.base_clone_url = upstream_pr.base.repo.clone_url
    pr.base_sha = upstream_pr.base.sha;
    pr.pr_label = upstream_pr.head.label;
    pr.pr_git_url = upstream_pr.head.repo.git_url;
    pr.pr_clone_url = upstream_pr.head.repo.clone_url;
    pr.pr_sha = upstream_pr.head.sha;
    pr.merge_sha = upstream_pr.merge_commit_sha;
    return pr;
  },
  validate: function (obj) {
    if (!obj) {
      return false;
    }
    ['type', 'action', 'pr_number', 'who', 'base_label', 'base_git_url',
    'base_clone_url', 'base_sha', 'pr_label', 'pr_git_url', 'pr_clone_url',
    'pr_sha', 'merge_sha'].forEach(function(element) {
      if (!obj[element]) {
        return false;
      }
    });
    return true;
  },
  interesting: function (obj) {
    if (obj && obj.type && obj.type === 'pull_request') {
      return true;
    }
    return false;
  },
  handle: function handlePullRequest(obj, callback) {
    if (!this.interesting(obj)) {
      console.log('This message is not interesting to this consumer');
      return callback(null);
    }
    try {
      var pr = this.parse(obj);
    } catch(e) {
      console.log('Failed to parse this pull request!');
      return callback(e);
    }
    var message = util.format('Gaia PR#%d: %s <-- %s', pr.number, pr.base_label, pr.pr_label);
    var user = pr.who;
    var contents = jsonForPR(pr);
    
    this.commitEvents.insertJson({user: user, message: message, contents: contents}).then(
        function onSuccess() {
          return callback(null);
        },
        function onError(err) {
          return callback(err);
        }
    );
  },
  makeAction: function() {
    return function (obj, cb) {
      this.handle(obj, cb);
    }.bind(this);
  }
};

module.exports = PullRequestToTryCommitFilter
