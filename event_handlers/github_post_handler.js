"use strict";

var util = require('util');
var GithubAPI = require('github');

var tbpl = require('./misc/tbpl');

var BaseEventHandler = require('./base_event');

//https://developer.github.com/guides/working-with-comments/
//http://mikedeboer.github.io/node-github/


function GithubPostHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
  this.username = process.env.GITHUB_API_USER;
  this.apiKey = process.env.GITHUB_API_KEY;
  this.github = new GithubAPI({
    version: '3.0.0'
  });
  this.github.authenticate({type: 'oauth', token: this.apiKey});
}

function postToPr(msg, comment, callback) {
  var base_info = msg.pr.base_label.split(':');
  if (base_info.length !== 2) {
    return callback(new Error('base label of PR needs to be user:repo'));
  }
  var user = base_info[0];
  var repo = base_info[1];
  var ghmsg = {
    user: user,
    repo: repo,
    number: msg.pr.number,
    body: comment
  };
  github.issues.createComment(ghmsg, callback); 
}

function handleStartPR(github, msg, callback) {
  var comment = util.format(
      'Continuous Integration started. [Results](%s)',
      tbpl.url({rev: msg.hg_id}));
  postToPr(msg, comment, callback);
}

function handleFinishPR(github, msg, callback) {
  var comment = util.format(
      'Continuous Integration compeleted and %s. [Results](%s)',
      msg.state,
      tbpl.url({rev: msg.hg_id}));
  postToPr(msg, comment, callback);
}

GithubPostHandler.prototype = Object.create(BaseEventHandler.prototype);
GithubPostHandler.prototype.constructor = GithubPostHandler;

GithubPostHandler.prototype.handle = function (msg, callback) {
  // Do shit
  if (msg.pr && !msg.finished) {
    handleStartPR(this.github, msg, callback); 
  } else if (msg.pr && msg.finished && msg.state) {
    handleFinishPR(this.github, msg, callback);
  } else { 
    return callback(new Error('I only know how to handle Pull Requests right now'));
  }
};

module.exports = GithubPostHandler;
