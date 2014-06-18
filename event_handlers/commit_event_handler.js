"use strict";

var util = require('util');

var BaseEventHandler = require('./base_event');
var gaiaTry = require('../gaia_try');

function CommitEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(CommitEventHandler, BaseEventHandler);

CommitEventHandler.prototype.name = "Gaia Try Commit";
CommitEventHandler.prototype.handle = function(msg, callback) {
  if (!msg || !msg.user || !msg.commit_message || !msg.contents) {
    return callback(new Error('Invalid message'));
  }
  gaiaTry.commit(msg.user, msg.commit_message, msg.contents, function(err, retry, hgId) {
    if (err) {
      return callback(err, !!retry)
    }
    msg['hg_id'] = hgId; 
    msg['state'] = 'submitted';
    return callback(null, msg);
  });
};

module.exports = CommitEventHandler;
