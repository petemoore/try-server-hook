"use strict";

var config = require('../config');
var pg = require('pg').native;
var msgBroker = require('../msg_broker');
var debug = require('debug')('try-server-hook:check_tests_event_handler');
var util = require('util');

var BaseEventHandler = require('./base_event');

function CheckTestsEventHandler(amqpConn, downstreams) {
  BaseEventHandler.call(this, downstreams);
  this.amqpConn = amqpConn;
}

util.inherits(CheckTestsEventHandler, BaseEventHandler);

//http://clarkdave.net/2013/06/what-can-you-do-with-postgresql-and-json/
//https://github.com/brianc/node-postgres/wiki/

CheckTestsEventHandler.prototype.name = 'Check on all tests';
CheckTestsEventHandler.prototype.handle = function (msg, callback) {
  pg.connect(config.get('DATABASE_URL'), function(err, client, done) {
    if (err) {
      return callback(err, true);
    }
    // I wonder if there's any value to ordering by submitted time?
    var query = 'SELECT id FROM revisions WHERE completed IS NULL';
    
    debug('QUERY: %s', query);
    var query = client.query(query);
  
    query.on('row', function(row) {
      var hg_id = row.id;
      this.amqpConn.open().then(function(conn) {
        return msgBroker.insert(conn, 'buildapi_jobs', 'single_test', hg_id);
      }).done();
    }.bind(this));

    query.on('end', function(row) {
      debug('Finished creating build check jobs');
      callback(null, null);
    });

    query.once('error', function(error) {
      callback(error, true);
    });

  }.bind(this));
};

module.exports = CheckTestsEventHandler;

