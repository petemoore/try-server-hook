'use strict';
var express = require('express');
var when = require('when');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('try-server-hook:app');
var msgBroker = require('./msg_broker');

var config = require('./config');

var port = config.get('PORT') || 7040;
var Connection = require('./connection');

// Event Handlers
var PREventHandler = require('./event_handlers/pr_event_handler');
var IRCEventHandler = require('./event_handlers/irc_event_handler');
var GithubPostHandler = require('./event_handlers/github_post_handler');
var StartMonitoringEventHandler = require('./event_handlers/start_monitoring_event_handler');

function error(msg) {
    return JSON.stringify({ 'error': msg }) + '\n';
}

function success(msg) {
    return JSON.stringify({ 'outcome': msg }) + '\n';
}

var app = express();
app.use(express.json());
app.use(express.urlencoded());

app.connection = new Connection();

app.prEventHandler = new PREventHandler('commit_to_gaia_try');
app.ircEventHandler = new IRCEventHandler('irc_send');
app.githubPostHandler = new GithubPostHandler();
app.startMonitoringEventHandler = new StartMonitoringEventHandler();

app.get('/', function(req, res) {
    res.send('200', 'Server is up!');
});

/* curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \
--header "Content-Type:application/json" \
--header "X-GitHub-Event:pull_request" \
--header "X-GitHub-Delivery:testing-guid" */
app.post('/github/v3', function(req, res) {
    req.accepts('application/json');
    var type = req.get('X-GitHub-Event');
    var deliveryId = req.get('X-GitHub-Delivery');
    var payload = { type: type, delivery_id: deliveryId, content: req.body };

    debug('Inserting a %s (%s) event into queue', type, deliveryId);

    app.connection.open().then(function(conn) {
        function passed() {
            debug('Inserted %s (%s)', type, deliveryId);
            res.send(200, success({ inserted: true }));
        }
        function failed(err) {
            console.log('ERROR Inserting Github Event');
            console.log(err.stack || err);
            debug('Failed to insert %s (%s)', type, deliveryId);
            res.send(500, error(outcome.message || outcome));
        }
        msgBroker.insert(conn, 'incoming_github_events', payload).then(passed, failed).done();
    }).done();
});

app.connection.on('close', function() {
    debug('Exiting because of AMQP connection closure');
    process.exit(1);
});

function setupConsumers(connection) {
  msgBroker.assertSchema(connection)
  .then(function () { 
    return connection.createConfirmChannel().then(function(ch) {
      ch.prefetch(5);
      // Reset consumers if they error out
      ch.on('error', function(err) {
        debug('Encountered channel error, resetting consumers');
        debug(err.stack || err);
        setupConsumers(connection);
      });
      return when.all([
        msgBroker.addConsumer(ch, 'github_api_incoming', app.prEventHandler),
        msgBroker.addConsumer(ch, 'queue_irc', app.ircEventHandler),
        msgBroker.addConsumer(ch, 'make_github_comment', app.githubPostHandler)
      ]);
    })
  })
  .then(function() {
    debug('Starting server on port %d', port);
    app.listen(port);
  }).done();
}

app.connection.on('connected', setupConsumers);

app.connection.open().done();
