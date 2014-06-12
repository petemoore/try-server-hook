"use strict";

var BaseEventHandler = require('./base_event');
var gaiaTry = require('../gaia_try');

function CommitEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

CommitEventHandler.prototype = Object.create(BaseEventHandler.prototype)
CommitEventHandler.prototype.constructor = CommitEventHandler;

CommitEventHandler.prototype.handle = function(msg, callback) {
  console.log('Handing a commit');
  gaiaTry.commit(msg, function(err, hgId) {
    if (err) {
      return callback(err)
    }
    msg['hg_id'] = hgId; 
    return callback(null, msg);
  });
};

module.exports = CommitEventHandler;
