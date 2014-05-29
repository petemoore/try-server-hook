var when = require('when');
var amqp = require('amqplib');

var amqpUri
if (process.env.CLOUDAMQP_URL) {
  amqpUri = process.env.CLOUDAMQP_URL;
} else if (process.env.AMQP_URI) {
  amqpUri = process.env.AMQP_URI;
} else {
  amqpUri = 'amqp://localhost';
}
console.log('Using AMQP Message Broker at: ' + amqpUri);

//http://www.squaremobius.net/amqp.node/doc/channel_api.html

function Pineapple(conn, exchange, queues) {
  this.exchange = exchange;
  this.queues = queues;
}

Pineapple.prototype = {
  addQueue: function(queue) {
    this.queues.push(queue);
  },
  _assert: function(ch) {
    var promises = [ch.assertExchange(this.exchange, 'fanout', { durable: true} )];
    this.queues.forEach(function(i) {
      promises.push(ch.assertQueue(i, { durable: true}));
      promises.push(ch.bindQueue(i, this.exchange, ''));
    }.bind(this));
    return when.all(promises);
  },
  _openChannel: function(conn) {
    return conn.createChannel();
  },
  insert: function(conn, payload, contentType) {
    return this._openChannel(conn).then(this._assert())
      .then(function () {
        if (typeof payload !== 'string') {
          return when.reject('Payload must be a string');
        }
        console.log('Publishing message');
        var pubOpts = {
          persistent: true,
          contentType: contentType || 'application/json'
        };
        var outcome = ch.publish(this.exchange, '', new Buffer(payload), pubOpts);
        if (outcome) {
          console.log('Message published');
          return ch.close();
        } else {
          console.log('Message queue write buffer is full');
          // I should figure out how the drain event should be handled
          // and handle it better than just rejecting the request
          return promise.reject('message broker write buffer is full');
        }
    }.bind(this));
  }
}

var GithubEventInput = new Pineapple('incoming_gh_events', ['incoming_gh_events_queue']);

function enqueue(payload) {
  try {
    var payload_json = JSON.stringify(payload);
  } catch(e) {
    return when.reject(e);
  }

  return when(amqp.connect(amqpUri, {heartbeat: 15}).then(function(conn) {
    console.log('Connected to message broker');
      return GithubEventInput.insert(conn, payload_json);
    })).ensure(function() { conn.close() } );
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
  //assertSchema: assertSchema,
  registerConsumer: registerConsumer,
}
