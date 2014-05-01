var when = require('when');

var createCommit = require('./create_commit');
var msgQueue = require('./msg-queue');

console.log('Starting consumer');

setInterval(function () { console.log('teehee')}, 15*60*1000);

function exitOnClose () {
  console.log('Exiting because of channel or connection close');
  process.exit();
}
msgQueue.registerConsumer(createCommit.run, exitOnClose, exitOnClose).done();
