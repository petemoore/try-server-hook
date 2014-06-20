"use strict";

var debug = require('debug')('try-server-hook:github_post_handler');
var util = require('util');
var config = require('../config');
var github = require('../misc/githubapi');

var tbpl = require('../misc/tbpl');

var BaseEventHandler = require('./base_event');

//https://developer.github.com/guides/working-with-comments/
//http://mikedeboer.github.io/node-github/


function GithubPostHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(GithubPostHandler, BaseEventHandler);

function postToPr(msg, comment, callback) {
  var user = msg.pr.base_owner;
  var repo = msg.pr.base_name;
  var ghmsg = {
    user: user,
    repo: repo,
    number: msg.pr.number,
    body: comment
  };
  debug('Going to comment on %s/%s #%d', user, repo, msg.pr.number);
  github.issues.createComment(ghmsg, function(err, response){
    if (err) {
      return callback(err, true);
    }
    debug('Created comment %d on %s/%s #%d', response.id, user, repo, msg.pr.number);
    return callback(null);
  }); 
}

function handleStartPR(msg, callback) {
  var comment = util.format(
      'Continuous Integration started. [Results](%s)',
      tbpl.url({tree: 'Gaia-Try', rev: msg.hg_id}));
  postToPr(msg, comment, callback);
}

function handleFinishPR(msg, callback) {
  var comment = util.format(
      'Continuous Integration compeleted and %s. [Results](%s)',
      msg.state,
      tbpl.url({rev: msg.hg_id}));
  postToPr(msg, comment, callback);
}


GithubPostHandler.prototype.name = "Post to Github Issue";

GithubPostHandler.prototype.handle = function (msg, callback) {
  // Do shit
  if (msg.pr && !msg.finished) {
    handleStartPR(msg, callback); 
  } else if (msg.pr && msg.finished && msg.state) {
    handleFinishPR(msg, callback);
  } else { 
    return callback(new Error('I only know how to handle Pull Requests right now'));
  }
};

module.exports = GithubPostHandler;
