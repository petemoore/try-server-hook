"use strict";

var Pineapple = require('./pineapple');

function GithubEvents () {}

GithubEvents.prototype = new Pineapple('github_events', ['github_events']);

module.exports = GithubEvents;
