'use strict';

var url = require('url');
var when = require('when');
var amqp = require('amqplib');
var debug = require('debug')('try-server-hook:connection');
var util = require('util');
var events = require('events');
var config = require('./config');

function Connection(opts) {
  this.uri = config.get('CLOUDAMQP_URL') || config.get('AMQP_URL');
  this.channelCount = 0;
  this.options = opts || {};
  if (!this.options.heartbeat) {
    this.options.heartbeat = 15 * 60;
  }
  events.EventEmitter.call(this);
}

util.inherits(Connection, events.EventEmitter);

Connection.prototype.open = function() {
  if (this.connection) {
    debug('Already have a connection');
    return when.resolve(this.connection);
  }
  return when.promise(function(resolve, reject) {
    amqp.connect(this.uri, this.options).then(function(conn) {
      // We only print the hostname to avoid showing credentials in output
      debug('Connected message broker running at ' + url.parse(this.uri).hostname);
      this.connection = conn;
      conn.on('close', function() {
        debug('Closing AMQP connection');
        this.connection = undefined;
      });
      conn.on('error', function(e) {
        debug('AMQP Connection Error\n%s', e.stack || e);
        this.emit('error', e);
      }.bind(this));
      conn.on('blocked', function(reason) {
        debug('AMQP connection blocked: ', reason);
        this.emit('blocked', reason);
      }.bind(this));
      conn.on('unblocked', function() {
        debug('AMQP connection unblocked');
        this.emit('unblocked');
      }.bind(this));
      this.emit('connected', this.connection);
      return resolve(this.connection);
    }.bind(this));
  }.bind(this));
};

module.exports = Connection;
