"use strict";

var when = require('when');
var amqp = require('amqplib');

var Pineapple = require('./pineapple');

console.log('Using AMQP Message Broker at: ' + amqpUri);


var GithubEventInput = new Pineapple('inc_gh', ['inc_gh_wq']);

amqp.connect(amqpUri, {heartbeat: 60*15}).then(function(conn) {
  globalConn = conn; 
  console.log('Created connection');
  conn.createChannel().then(function(ch) {
    globalCh = ch;
    GithubEventInput.bindChannel(ch);
  }).then(function() { console.log('Created channel') });
});


function enqueue(payload) {
  try {
    var payload_json = JSON.stringify(payload);
  } catch(e) {
    return when.reject(e);
  }
  console.log(typeof globalCh);
  return GithubEventInput.insert(payload_json);
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
