var when = require('when');
var debug = require('debug')('consumer');

var createCommit = require('./create_commit');
var msgQueue = require('./msg-queue');

console.log('Starting consumer');

msgQueue.registerConsumer(createCommit.run)
  .then(console.log, console.error).done();
