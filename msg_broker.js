"use strict";

var url = require('url');
var when = require('when');
var amqp = require('amqplib');

function Connection (uri, opts) {
  this.uri = uri;
  this.options = {};
  this.channels = [];
  this.options = opts || {};
  if (!this.options.heartbeat) {
    this.options.heartbeat = 15 * 60;
  }
}

Connection.prototype = {
  open: function () {
    return when(amqp.connect(this.uri, this.heartbeat).then(function(conn) {
      // We only print the hostname to avoid showing credentials in output
      console.log('Connected message broker running at ' + url.parse(this.uri).hostname);
      this.connection = conn;
      return when.resolve(conn);
    }.bind(this)));
  },
  // Probably should do something to remove the channels when they are finished with
  createChannel: function () {
    if (!this.connection) {
      return when.reject('Cannot create channel before connection is established');
    }
    return when(this.connection.createChannel().then(function(ch) {
      console.log('Opened a channel'); 
      this.channels.push(ch);
      return ch;
    }.bind(this)));
  }
};

module.exports = Connection;
