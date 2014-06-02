var when = require('when');
var gaiaTry = require('./gaia_try');

var amqpUri = require('./amqp_uri');
var CommitEvents = require('./commit_events');
var Connection = require('./msg_broker');

var commitEvents = new CommitEvents();
var connection = new Connection(amqpUri);

console.log('Message Broker URI: ' + amqpUri);

function exitOnClose () {
  console.log('Exiting because of channel or connection close');
  process.exit();
}

connection.open()
  .then(commitEvents.bindConnection(connection))
  .then(
    function() {
      connection.createChannel().then(function (ch) {
        ch.prefetch(1, true);
        commitEvents.addConsumer(gaiaTry.commit, ch, 'gaia_try_commit');
      } );
    }
  )
  .done()

