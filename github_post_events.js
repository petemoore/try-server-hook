"use strict";

var EventStream = require('./event_stream');

function GithubPostEvents () {}

GithubPostEvents.prototype = new EventStream('irc_send', ['irc_message']);
GithubPostEvents.prototype.constructor = GithubPostEvents;

module.exports = GithubPostEvents;
