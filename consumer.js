"use strict";
var when = require('when');

var amqpUri = require('./amqp_uri');
var CommitEvents = require('./commit_events');
var Connection = require('./msg_broker');
var GaiaTryCommitToNotificationFilter = require('./gaia_try_commit');
var NotificationEvents = require('./notification_events');

var commitEvents = new CommitEvents();
var notificationEvents = new NotificationEvents();
var connection = new Connection(amqpUri);
var gaiaTryCommitFilter = new GaiaTryCommitToNotificationFilter(notificationEvents);

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
        commitEvents.addConsumer(gaiaTryCommitFilter.makeAction(), ch, 'gaia_try_commit');
      } );
    }
  )
  .done()

