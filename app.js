"use strict";
var express = require('express');
var when = require('when');
var fs = require('fs');
var path = require('path');

var amqpUri = require('./amqp_uri');
var GithubEvents = require('./github_events');
var CommitEvents = require('./commit_events');
var NotificationEvents = require('./notification_events');
var Connection = require('./msg_broker');

var PullRequestToTryCommitFilter = require('./pr_to_try');
var CommitToNotificationFilter = require('./gaia_try_commit');


function error(msg) {
  return JSON.stringify({'error': msg}) + '\n';
}

function success(msg) {
  return JSON.stringify({'outcome': msg}) + '\n';
}

var app = express();
app.use(express.json());
app.use(express.urlencoded());

app.connection = new Connection(amqpUri);
app.githubEvents = new GithubEvents();
app.commitEvents = new CommitEvents();
app.notificationEvents = new NotificationEvents();
app.prToTryFilter = new PullRequestToTryCommitFilter(app.commitEvents);
app.commitToNotificationFilter = new CommitToNotificationFilter(app.notificationEvents);

app.get('/', function(req, res) {
  res.send('200', 'Server is up!');
});

/* curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \
     --header "Content-Type:application/json" \
     --header "X-GitHub-Event:pull_request" \
     --header "X-GitHub-Delivery:testing-guid" */
app.post('/github/v3', function(req, res) {
  var type = req.get('X-GitHub-Event');
  var delivery_id = req.get('X-GitHub-Delivery');

  console.log('Api received a ' + type);
  app.githubEvents.insertJson({type:type, delivery_id:delivery_id, content:req.body})
    .then(
      function(outcome) {
        res.send(200, success(outcome));
      },
      function(outcome) {
        if (typeof outcome === 'object' && outcome.message) {
          console.log('ERROR!');
          console.log(outcome.fileName || 'no filename');
          console.log(outcome.lineNumber || 'no line number');
          console.log(outcome.stack || 'no stack');
          res.send(500, error(outcome.message));
        } else {
          res.send(500, error(outcome));
        }
      })
    .done();
});

// Start up the app!
app.connection.open()
  .then(app.githubEvents.bindConnection(app.connection))
  .then(app.commitEvents.bindConnection(app.connection))
  .then(function() {
    app.connection.createChannel().then(function (ch) {
      app.githubEvents.addConsumer(app.prToTryFilter.makeAction(), ch, 'github_api_incoming');
      //app.notificationEvents.addConsumer(app.commitToNotificationFilter.makeAction(), ch, '');
    });
  })
  .then(function() {
    app.listen(process.env.PORT || 7040);
  })
  .done();
console.log('Starting up server!');
