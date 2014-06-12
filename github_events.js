"use strict";

var EventStream = require('./event_stream');

function GithubEvents () {}

GithubEvents.prototype = new EventStream('github_events', ['github_api_incoming']);

module.exports = GithubEvents;
