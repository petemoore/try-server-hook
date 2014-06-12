"use strict";

var BaseEventHandler = require('./base_event');
var gaiaTry = require('../gaia_try');

function CommitEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

CommitEventHandler.prototype = Object.create(BaseEventHandler.prototype);
CommitEventHandler.prototype.constructor = CommitEventHandler;

CommitEventHandler.prototype.handle = function(msg, callback) {
  if (!msg || !msg.user || !msg.commit_message || !msg.contents) {
    console.log(JSON.stringify(msg, null, '  '));
    return callback(new Error('Invalid message'));
  }
  console.log('Handing a commit');
  gaiaTry.commit(msg.user, msg.commit_message, msg.contents, function(err, hgId) {
    if (err) {
      return callback(err)
    }
    msg['hg_id'] = hgId; 
    msg['state'] = 'submitted';
    return callback(null, msg);
  });
};

module.exports = CommitEventHandler;
