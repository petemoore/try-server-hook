"use strict";

var url = require('url');
var when = require('when');
var amqp = require('amqplib');
var debug = require('debug')('try-server-hook:msg_broker');
var util = require('util');
var events = require('events');
var config = require('./config');

function Connection (opts) {
  this.uri = config.get('CLOUDAMQP_URL') || config.get('AMQP_URL');
  this.channelCount = 0;
  this.options = opts || {};
  if (!this.options.heartbeat) {
    this.options.heartbeat = 15 * 60;
  }
  events.EventEmitter.call(this);
}

util.inherits(Connection, events.EventEmitter);

Connection.prototype.open = function () {
  return when(amqp.connect(this.uri, this.options).then(function(conn) {
    // We only print the hostname to avoid showing credentials in output
    debug('Connected message broker running at ' + url.parse(this.uri).hostname);
    debug('Heartbeats every %s seconds', this.options.heartbeat);
    this.emit('connected');
    this.connection = conn;
    conn.on('close', function() {
      debug('Closing AMQP connection')
    });
    conn.on('error', function(e) {
      debug('AMQP Connection Error\n%s', e.stack||e)
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
    return when.resolve(conn);
  }.bind(this)));
};

Connection.prototype.createChannel = function () {
  if (!this.connection) {
    return when.reject('Cannot create channel before connection is established');
  }
  return when(this.connection.createChannel().then(function(ch) {
    debug('Opened a channel');
    this.channelCount++;
    ch.on('close', function() {
      this.channelCount--;
      debug('Closing AMQP channel, %d channels remaining', this.channelCount);
      this.emit('chClose', this.channelCount);
      if (this.channelCount === 0) {
        this.emit('lastChClose');
      }
    }.bind(this));
    ch.on('error', function(e) {
      debug('ERROR: AMQP Channel Error\n%s', e.stack||e);
      this.emit('chErr', e);
    });
    return ch;
  }.bind(this)));
};

Connection.prototype.close = function() {
  this.emit('close');
  return this.connection.close();
};

module.exports = Connection;
