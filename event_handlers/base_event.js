"use strict";

var msgBroker = require('../msg_broker');
var when = require('when');
var logging = require('../misc/logging');

var log = logging.setup(__filename);

function BaseEventHandler(downstream) {
  if (typeof downstream === 'undefined') {
    this.downstreams = [];
  } else if (downstream instanceof Array) {
    this.downstreams = downstream;
  } else {
    this.downstreams = [downstream];
  }
  log.debug('Downstreams for this handler: %s', this.downstreams.join(', '));
}

BaseEventHandler.prototype = {
  name: 'Base Event',
  handle: function (msg, callback) {
    callback(new Error('Handler not implemented'), false);
  },
  makeAction: function (channel) {
    if (!channel) {
      log.error('Missing channel to use for downstream messages');
      throw new Error('Missing channel to use for downstream messages');
    }
    return function (msg, routingKey, realCallback) {
      var interceptor = function (err, retry, dsMsg) {
        log.debug('Invoking intercepting callback for %s', this.name);
        if (err) {
          log.error(err, 'Error in intercepting callback for %s', this.name);
          return realCallback(err, retry)
        }

        if (!dsMsg) {
          log.debug('No downstream message to send from %s', this.name);
          return realCallback(null, null, dsMsg);
        } 

        var promises = [];
        this.downstreams.forEach(function (ds) {
          log.debug('Will send to downstream %s with routing key %s', ds, routingKey);
          promises.push(msgBroker.insertCh(channel, ds, routingKey, dsMsg));
        });
        when.all(promises).then(
          function () {
            log.debug('Downstream event handler insertions complete!');
            return realCallback(null, null, dsMsg);
          },
          function (dsErr) {
            log.error(dsErr, 'Error sending downstream messages');
            return realCallback(dsErr, retry);
          }
        ).done();
      }.bind(this);
      log.debug('Handling %s event', this.name);
      this.handle(msg, interceptor);
    }.bind(this);
  }
}

module.exports = BaseEventHandler;
