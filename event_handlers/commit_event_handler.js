'use strict';

var util = require('util');

var BaseEventHandler = require('./base_event');
var gaiaTry = require('../gaia_try');
var logging = require('../misc/logging');

var log = logging.setup(__filename);


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
      log.error(err, 'Trying to commit to gaia-try repo');
      return callback(err, retry)
    }
    msg['hg_id'] = hgId; 
    msg['state'] = 'submitted';
    return callback(null, null, msg);
  });
};

module.exports = CommitEventHandler;
