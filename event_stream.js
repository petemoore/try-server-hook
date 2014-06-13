"use strict";

var when = require('when');
var amqp = require('amqplib');

// Useful documentation
//http://www.squaremobius.net/amqp.node/doc/channel_api.html
//http://www.rabbitmq.com/consumer-prefetch.html


function parseMsg (contentType, msg) {
  return when.promise(function(resolve, reject) {
    switch(contentType) {
      case 'application/json':
        parseMsgJson(msg).then(resolve, reject);
        break;
      default:
        reject(new Error('Unsupported content type: ' + contentType));
    }
  });
}

function parseMsgJson(msg) {
  return when.promise(function(resolve, reject) {
    try {
      var obj = JSON.parse(msg);
    } catch(e) {
      reject(e);
    }
    resolve(obj);
  });
}

function serialiseMsg (contentType, msg) {
  return when.promise(function(resolve, reject) {
    switch(contentType) {
      case 'application/json':
        serialiseMsgJson(msg).then(resolve, reject);
        break;
      default:
        reject(new Error('Unsupported content type: ' + contentType));
    }
  });
}

function serialiseMsgJson(msg) {
  return when.promise(function(resolve, reject) {
    try {
      var jsons = JSON.stringify(msg);
    } catch(e) {
      reject(e);
    }
    resolve(jsons);
  });
}

function EventStream(exchange, queues, prefetch) {
  this.exchange = exchange;
  this.queues = queues;
  if (prefetch) {
    this.prefetch = prefetch;
  }
  this.consumers = [];
  console.log(exchange + ' bound to queues');
  queues.forEach(function (e) {
    console.log('  * ' + e);
  });
}


EventStream.prototype = {
  bindConnection: function(conn) {
    this.conn = conn;
    return this.conn.createChannel().then(function (ch) {
      return this._assert(ch);
    });
  },
  addQueue: function(queue) {
    this.queues.push(queue);
  },
  _assert: function(ch) {
    var promises = [ch.assertExchange(this.exchange, 'fanout', { durable: true} )];
    console.log('Creating assert promise for exchange ' + this.exchange);
    this.queues.forEach(function(i) {
      promises.push(ch.assertQueue(i, { durable: true}));
      promises.push(ch.bindQueue(i, this.exchange, ''));
      console.log('  * promise for queue ' + i);
    }.bind(this));
    return when.all(promises).then(function (x) {
      console.log('Asserted queues, exchanges and bindings');
      return x;
    });
  },
  insert: function(payload, contentType) {
    return when(
      this.conn.createChannel().then(function (ch) {    
        return this._assert(ch).then(function() {
          if (typeof payload !== 'string') {
            return when.reject('Payload must be a string');
          }
          if (typeof contentType !== 'string') {
            return when.reject('Content type must be a string');
          }
          console.log('Publishing message');
          var pubOpts = {
            persistent: true,
            contentType: contentType
          };
          var outcome = ch.publish(this.exchange, '', new Buffer(payload), pubOpts);
          if (outcome) {
            console.log('Message published');
            return ch.close().then(function() { return when.resolve('Inserted')});
          } else {
            // I should really figure out how the drain event works and use it here.
            console.log('Message Queue write buffer is full');
            return when.reject('Message broker write buffer is full');
          }
        }.bind(this))
      }.bind(this))
    )
  },
  insertJson: function(payload) {
    try {
      var payload_json = JSON.stringify(payload);
    } catch (e) {
      console.log(e);
      console.log(e.stack || 'no stack');
      return when.reject('Failed to serialise an AMQP payload for insertion');
    }
    return this.insert(payload_json, 'application/json');
  },
  // This should really be like pineapple.queue('lala').addConsumer(ch, action)
  addConsumer: function (action, channel, queue, onChClose) {
    if (onChClose) channel.on('close', onChClose); 

    return this._assert(channel).then(function () {
      
      function handleMsg(msg) {
        if (!msg) {
          console.log('This consumer was canceled');
          return;
        }

        parseMsg(msg.properties.contentType, msg.content).then(
          function (obj) {
            action(obj, function (err, retry) {
              if (err) {
                console.log('Action failed');
                console.log(err.stack || err);
                channel.reject(msg, !!retry);
              } else {
                console.log('Action worked');
                channel.ack(msg);
              }
            });
          },
          function (err) {
            channel.reject(msg, false); 
          }
        );
      }

      channel.consume(queue, handleMsg, {noAck: false}).then(function (tagObj) {
        console.log('Consumer created');
        return tagObj;
      });
    }.bind(this));
  }
}

module.exports = EventStream;
