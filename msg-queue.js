var when = require('when');
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
console.log('Using AMQP Message Broker at: ' + amqpUri);

function assertSchema(ch) {
  return ch.assertExchange(exchange, 'fanout', {durable: true})
    .then(ch.assertQueue(queue, {durable: true}))
    .then(function (assertedQueue) {
          console.log('Asserted queue');
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
    console.log('Connected to message broker');
    return when(conn.createChannel().then(function(ch) {
      console.log('Channel created');
      return assertSchema(ch)
        .then(function () {
          console.log('Publishing message');
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
            console.log('Message published');
            return ch.close();
          } else {
            console.log('Message queue write buffer is full');
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
    console.log('Connected to message broker');
    conn.on('error', function (err) {
      console.log('Connection to message broker experienced an error:\n' + err);
    });
    if (onConnClose) {
      conn.on('close', onConnClose);
    }
    return when(conn.createChannel().then(function(ch) {
      ch.on('error', function (err) {
        console.log('Channel experienced an error:\n' + err);
      });
      if (onChClose) {
        ch.on('close', onChClose);
      }
      console.log('Channel created');
      return assertSchema(ch)
        .then(function () { ch.prefetch(1); })
        .then(function () {
          console.log('Registering message consumer');

          function handle(msg) {
            if (msg === null) {
              console.log('Message from queue is null, this handler is cancelled');
              return
            }
            try {
              var pr = JSON.parse(msg.content);
            } catch(e) {
              console.log('Unable to parse JSON, discarding message\n' + msg.content);
              ch.reject(msg);
              return
            }
            console.log(new Date().toString() + 'Received message:\n' + msg.content);
            
            action(pr, function(err) {
              if (err) {
                console.log(new Date().toString() + 'Action failed');
                ch.reject(msg, true);
              } else {
                console.log(new Date().toString() + 'Action passed!');
                ch.ack(msg);
              }
            });
          };

          console.log('Registering consumer for queue: ' + queue);
          ch.consume(queue, handle, {noAck: false});
          console.log('Message consumer registered');
        });
      
    }))
  }));

}

module.exports = {
  enqueue: enqueue,
  assertSchema: assertSchema,
  registerConsumer: registerConsumer,
}
