"use strict";

var when = require('when');
var amqp = require('amqplib');

//http://www.squaremobius.net/amqp.node/doc/channel_api.html

function Pineapple(exchange, queues) {
  this.exchange = exchange;
  this.queues = queues;
}


Pineapple.prototype = {
  openConnection: function(amqpUri) {
    return amqp.connect(amqpUri, {heartbeat: 15 * 60})
      .then(function(conn) {
        console.log('Message broker connection established');
        this.conn = conn;
        return conn;
      }.bind(this));
  },
  openChannel: function() {
    return this.conn.createChannel()
      .then(function(ch) {
        console.log('Created channel');
        this.channel = ch;
        return ch
      }.bind(this));
  },
  bindConnection: function(conn) {
    this.conn = conn;
  },
  addQueue: function(queue) {
    this.queues.push(queue);
  },
  _assert: function(ch) {
    var promises = [ch.assertExchange(this.exchange, 'fanout', { durable: true} )];
    this.queues.forEach(function(i) {
      promises.push(ch.assertQueue(i, { durable: true}));
      promises.push(ch.bindQueue(i, this.exchange, ''));
    }.bind(this));
    return when.all(promises).then(function(x) {
      console.log('Exchange ' + this.exchange + ' bound to:');
    }.bind(this));
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
            return ch.close();
          } else {
            // I should really figure out how the drain event works and use it here.
            console.log('Message Queue write buffer is full');
            return promise.reject('Message broker write buffer is full');
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
    }
    return this.insert(payload_json, 'application/json');
  }
}

module.exports = Pineapple;
