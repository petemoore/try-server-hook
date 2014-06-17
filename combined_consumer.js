"use strict";

var when = require('when');

var Connection = require('./msg_broker');
var IRCSendEvents = require('./irc_send_events');
var IRCEventHandler = require('./event_handlers/irc_sender');
var CommitEvents = require('./commit_events');
var Connection = require('./msg_broker');
var NotificationEvents = require('./notification_events');
var CommitEventHandler = require('./event_handlers/commit_event_handler');

var commitEvents = new CommitEvents();
var notificationEvents = new NotificationEvents();
var commitEventHandler = new CommitEventHandler(notificationEvents);
var ircSendEvents = new IRCSendEvents();
var ircSender = new IRCEventHandler([], 'irc://irc.mozilla.org:6667', 'gertrude', ['#gaiabot', '#gaia']);
var connection = new Connection();

connection.open()
  .then(commitEvents.bindConnection(connection))
  .then(notificationEvents.bindConnection(connection))
  .then(ircSendEvents.bindConnection(connection))
  .then(function() {
    connection.createChannel().then(function (ch) {
        ch.prefetch(1, true);
        commitEvents.addConsumer(commitEventHandler.makeAction(), ch, 'gaia_try_commit');
        ircSendEvents.addConsumer(ircSender.makeAction(), ch, 'irc_message').done();
    });
  }).done()

