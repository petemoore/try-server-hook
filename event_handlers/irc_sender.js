// Sadly, the IRC library breaks in strict mode
var when = require('when');
var BaseEventHandler = require('./base_event');
var jerk = require('jerk');
var url = require('url');
var util = require('util');

function cyfn(message) {
  message.say(message.user + ': https://i.imgur.com/tM2E2kI.png');
}

var commands = [
  {
    action: function (m) { m.say(String(new Date().toUTCString())); },
    aliases: ['mozilla time', 'time', 'mozilla standard time']
  },
  {
    action: function (m) { m.say(String(new Date().toUTCString())); },
    aliases: ['utc time']
  }
]

function IRCSender(downstreams, server, username, channels) {
  BaseEventHandler.call(this, downstreams);
  if (channels instanceof Array){
    this.channels = channels;
  } else {
    this.channels = [channels];
  }

  this.username = username

  this.server = url.parse(server);
  if (this.server.protocol === 'ircs:') {
    this.secure = true;
  } else if(this.server.protocol !== 'irc:') {
    this.secure = false;
  }
  this.jerk = jerk(function (j) {

    commands.forEach(function(command) {
      command.aliases.forEach(function(alias) {
        var regexp = new RegExp('^' + this.username + ': ' + alias);
        j.watch_for(regexp, command.action);
      }, this);
    }, this);

    //j.watch_for(new RegExp('^' + this.username + ': (die)|(exit)|(stop)|(quit)|(leave)|(kill)'), cyfn);
  }.bind(this)).connect({
    server: this.server.hostname,
    channels: this.channels,
    nick: this.username,
    log: true,
    die: true,
    flood_protection: true,
    user: {
      username: 'gerty',
      hostname: 'host',
      servername: 'server',
      realname: 'Gertrude Crashington'
    }
  });


}

IRCSender.prototype = Object.create(BaseEventHandler.prototype);
IRCSender.prototype.constructor = IRCSender;

IRCSender.prototype.handle = function(msg, callback) {
  if (!msg || !msg.message) {
    return callback(new Error('Invalid message'));
  }
  console.log('Handling an IRC event');

  this.channels.forEach(function(channel) {
    this.jerk.say(channel, msg.message);
  }, this); 
  callback(null);
};

module.exports = IRCSender;
