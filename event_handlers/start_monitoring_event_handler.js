"use strict";

var config = require('../config');
var pg = require('pg');
var debug = require('debug')('try-server-hook:start_monitoring_event_handler');
var util = require('util');

var BaseEventHandler = require('./base_event');

function StartMonitoringEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
  this.dburl = config.get('DATABASE_URL');
  if (!this.dburl || this.dburl === '') {
    throw new Error('could not load db url'); 
  }
}

util.inherits(StartMonitoringEventHandler, BaseEventHandler);

//http://clarkdave.net/2013/06/what-can-you-do-with-postgresql-and-json/
//https://github.com/brianc/node-postgres/wiki/

StartMonitoringEventHandler.prototype.name = 'Start monitoring';
StartMonitoringEventHandler.prototype.handle = function (msg, callback) {
  var state = msg.state;
  pg.connect(this.dburl, function(err, client) {
    if(err) {
      return callback(err);
    }
    var insertSql = 'INSERT INTO gaia_try_monitor (hg_id, state, upstream) VALUES ($1, $2, $3)';
    client.query(insertSql, [msg.hg_id, msg.state, JSON.stringify(msg)], function (err, result) {
      if (err) {
        return callback(err);
      }
      console.log('Inserted commit into monitoring system');
      return callback(null);
    });
  });
};

module.exports = StartMonitoringEventHandler;

