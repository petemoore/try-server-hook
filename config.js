"use strict";

var fs = require('fs');
var path = require('path');
var logging = require('./misc/logging');

var configDir = path.join(__dirname, 'config');
var defaultsFile = path.join(configDir, 'default.json');
var environment = process.env.NODE_ENV || 'local';
var envFile = path.join(configDir, environment + '.json');
var log = logging.setup(__filename);

log.info('Environment: %s', environment);

var watchingEnvFile = false;

function Config (options) {
  this.options = options;
};

Config.prototype = {
  get: function (key) {
    if (!this.options) {
      log.warn('Trying to get a config var before we\'ve read the file');
      return undefined;
    } else if (process.env[key]) {
      log.debug('Reading %s from environment', key);
      return process.env[key]
    } else {
      log.debug('Reading %s from a file', key);
      return this.options[key]
    }
  },
  getBool: function(key) {
    var raw = this.get(key);
    if (typeof raw === 'boolean') {
      return raw;
    } else if (typeof raw === 'string') {
      if (raw === '0' || raw === 'false') {
        return false;
      } else if (raw === '1' || raw === 'true') {
        return true;
      }
    } else if (typeof raw === 'number') {
      return raw != 0;
    }
    throw new Error('Can\'t figure out whether ' + raw + ' is truthy');
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
  try {
    load(options, JSON.parse(fs.readFileSync(defaultsFile)));
    if (fs.existsSync(envFile)) {
      load(options, JSON.parse(fs.readFileSync(envFile)));
    }
    config.options = options;
  } catch (err) {
    log.error(err, 'Error loading configuration files');
  }
}

update();

fs.watch(configDir, {persistent: false}, function(action, filename) {
  if (filename) {
    if (filename === path.basename(defaultsFile) || filename === path.basename(envFile)){
      log.debug('Reloading config because defaults file %s %s', filename, action);
      update();
    }
  } else {
    log.debug('Reloading config because some file changed in config/ and I don\'t know which');
    update();
  }
});





module.exports = config;
