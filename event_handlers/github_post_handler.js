"use strict";

var debug = require('debug')('try-server-hook:github_post_handler');
var util = require('util');
var config = require('../config');
var github = require('../misc/githubapi');

var tbpl = require('../misc/tbpl');

var BaseEventHandler = require('./base_event');

//https://developer.github.com/guides/working-with-comments/
//http://mikedeboer.github.io/node-github/


//Not worth a template engine!
function avatar(src, username, w, h) {
  return util.format('<img src="%s" alt="%s" width="%dpx" height="%dpx" />',
                      src, username, w || 50, h || 50);
}

function postStartPr(msg, callback) {
  github.user.get({user: msg.pr.who}, function(err, result) {
    if (err) {
      return callback(err, true);
    }
    var fullName = result.name;
    var profileUrl = result.html_url;
    var avatarUrl = result.avatar_url;
    var user = msg.pr.base_owner;
    var repo = msg.pr.base_name;
    var comment = util.format('[%s %s (%s)](%s) started tests. [Results](%s)',
                              avatar(avatarUrl, msg.pr.who), fullName,
                              msg.pr.who, profileUrl, tbpl.url({rev: msg.hg_id}));
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
      return callback(null, null);
    }); 
  });
}

function GithubPostHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(GithubPostHandler, BaseEventHandler);

GithubPostHandler.prototype.name = "Post to Github Issue";

GithubPostHandler.prototype.handle = function (msg, callback) {
  // Do shit
  if (msg.pr && !msg.finished) {
    postStartPr(msg, callback); 
  } else if (msg.pr && msg.finished && msg.state) {
    handleFinishPR(msg, callback);
  } else { 
    return callback(new Error('I only know how to handle Pull Requests right now'));
  }
};

module.exports = GithubPostHandler;
