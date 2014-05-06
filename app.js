var express = require('express');
var app = express();
var debug = require('debug')('github-event-receiver');
var when = require('when');


var eventPr = require('./event-pr');

function error(msg) {
  return JSON.stringify({'error': msg});
}

function success(msg) {
  return JSON.stringify({'outcome': msg});
}

var eventHandlers = [eventPr];


function handleEvent(delivery_id, type, payload) {
  var eventPromises = [];
  eventHandlers.forEach(function(e) {
    if (e.interesting(type, payload)) {
      debug(e.name + ' event is interested in this event');
      eventPromises.push(e.handle(type, payload));
    } else {
      debug(e.name + ' event is ignoring this event');
    }
  });
  return when.all(eventPromises);
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
