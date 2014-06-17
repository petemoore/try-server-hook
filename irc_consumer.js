"use strict";

var when = require('when');

var Connection = require('./msg_broker');
var IRCSendEvents = require('./irc_send_events');
var IRCEventHandler = require('./event_handlers/irc_sender');

var connection = new Connection();
var ircSendEvents = new IRCSendEvents();
var ircSender = new IRCEventHandler([], 'irc://irc.mozilla.org:6667', 'gertrude', ['#gaiabot']);

connection.open()
  .then(ircSendEvents.bindConnection(connection))
  .then(function() {
    connection.createChannel().then(function (ch) {
        ch.prefetch(1, true);
        ircSendEvents.addConsumer(ircSender.makeAction(), ch, 'irc_message').done();
    });
  }).done()
