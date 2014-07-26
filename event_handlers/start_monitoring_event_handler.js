"use strict";

var config = require('../config');
var pg = require('pg').native;
var util = require('util');
var logging = require('../misc/logging');

var log = logging.setup(__filename);

var BaseEventHandler = require('./base_event');

function StartMonitoringEventHandler(downstreams) {
  BaseEventHandler.call(this, downstreams);
}

util.inherits(StartMonitoringEventHandler, BaseEventHandler);


//http://clarkdave.net/2013/06/what-can-you-do-with-postgresql-and-json/
//https://github.com/brianc/node-postgres/wiki/

StartMonitoringEventHandler.prototype.name = 'Start monitoring';
StartMonitoringEventHandler.prototype.handle = function (msg, callback) {
  var id = msg.hg_id;
  var repository = config.get('HG_REPOSITORY');
  var username = msg.user;
  var obj = msg.pr ? msg.pr : msg.push;
  var commitmsg = msg.commit_message;
  var submitted = new Date().toISOString();
  var eventtype,
      prnum,
      basebranch,
      targetbranch,
      baseremote,
      targetremote,
      basecommit,
      targetcommit;
      
  if (msg.pr) {
    eventtype = 'pull_request';
    prnum = obj.number;
    basebranch = obj.base_ref;
    targetbranch = obj.pr_ref;
    baseremote = obj.base_clone_url;
    targetremote = obj.pr_clone_url;
    basecommit = obj.base_sha;
    targetcommit = obj.pr_sha;
  } else if (msg.push) {
    eventtype = 'push'; 
    prnum = null;
    basebranch = obj.ref.replace(/\/?refs\/heads\//, '');
    targetbranch = obj.ref.replace(/\/?refs\/heads\//, '');
    baseremote = obj.clone_url;
    targetremote = obj.clone_url;
    basecommit = obj.before;
    targetcommit = obj.after;
  } else {
    return callback(new Error('I can only monitor PRs and Pushes'));
  }

  pg.connect(config.get('DATABASE_URL'), function(err, client, done) {
    if (err) {
      return callback(err, true);
    }
    var query = 'INSERT INTO revisions';
    query += '(id, repository, eventtype, prnum, username, basebranch, ';
    query += 'targetbranch, baseremote, targetremote, basecommit, targetcommit, ';
    query += 'commitmsg, upstream, submitted)';
    query += 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)';
    
    var values = [
      id,
      repository,
      eventtype,
      prnum,
      username,
      basebranch,
      targetbranch,
      baseremote,
      targetremote,
      basecommit,
      targetcommit,
      commitmsg,
      JSON.stringify(msg),
      submitted
    ];

    log.debug('QUERY: %s', query);
    log.debug('VALUES: %s', values.join(', '));
    client.query(query, values, function (err, result) {
      done();
      if (err) {
        log.error(err, 'Error inserting: %s', err.stack || err);
        return callback(new Error(err), true);
      }
      log.info('Inserted %s into monitoring DB %s', id);
      return callback(null, null, result);
    });
  });
};

module.exports = StartMonitoringEventHandler;

