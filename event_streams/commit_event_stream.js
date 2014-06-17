"use strict";

var EventStream = require('./event_stream');

function GaiaTryEvents () {}

GaiaTryEvents.prototype = new EventStream('gaia_try_events', ['gaia_try_commit']);

module.exports = GaiaTryEvents;
