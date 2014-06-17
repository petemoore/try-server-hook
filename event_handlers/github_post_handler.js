"use strict";

var util = require('util');
var config = require('../config');
var GithubAPI = require('github');

var tbpl = require('../misc/tbpl');

var BaseEventHandler = require('./base_event');

//https://developer.github.com/guides/working-with-comments/
//http://mikedeboer.github.io/node-github/


function GithubPostHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
  this.username = config.get('GITHUB_API_USER');
  this.apiKey = config.get('GITHUB_API_KEY');
  this.github = new GithubAPI({
    version: '3.0.0'
  });
  this.github.authenticate({type: 'oauth', token: this.apiKey});
}

function postToPr(github, msg, comment, callback) {
  var user = msg.pr.base_owner;
  var repo = msg.pr.base_name;
  var ghmsg = {
    user: user,
    repo: repo,
    number: msg.pr.number,
    body: comment
  };
  console.log('Going to comment on %s/%s #%d', user, repo, msg.pr.number);
  github.issues.createComment(ghmsg, function(err, response){
    if (err) {
      return callback(err, true);
    }
    console.log('Created comment %d on %s/%s #%d', response.id, user, repo, msg.pr.number);
    return callback(null);
  }); 
}

function handleStartPR(github, msg, callback) {
  var comment = util.format(
      'Continuous Integration started. [Results](%s)',
      tbpl.url({tree: 'Gaia-Try', rev: msg.hg_id}));
  postToPr(github, msg, comment, callback);
}

function handleFinishPR(github, msg, callback) {
  var comment = util.format(
      'Continuous Integration compeleted and %s. [Results](%s)',
      msg.state,
      tbpl.url({rev: msg.hg_id}));
  postToPr(github, msg, comment, callback);
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
