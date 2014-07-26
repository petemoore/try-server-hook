'use strict';

var config = require('../config');
var pg = require('pg').native;
var msgBroker = require('../msg_broker');
var _buildapi = require('node-buildapi');
var buildapi = _buildapi(
    config.get('BUILD_API_USER'),
    config.get('BUILD_API_PASSWORD')
);
var util = require('util');
var logging = require('../misc/logging');

var log = logging.setup(__filename);

var BaseEventHandler = require('./base_event');

function CheckTestsEventHandler(amqpConn, downstreams) {
  BaseEventHandler.call(this, downstreams);
  this.amqpConn = amqpConn;
}

util.inherits(CheckTestsEventHandler, BaseEventHandler);


function decideBuild(build) {

}

//http://clarkdave.net/2013/06/what-can-you-do-with-postgresql-and-json/
//https://github.com/brianc/node-postgres/wiki/

CheckTestsEventHandler.prototype.name = 'Check on all tests';
CheckTestsEventHandler.prototype.handle = function (msg, callback) {
  pg.connect(config.get('DATABASE_URL'), function(err, client, done) {
    if (err) {
      return callback(err, true);
    }
    
    var info = [];

    buildapi.getRev(msg, config.get('BUILD_API_REPO'), function(err, info) {
      info.forEach(function(build) {
        info.append({
          build_id: build.build_id,
          starttime: build.starttime,
          status: build.status,
          branch: build.branch,
          buildername: build.buildername,
          endtime: build.endtime
        });
      }); 
    });

  }.bind(this));
};

module.exports = CheckTestsEventHandler;

