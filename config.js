"use strict";

var debug = require('debug')('try-server-hook:config');
var fs = require('fs');
var path = require('path');

var configDir = path.join(__dirname, 'config');
var defaultsFile = path.join(configDir, 'default.json');
var environment = process.env.NODE_ENV || 'local';
var envFile = path.join(configDir, environment + '.json');
debug('Environment: %s', environment);

var watchingEnvFile = false;

function Config (options) {
  this.options = options;
};

Config.prototype = {
  get: function (key) {
    if (!this.options) {
      return undefined;
    } else if (process.env[key]) {
      debug('Reading %s from environment', key);
      return process.env[key]
    } else {
      debug('Reading %s from a file', key);
      return this.options[key]
    }
  }
};

var config = new Config({});

function load(options, obj) {
  Object.keys(obj).forEach(function(key) {
    options[key] = obj[key];
  });
}

function update() {
  var options = {};
  load(options, JSON.parse(fs.readFileSync(defaultsFile)));
  if (fs.existsSync(envFile)) {
    load(options, JSON.parse(fs.readFileSync(envFile)));
  }
  config.options = options;
}

update();

fs.watch(configDir, {persistent: false}, function(action, filename) {
  debug('Reloading config because defaults file %s %s', filename, action);
  update();
});





module.exports = config;
