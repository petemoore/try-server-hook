"use strict";

var debug = require('debug')('try-server-hook:base_event');
var msgBroker = require('../msg_broker');
var when = require('when');

function BaseEventHandler(downstream) {
  if (typeof downstream === 'undefined') {
    this.downstreams = [];
  } else if (downstream instanceof Array) {
    this.downstreams = downstream;
  } else {
    this.downstreams = [downstream];
  }
  debug('Downstreams for this handler: %s', this.downstreams.join(', '));
}

BaseEventHandler.prototype = {
  name: 'Base Event',
  handle: function (msg, callback) {
    callback(new Error('Handler not implemented'), false);
  },
  makeAction: function (channel) {
    if (!channel) {
      debug('Missing channel to use for downstream messages');
      throw new Error('Missing channel to use for downstream messages');
    }
    return function (msg, routingKey, realCallback) {
      var interceptor = function (err, retry, dsMsg) {
        debug('Invoking intercepting callback for %s', this.name);
        if (err) {
          debug('Error in intercepting callback for %s', this.name);
          return realCallback(err, retry)
        }

        if (!dsMsg) {
          debug('No downstream message to send from %s', this.name);
          return realCallback(null, null, dsMsg);
        } 

        var promises = [];
        this.downstreams.forEach(function (ds) {
          debug('Will send to downstream %s with routing key %s', ds, routingKey);
          promises.push(msgBroker.insertCh(channel, ds, routingKey, dsMsg));
        });
        when.all(promises).then(
          function () {
            debug('Downstream event handler insertions complete!');
            return realCallback(null, null, dsMsg);
          },
          function (dsErr) {
            debug('Error sending downstream messages');
            return realCallback(dsErr, retry);
          }
        ).done();
      }.bind(this);
      debug('Handling %s event', this.name);
      this.handle(msg, interceptor);
    }.bind(this);
  }
}

module.exports = BaseEventHandler;
