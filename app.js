var express = require('express');
var app = express();
var debug = require('debug')('github-event-receiver');
var when = require('when');


var eventPr = require('./event-pr');
var q = require('./msg-queue');

function error(msg) {
  return JSON.stringify({'error': msg});
}

function success(msg) {
  return JSON.stringify({'outcome': msg});
}

function handlePullRequestEvent(payload) {
  return when.promise(function (resolve, reject) {
    if (eventPr.interesting(payload)) {
      debug('Handling Pull Request');
      try {
        var pr = eventPr.parse(payload);
        debug('Parsed PR');
      } catch(e) {
        debug('Failed to parse PR');
        reject(new Error('Could not parse PR Payload: ' + e));
      }
      q.enqueue(pr).then(
        function () {
          debug('Enqueued');
          resolve('Success'); 
        },
        function (x) {
          debug('Failed to enqueue:\n' + x);
          reject(x);
        });
    }
  });
}

var eventHandlers = {
  'pull_request': [eventPr]
};

function handleEvent(id, type, payload) {
  debug('Handling ' + type + ' event ' + id);
  var event_promise = null;
  switch(type) {
    case 'pull_request':
      event_promise = handlePullRequestEvent(payload);
      break;
    default:
      var msg = "Skipping unknown event type";
      debug(msg);
      event_promise = when.resolve(msg);
  }
  return event_promise;
}

app.use(express.json());
app.use(express.urlencoded());

app.get('/', function(req, res) {
  res.send('200', 'Server is up!'); 
});

// curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \
//   --header "Content-Type:application/json" \
//   --header "X-GitHub-Event:pull_request" \
//   --header "X-GitHub-Delivery:testing-guid"
app.post('/github/v3', function(req, res) {
  var type = req.get('X-GitHub-Event');
  var delivery_id = req.get('X-GitHub-Delivery');
  handleEvent(delivery_id, type, req.body)
    .then(
      function(outcome) {
        res.send(200, success(outcome));
      },
      function(outcome) {
        if (typeof outcome === 'object' && outcome.message) {
          res.send(500, error(outcome.message));
        } else {
          res.send(500, error(outcome));
        }
      })
    .done();
});

app.listen(process.env.PORT || 7040);
