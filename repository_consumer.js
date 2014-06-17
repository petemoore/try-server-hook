"use strict";
var when = require('when');

var CommitEvents = require('./commit_events');
var Connection = require('./msg_broker');
var NotificationEvents = require('./notification_events');

var CommitEventHandler = require('./event_handlers/commit_event_handler');

var commitEvents = new CommitEvents();
var notificationEvents = new NotificationEvents();
var connection = new Connection();
var commitEventHandler = new CommitEventHandler(notificationEvents);

function exitOnClose () {
  console.log('Exiting because of channel or connection close');
  process.exit();
}

connection.open()
  .then(commitEvents.bindConnection(connection))
  .then(notificationEvents.bindConnection(connection))
  .then(
    function() {
      connection.createChannel().then(function (ch) {
        ch.prefetch(1, true);
        commitEvents.addConsumer(commitEventHandler.makeAction(), ch, 'gaia_try_commit');
      } );
    }
  )
  .done()

