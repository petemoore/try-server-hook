"use strict";

var EventStream = require('./event_stream');

function IRCSendEvents () {}

IRCSendEvents.prototype = new EventStream('irc_send', ['irc_message']);
IRCSendEvents.prototype.constructor = IRCSendEvents;

module.exports = IRCSendEvents;
