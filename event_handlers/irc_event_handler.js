"use strict";
var when = require('when');
var BaseEventHandler = require('./base_event');
var util = require('util');
var shorten = require('../misc/bitly_shorten').shorten;
var tbpl = require('../misc/tbpl');
var logging = require('../misc/logging');

var log = logging.setup(__filename);

function IRCEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(IRCEventHandler, BaseEventHandler);

IRCEventHandler.name = 'Queue IRC Message';

IRCEventHandler.prototype.handle = function(msg, callback) {
  if (!msg || !msg.user || !msg.hg_id) {
    return callback(new Error('Invalid message'));
  }
  log.debug('Queueing up IRC message');
  var tbplURL = tbpl.url({rev: msg.hg_id});
  shorten(msg.push.compare_url, function(err, shortCompareURL) {
    if (err) {
      return callback(err, false);
    }
    shorten(tbplURL, function(err, shortTbplURL) {
      if (err) {
        return callback(err, false);
      }
      var message = util.format('%s pushed to %s branch.  Commits: %s Results: %s', 
                                msg.push.who, msg.push.branch, shortCompareURL,
                                shortTbplURL);
      log.info('Queueing message: %s', message);
      callback(null, null, {message: message});
    }.bind(this)); 
  }.bind(this));
};

module.exports = IRCEventHandler;
