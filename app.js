'use strict';

var config = require('./config');
var express = require('express');
var msgBroker = require('./msg_broker');
var crypto = require('crypto');
var morgan = require('morgan');
var util = require('util');
var logging = require('./misc/logging');
var expressBunyanLogger = require('express-bunyan-logger');


var log = logging.setup(__filename);
var port = config.get('PORT') || 7040;
var Connection = require('./connection');

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
      log.warn('Ignoring HMAC for request because it lacks a signature');
      return next();
    }
    var headerBits = req.get('X-Hub-Signature').split('=');
    if (headerBits.length !== 2) {
      log.error('Message has an invalid Github Signature');
      next('This message has a Github Signature but it\'s invalid');
    }
    var algo = headerBits[0];
    var originDigest = headerBits[1];
    var hmacKey = config.get('GITHUB_API_HMAC_KEY');
    var hmac = crypto.createHmac(algo, hmacKey);
    var data = '';

    req.on('data', function(chunk) {
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
      log.info('Computed HMAC for request using %s to be %s', algo, req.computedHmacDigest);
      log.info('Expected HMAC to be %s', originDigest);
      if (req.computedHmacDigest === originDigest) {
        log.debug('HMAC Authenticated');
        next();
      } else if (fatal) {
        log.error('HMAC authentication failure');
        next(error('HMAC authentication failure'));
      } else {
        log.debug('Ignoring HMAC Failure');
        next();
      }
    });
  }
}

var expressLogConfig = logging.makeConfig();
expressLogConfig.name = 'express-app.js';
expressLogConfig.excludes = ['body'];
app.use(expressBunyanLogger(expressLogConfig));
app.use(githubHmacAuthenticator(config.getBool('GITHUB_API_REQUIRE_HMAC')));

app.connection = new Connection();

app.get('/', function(req, res) {
    res.send('200', 'Server is up!');
});

app.post('/github/v3', function(req, res) {
    req.accepts('application/json');
    var type = req.get('X-GitHub-Event');
    var deliveryId = req.get('X-GitHub-Delivery');
    var payload = {type: type, delivery_id: deliveryId, content: req.body};

    var exchange = 'incoming_github_api_events';
    var routingKey = util.format('github.%s', type);
    console.log('>>> DEBUG', exchange, routingKey);

    try {
      app.connection.open().then(function(conn) {
          function passed() {
            log.info('Published a %s (%s) into %s', type, deliveryId, exchange);
            res.send(200, success({ inserted: true }));
          }
          function failed(err) {
            log.error(err, "Failed to insert a %s (%s) into %s", type, deliveryId, exchange);
            res.send(500, error(outcome.message || outcome));
          }
          msgBroker.insert(conn, exchange, routingKey, payload).then(passed, failed).done();
      }).done();
    } catch (e) {
      console.log(e.stack || e);
    }
});

app.connection.on('close', function() {
    log.info('Exiting because of AMQP connection closure');
    process.exit(1);
});

app.connection.on('error', function(err) {
  log.error(err, "AMQP connection error");
});

app.connection.open().then(
  function () {
    var port = config.get('PORT') || 7040;
    log.info('Listening on port %d', port);
    app.listen(port);
  }
).done();
