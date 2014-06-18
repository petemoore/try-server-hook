"use strict";

var debug = require('debug')('try-server-hook:base_event');
var when = require('when');

function BaseEventHandler(downstream) {
  if (downstream instanceof Array) {
    this.downstreams = downstream;
  } else {
    this.downstreams = [downstream];
  }

}

BaseEventHandler.prototype = {
  name: 'Base Event',
  handle: function (msg, callback) {
    callback(new Error('Handler not implemented'));
  },
  makeAction: function (msg, callback) {
    return function (msg, callback) {
      var new_callback = function (err, msg) {
        debug('Invoking intercepting callback for %s', this.name);
        if (err) {
          debug('Error in intercepting callback for %s', this.name);
          return callback(err)
        }

        if (!msg) {
          debug('Not sending downstream message because it\'s falsy');
          return callback(null);
        }

        var promises = []
        this.downstreams.forEach(function (ds) {
          debug('Sending message to downstream %s', ds);
          promises.push(ds.insertJson(msg));
        });
        when.all(promises).then(
            function () {
              debug('Downstream event handler insertions complete!');
              return callback(null, msg);
            },
            function (err) {
              debug('Error sending a message downstream');
              return callback(err);
            }
        );
      }.bind(this);
      debug('Handling %s event', this.name);
      this.handle(msg, new_callback);
    }.bind(this);
  }
}

module.exports = BaseEventHandler;
