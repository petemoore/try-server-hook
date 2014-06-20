"use strict";

var when = require('when');
var util = require('util');
var config = require('./config');

var Connection = require('./connection');
var connection = new Connection();
var msgBroker = require('./msg_broker');

var CommitEventHandler = require('./event_handlers/commit_event_handler');
var commitEventHandler = new CommitEventHandler();

connection.open()
  .then(msgBroker.assertSchema)
  .then(function(conn) {
    return conn.createChannel().then(function(ch) {
      ch.prefetch(1);
      ch.on('error', function(err) {
        debug('AMQP Channel Error, exiting');
        process.exit(1);
      });
      return when.all([
        msgBroker.addConsumer(ch, 'to_commit', commitEventHandler),
      ]);
    });
  })
  .done();


