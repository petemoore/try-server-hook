'use strict';
var express = require('express');
var when = require('when');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('try-server-hook:app');
var msgBroker = require('./msg_broker');
var crypto = require('crypto');
var morgan = require('morgan');

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

function githubHmacAuthenticator(fatal) {
  return function(req, res, next) {
    if (!req.get('X-Hub-Signature')) {
      debug('Ignoring HMAC for request because it lacks a signature');
      return next();
    }
    var headerBits = req.get('X-Hub-Signature').split('=');
    if (headerBits.length !== 2) {
      next('This message has a Github Signature but it\'s invalid');
    }
    var algo = headerBits[0];
    var originDigest = headerBits[1];
    var hmacKey = config.get('GITHUB_API_HMAC_KEY');
    var hmac = crypto.createHmac(algo, hmacKey);
    var data = '';

    req.on('data', function(chunk) {
      debug('chunkitychunkchunk');
      hmac.update(chunk); 
      data += chunk;
    });

    req.on('end', function() {
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        next(e);
      }
      req.computedHmacDigest = hmac.digest('hex');
      debug('Computed HMAC for request using %s to be %s', algo, req.computedHmacDigest);
      debug('Expected HMAC to be %s', originDigest);
      if (req.computedHmacDigest === originDigest) {
        debug('HMAC Authenticated');
        next();
      } else if (fatal) {
        next(error('HMAC Authentication failure'));
      } else {
        debug('Ignoring HMAC Failure');
        next();
      }
    });
  }
}

app.use(morgan());
app.use(githubHmacAuthenticator(config.getBool('GITHUB_API_REQUIRE_HMAC')));
//app.use(express.json());
//app.use(express.urlencoded());

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
    var payload = {type: type, delivery_id: deliveryId, content: req.body};
    var hmacInfo = req.get('X-Hub-Signature').split('=');
    try {
      var hmacAlgo = hmacInfo[0]; 
      var hmacDigest = hmacInfo[1];
    } catch (e) {
      debug('Error doing HMAC Authentication');
      debug(e.stack || e);
      res.send(500, error('Failed HMAC Authentication'));
    }

  
    if (req.computedHmacDigest === hmacDigest) {
      debug('HMAC authentication is successful');
    } else {
      debug('HMAC authentication failed, request: %s computed: %s', hmacDigest, req.computedHmacDigest || 'not computed');
    }

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
