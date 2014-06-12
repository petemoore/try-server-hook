var amqpUri = require('./amqp_uri');
var Connection = require('./msg_broker');
var connection = new Connection(amqpUri);
var IRCSendEvents = require('./irc_send_events');
var ircSendEvents = new IRCSendEvents();

connection.open()
  .then(ircSendEvents.bindConnection(connection))
  .then(function () {
    return ircSendEvents.insertJson({'message': process.argv.slice(2).join(' ')}).then(console.log, console.err)
  })
  .then(function() {
    connection.close();
  })
  .done()
