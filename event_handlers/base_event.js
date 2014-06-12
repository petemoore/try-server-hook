"use strict";

var when = require('when');

function BaseEventHandler(downstream) {
  if (downstream instanceof Array) {
    this.downstreams = downstream;
  } else {
    this.downstreams = [downstream];
  }

}

BaseEventHandler.prototype = {
  handle: function (msg, callback) {
    callback(new Error('Handler not implemented'));
  },
  makeAction: function (msg, callback) {
    return function (msg, callback) {
      var new_callback = function (err, msg) {
        console.log('Invoking intercepting callback');
        if (err) {
          console.log('Error in intercepting callback');
          return callback(err)
        }

        if (!msg) {
          console.log('Not sending downstream message from ' + this.name);
          return callback(null);
        }

        var promises = []
        this.downstreams.forEach(function (ds) {
          console.log('Sending downstream message to ' + ds.name);
          promises.push(ds.insertJson(msg));
        });
        when.all(promises).then(
            function () {
              console.log('Downstream event handler insertions complete!');
              return callback(null, msg);
            },
            function (err) {
              console.log('Error sending a message downstream');
              return callback(err);
            }
        );
      }.bind(this);
      this.handle(msg, new_callback);
    }.bind(this);
  }
}

module.exports = BaseEventHandler;
