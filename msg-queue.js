var when = require('when');
var _debug = require('debug');
var debug = _debug('message-queue');
var hDebug = _debug('message-handler');
var amqp = require('amqplib');

//http://www.squaremobius.net/amqp.node/doc/channel_api.html

var exchange = 'incoming_pr';
var queue = 'incoming_pr_queue';

var amqpUri
if (process.env.CLOUDAMQP_URL) {
  amqpUri = process.env.CLOUDAMQP_URL;
} else if (process.env.AMQP_URI) {
  amqpUri = process.env.AMQP_URI;
} else {
  amqpUri = 'amqp://localhost';
}
debug('Using AMQP Message Broker at: ' + amqpUri);

function assertSchema(ch) {
  return ch.assertExchange(exchange, 'fanout', {durable: true})
    .then(ch.assertQueue(queue, {durable: true}))
    .then(function (assertedQueue) {
          debug('Asserted queue');
          return ch.bindQueue(queue, exchange, '').then(function() {
            return assertedQueue;
          })
        })
}

function enqueue(pullRequest) {
  try {
    var json_pr = JSON.stringify(pullRequest);
  } catch(e) {
    return when.reject(e);
  }

  return when(amqp.connect(amqpUri).then(function(conn) {
    debug('Connected to message broker');
    return when(conn.createChannel().then(function(ch) {
      debug('Channel created');
      return assertSchema(ch)
        .then(function () {
          debug('Publishing message');
          ch.publish(
            exchange,
            '',
            new Buffer(json_pr),
            {
              persistent: true,
              contentType: 'application/json',
            })
          debug('Message published');
          return ch.close();
        });
    })).ensure(function() { conn.close() } );
  }));
}


function registerConsumer(action) {
  return when(amqp.connect(amqpUri).then(function(conn) {
    debug('Connected to message broker');
    return when(conn.createChannel().then(function(ch) {
      debug('Channel created');
      return assertSchema(ch)
        .then(function () { ch.prefetch(1); })
        .then(function () {
          debug('Registering message consumer');

          function handle(msg) {
            if (msg === null) {
              hDebug('Message from queue is null, this handler is cancelled');
              return
            }
            try {
              var pr = JSON.parse(msg.content);
            } catch(e) {
              hDebug('Unable to parse JSON, discarding message\n' + msg.content);
              ch.reject(msg);
              return
            }
            hDebug('Received message:\n' + msg.content);
            
            action(pr, function(err) {
              if (err) {
                hDebug('Action failed');
                ch.reject(msg, true);
              } else {
                hDebug('Action passed!');
                ch.ack(msg);
              }
            });
          };

          debug('Registering consumer for queue: ' + queue);
          ch.consume(queue, handle, {noAck: false});
          debug('Message consumer registered');
        });
      
    }))
  }));

}

module.exports = {
  QUEUE: queue,
  EXCHANGE: exchange,
  enqueue: enqueue,
  assertSchema: assertSchema,
  registerConsumer: registerConsumer,
}
