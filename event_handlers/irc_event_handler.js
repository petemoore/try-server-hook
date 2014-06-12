"use strict";
var when = require('when');
var BaseEventHandler = require('./base_event');
var util = require('util');
var shorten = require('../misc/bitly_shorten').shorten;
var tbpl = require('../misc/tbpl');

function IRCEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

IRCEventHandler.prototype = Object.create(BaseEventHandler.prototype);
IRCEventHandler.prototype.constructor = IRCEventHandler;

IRCEventHandler.prototype.handle = function(msg, callback) {
  if (!msg || !msg.user || !msg.hg_id) {
    return callback(new Error('Invalid message'));
  }
  console.log('Handling an IRC event');

  var tbplurl = tbpl.url({tree: 'Gaia-Try', rev: msg.hg_id});
  shorten(tbplurl, function(err, url) {
    var message = 'Oops';
    if (err) {
      return callback(err)
    }
    if (msg.finished) {
      message = util.format('%s\'s tests are compete! results here: %s', msg.user, url);
    } else {
      message = util.format('%s started tests.  Outcome: %s  Results here: %s', msg.user, msg.state, url);
    }
    callback(null, {message: message});
  }.bind(this)); 
};

module.exports = IRCEventHandler;
