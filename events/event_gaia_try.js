// Module that figures out pull requests

var when = require('when');
var q = require('../msg_queue');

// Parse a GitHub webhook payload and create a Pull Request object
function parse(payload) {
  var pr = {};
  var upstream_pr = payload.pull_request;
  pr.type = 'pull_request';
  pr.action = payload.action;
  pr.number = payload.number;
  pr.who = payload.sender.login;
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
}

// Validate a pull request object
function validate(pr) {
  if (!pr) {
    return false;
  }
  ['type', 'action', 'pr_number', 'who', 'base_label', 'base_git_url',
   'base_clone_url', 'base_sha', 'pr_label', 'pr_git_url', 'pr_clone_url',
   'pr_sha', 'merge_sha'].forEach(function(element) {
    if (!element) {
      return false;
    }
  });

  return true;
}

// This function returns true if it's interesting, false otherwise
function interesting(type, payload) {
  if (!type || type !== 'pull_request') {
    console.log('Event is not a pull request');
    return false;
  }
  // We don't care about PRs that are being closed
  if (!payload || !payload.action || payload.action === 'closed') {
    console.log('Pull request missing an action or is closed');
    return false;
  }
  console.log('Event is interesting');
  return true;
}

function handle(type, payload) {
  return when.promise(function (resolve, reject) {
    console.log('Handling Pull Request');
    try {
      var pr = parse(payload);
      console.log('Parsed PR');
    } catch(e) {
      console.log('Failed to parse PR');
      reject(new Error('Could not parse PR Payload: ' + e));
    }
    q.enqueue(pr).then(
      function () {
        console.log('Enqueued');
        resolve('Success'); 
      },
      function (x) {
        console.log('Failed to enqueue:\n' + x);
        reject(x);
      });
  });
}

module.exports = {
  name: 'gaia-try-trigger',
  handle: handle,
  _parse: parse,
  validate: validate,
  interesting: interesting
}
