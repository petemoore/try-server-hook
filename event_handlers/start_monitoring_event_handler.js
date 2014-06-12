"use strict";

var BaseEventHandler = require('./base_event');

function StartMonitoringEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

StartMonitoringEventHandler.prototype = Object.create(BaseEventHandler.prototype);
StartMonitoringEventHandler.prototype.constructor = StartMonitoringEventHandler;

StartMonitoringEventHandler.prototype.handle = function (msg, callback) {
  console.log(JSON.stringify(msg));
  callback(null);
};

module.exports = StartMonitoringEventHandler;

