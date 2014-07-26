'use strict';

var fs = require('fs');
var when = require('when');
var amqp = require('amqplib');
var util = require('util');
var logging = require('./misc/logging');

var log = logging.setup(__filename);

var schemaFile = 'amqp_schema.json';
var schema = JSON.parse(fs.readFileSync(schemaFile));
if (!validateSchema(schema)) {
  throw new Error('Invalid Schema');
}


function parseMsg(contentType, msg) {
  return when.promise(function(resolve, reject) {
    switch (contentType) {
      case 'application/json':
        parseMsgJson(msg).then(resolve, reject);
        break;
      default:
        log.error('Cannot parse unknown content type %s', contentType);
        reject(new Error('Unsupported content type: ' + contentType));
    }
  });
}


function parseMsgJson(msg) {
  return when.promise(function(resolve, reject) {
    try {
      var obj = JSON.parse(msg);
    } catch (e) {
      log.error('Failed to parse JSON: %s', e.stack || e);
      reject(e);
    }
    resolve(obj);
  });
}


function serialiseMsg(contentType, msg) {
  return when.promise(function(resolve, reject) {
    switch (contentType) {
      case 'application/json':
        serialiseMsgJson(msg).then(resolve, reject);
        break;
      default:
        log.error('Cannot serialise unknown content type %s', contentType);
        reject(new Error('Unsupported content type: ' + contentType));
    }
  });
}


function serialiseMsgJson(msg) {
  return when.promise(function(resolve, reject) {
    try {
      var jsons = JSON.stringify(msg);
    } catch (e) {
      log.error('Failed to serialise JSON: %s', e.stack || e);
      reject(e);
    }
    resolve(jsons);
  });
}


function validateSchema(schema) {
  var exchangeNames = [];
  var queueNames = [];

  if (typeof schema.prefix !== 'string') {
    log.error('Invalid schema prefix: %s', schema.prefix);
    return false;
  }

  schema.exchanges.forEach(function(e) {
    exchangeNames.push(e.name);
  });

  schema.queues.forEach(function(q) {
    queueNames.push(q.name);
  });

  schema.bindings.forEach(function(e) {
    var boundExchange = e.exchange;
    var boundQueue = e.queue;
    if (queueNames.indexOf(boundQueue) === -1 || exchangeNames.indexOf(boundExchange) === -1) {
      log.error('Cannot bind %s to %s because one doesn\'t exist', boundQueue, boundExchange);
      return false;
    }
  });
  log.debug('Valid Schema');
  return true;
}


function wrap(name) {
  var wrapped = util.format('%s.%s', schema.prefix, name);
  log.trace('Wrapped %s -> %s', name, wrapped);
  return wrapped;
}


function unwrap(name) {
  var unwrapped = name.split(schema.prefix + '.')[0];
  log.trace('Unwrapped %s -> %s', name, unwrapped);
  return unwrapped;
}


function assertSchema(connection) {
  return when.promise(function(resolve, reject)  {
    log.debug('Asserting schema');
    var promises = [];
    if (!connection) {
      reject('Must have a connection');
    }
    connection.createChannel().then(function(ch) {
      schema.exchanges.forEach(function(e) {
        promises.push(ch.assertExchange(wrap(e.name), e.type, e.options));
      });

      schema.queues.forEach(function(q) {
        if (!q.options) {
          q.options = { durable: true};
        } else if (!q.options.durable === false) {
          q.options = {durable: true};
        }
        promises.push(ch.assertQueue(wrap(q.name), q.options));
      });

      schema.bindings.forEach(function(b) {
        promises.push(ch.bindQueue(wrap(b.queue), wrap(b.exchange), b.routing_key));
      });

      when.all(promises).then(function(x) {
        ch.close();
        log.debug('Asserted schema');
        resolve(connection);
      }).done();
    });
  });
}


// For now, always persistent and to '' for routing key
// Do insertions on their own channel
function insert(connection, exchange, routingKey, payload) {
  return when.promise(function(resolve, reject) {
    log.info('Inserting message');
    var msgFormat = schema.msg_format;
    serialiseMsg(msgFormat, payload).then(function(msg) {
      log.debug('Serialised payload');
      if (typeof msg !== 'string') {
        reject('Message must serialise to string');
      }
      var pubOpts = {
        persistent: true,
        mandatory: true,
        contentType: msgFormat
      };
      connection.createConfirmChannel().then(function(ch) {
          return insertCh(ch, exchange, routingKey, payload).then(function() {
            return ch.close().then(function() { resolve(connection); });
          });
        });
      }).done();
    });
}

// For now, always persistent and to '' for routing key
// Do insertions on existing channel
function insertCh(ch, exchange, routingKey, payload) {
  return when.promise(function(resolve, reject) {
    var msgFormat = schema.msg_format;
    serialiseMsg(msgFormat, payload).then(function(msg) {
      if (typeof msg !== 'string') {
        reject('Message must serialise to string');
      }
      var pubOpts = {
        persistent: true,
        mandatory: true,
        contentType: msgFormat
      };
      ch.publish(wrap(exchange), routingKey, new Buffer(msg, 'utf-8'), pubOpts, function(err, ok) {
        if (err) {
          log.error(err, 'Failed to insert msg');
          reject(err);
        }
        log.info('Published to %s exchange with routing key %s', exchange, routingKey);
        resolve(ch);
      });
    }).done();
  });
}

// Action is a function that takes an Object and a Callback.
// The object is a parsed object that was on the queue and the
// callback takes (err, retry).  Truthy err means
// that the action failed, retry is a boolean that decides whether
// to requeue the job to try again
function addConsumer(channel, queue, handler, onChClose, onChError) {
  return when.promise(function(resolve, reject) {
    if (!channel || !queue || !handler || !handler.makeAction) {
      reject('Missing channel, queue, handler or handler.makeAction');
    }
    var actionName = handler.name || 'unnamed';
    var action = handler.makeAction(channel);
    if (onChClose) {
      channel.on('close', onChClose);
    }
    if (onChError) {
      channel.on('error', onChError);
    }
    channel.on('error', function(err) {
      log.error(err, 'Channel error: %s', err);
    });

    function consumer(msg) {
      if (!msg) {
        log.info('%s consumer cancelled', actionName);
      }

      parseMsg(msg.properties.contentType, msg.content).then(
        function(obj) {
          log.debug('Parsed message for %s consumer', actionName);

          try {
            // Actually call the action!
            action(obj, msg.fields.routingKey, function(err, retry, dsMsg) {
              if (err) {
                console.log(err.stack || err);
                if (retry) {
                  var doRetry;
                  if (!msg.retry) {
                    msg.retry = 5;
                    log.debug('First failure, retrying %s', actionName);
                    doRetry = true;
                  } else {
                    msg.retry--;
                    if (msg.retry > 0) {
                      log.debug('%s has %d retries left', actionName, msg.retry);
                      doRetry = true;
                    } else {
                      log.debug('%s has exhausted all retries, rejecting', msg.retry);
                      doRetry = false;
                    }
                  }
                } else {
                  log.debug('Rejecting a %s, not retrying', actionName);
                  doRetry = false;
                }
                channel.reject(msg, doRetry);
              } else if (!err && retry) {
                //This is a special case for things that need to repeat
                log.debug('Successfully processed %s, but rejecting msg to requeue', actionName);
                chanel.reject(msg, true);
              } else {
                log.debug('Successfully processed %s', actionName);
                channel.ack(msg);
              }
            });
          } catch (err) {
            log.error(err, 'Error running action %s', actionName);
          }
        },
        function(err) {
          log.error(err, 'Error parsing message for %s consumer', actionName); 
          channel.reject(msg, false);
        }).done();
    }
    channel.consume(wrap(queue), consumer, {noAck: false}).then(function(tagObj) {
      log.debug('Created %s consumer %s', actionName, tagObj.consumerTag);
      resolve(tagObj);
    }, reject);
  });
}

module.exports = {
  wrap: wrap,
  unwrap: unwrap,
  assertSchema: assertSchema,
  insert: insert,
  insertCh: insertCh,
  addConsumer: addConsumer
};
