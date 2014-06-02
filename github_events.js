"use strict";

var Pineapple = require('./pineapple');

function GithubEvents () {}

GithubEvents.prototype = new Pineapple('github_events', ['github_api_incoming']);

module.exports = GithubEvents;
