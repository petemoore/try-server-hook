'use strict';

var config = require('../config');
var GithubAPI = require('github');

var username = config.get('GITHUB_API_USER');
var apiKey = config.get('GITHUB_API_KEY');

var github = new GithubAPI({
  version: '3.0.0'
});

github.authenticate({type: 'oauth', token: apiKey});

module.exports = github;
