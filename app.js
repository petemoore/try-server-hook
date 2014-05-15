var express = require('express');
var app = express();
var when = require('when');
var fs = require('fs');
var path = require('path');

// This is all sync because it's startup code and I don't want to wrap the
// entire application in a callback
var eventsDir = path.join(__dirname, 'events')
var eventModules = fs.readdirSync(eventsDir);
var eventHandlers = [];
eventModules.forEach(function(module) {
  // This regex shouldn't need to be here, but js lacks
  // a sane string.prototype.endsWith() :'(
  // Not concerned about performance here because it's done infrequently
  if (/^event_.*\.js$/.exec(module)) {
    console.log('Using event handling module ' + module);
    eventHandlers.push(require(path.join(eventsDir, module)));
  }
});

function error(msg) {
  return JSON.stringify({'error': msg});
}

function success(msg) {
  return JSON.stringify({'outcome': msg});
}

function handleEvent(delivery_id, type, payload) {
  var eventPromises = [];
  eventHandlers.forEach(function(e) {
    if (e.interesting(type, payload)) {
      console.log(e.name + ' event is interested in this event');
      eventPromises.push(e.handle(type, payload));
    } else {
      console.log(e.name + ' event is ignoring this event');
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
