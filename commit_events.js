"use strict";

var Pineapple = require('./pineapple');

function GaiaTryEvents () {}

GaiaTryEvents.prototype = new Pineapple('gaia_try_events', ['gaia_try_commit']);

module.exports = GaiaTryEvents;
