'use strict';

var when = require('when');

// Connection Libraries
var Connection = require('./connection');
var msgBroker = require('./msg_broker');

// Event Handlers
var PREventHandler = require('./event_handlers/pr_event_handler');
var PushEventHandler = require('./event_handlers/push_event_handler');
var IRCEventHandler = require('./event_handlers/irc_event_handler');
var GithubPostHandler = require('./event_handlers/github_post_handler');
var StartMonitoringEventHandler = require('./event_handlers/start_monitoring_event_handler');
var CommitEventHandler = require('./event_handlers/commit_event_handler');
//var IRCSender = require('./event_handlers/irc_sender');

var connection = new Connection();

var prEventHandler = new PREventHandler('commit_to_gaia_try');
var pushEventHandler = new PushEventHandler('commit_to_gaia_try');
var ircEventHandler = new IRCEventHandler('irc_send');
var githubPostHandler = new GithubPostHandler();
var startMonitoringEventHandler = new StartMonitoringEventHandler();
var commitEventHandler = new CommitEventHandler(['post_commit_notifications']);
//var ircSender = new IRCSender();

connection.open()
  .then(msgBroker.assertSchema)
  .then(function(conn) {
    return conn.createConfirmChannel().then(function(ch) {
      ch.prefetch(1);
      ch.on('error', function(err) {
        log.error(err, 'AMQP channel error, exiting');
        process.exit(1);
      });
      return when.all([
        msgBroker.addConsumer(ch, 'to_commit', commitEventHandler),
        //msgBroker.addConsumer(ch, 'irc_outgoing', ircSender),
        msgBroker.addConsumer(ch, 'incoming_pull_request_events', prEventHandler),
        msgBroker.addConsumer(ch, 'incoming_push_events', pushEventHandler),
        msgBroker.addConsumer(ch, 'queue_irc', ircEventHandler),
        msgBroker.addConsumer(ch, 'start_monitoring', startMonitoringEventHandler),
        msgBroker.addConsumer(ch, 'make_github_comment', githubPostHandler)
      ]);
    });
  })
  .done();


