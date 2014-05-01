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

  return when(amqp.connect(amqpUri, {heartbeat: 15}).then(function(conn) {
    debug('Connected to message broker');
    return when(conn.createChannel().then(function(ch) {
      debug('Channel created');
      return assertSchema(ch)
        .then(function () {
          debug('Publishing message');
          function x() { 
            return ch.publish(
            exchange,
            '',
            new Buffer(json_pr),
            {
              persistent: true,
              contentType: 'application/json',
            })
          }
          var outcome = x();
          if (outcome) {
            debug('Message published');
            return ch.close();
          } else {
            debug('Message queue write buffer is full');
            // I should figure out how the drain event should be handled
            // and handle it better than just rejecting the request
            return promise.reject('message broker write buffer is full');
          }
        });
    })).ensure(function() { conn.close() } );
  }));
}


function registerConsumer(action, onConnClose, onChClose) {
  return when(amqp.connect(amqpUri, {heartbeat: 15}).then(function(conn) {
    debug('Connected to message broker');
    conn.on('error', function (err) {
      debug('Connection to message broker experienced an error:\n' + err);
    });
    if (onConnClose) {
      conn.on('close', onConnClose);
    }
    return when(conn.createChannel().then(function(ch) {
      ch.on('error', function (err) {
        debug('Channel experienced an error:\n' + err);
      });
      if (onChClose) {
        ch.on('close', onChClose);
      }
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
            hDebug(new Date().toString() + 'Received message:\n' + msg.content);
            
            action(pr, function(err) {
              if (err) {
                hDebug(new Date().toString() + 'Action failed');
                ch.reject(msg, true);
              } else {
                hDebug(new Date().toString() + 'Action passed!');
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
  enqueue: enqueue,
  assertSchema: assertSchema,
  registerConsumer: registerConsumer,
}
