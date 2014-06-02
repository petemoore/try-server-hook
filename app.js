var express = require('express');
var app = express();
var when = require('when');
var fs = require('fs');
var path = require('path');
//var msgQueue = require('./msg_queue');

var GithubEvents = require('./github_events');

var amqpUri = null;
if (process.env.CLOUDAMQP_URL) {
  amqpUri = process.env.CLOUDAMQP_URL;
} else if (process.env.AMQP_URI) {
  amqpUri = process.env.AMQP_URI;
} else {
  amqpUri = 'amqp://localhost';
}

var githubEvents = new GithubEvents();
githubEvents.openConnection(amqpUri)
  .then(function (conn) {
    app.brokerConncetion = conn;
  });

function error(msg) {
  return JSON.stringify({'error': msg});
}

function success(msg) {
  return JSON.stringify({'outcome': msg});
}

app.use(express.json());
app.use(express.urlencoded());

app.get('/', function(req, res) {
  res.send('200', 'Server is up!'); 
});

function handle(type, delivery_id, payload) {
  return githubEvents.insertJson({
    type: type,
    delivery_id: delivery_id,
    payload: payload,
  });
}


// curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \
//   --header "Content-Type:application/json" \
//   --header "X-GitHub-Event:pull_request" \
//   --header "X-GitHub-Delivery:testing-guid"
app.post('/github/v3', function(req, res) {
  var type = req.get('X-GitHub-Event');
  var delivery_id = req.get('X-GitHub-Delivery');
  handle(type, delivery_id, req.body)
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

console.log('Starting up server!');
app.listen(process.env.PORT || 7040);
