'use strict';

var bunyan = require('bunyan');
var path = require('path');

// This is done because of the express bunyan
// logger interface module requiring a config
// object instead of a logger instance
function makeConfig() {
  return {
    streams: [
      {
        level: bunyan.TRACE,
        stream: process.stdout
      },
      {
        type: 'rotating-file',
        level: bunyan.TRACE,
        path: '/var/log/hook/log',
        period: '1d',
        count: 10
      }
    ]
  };
}

function setup(filename) {
  var config = makeConfig(); 
  config.name = path.basename(filename);
  var logger = bunyan.createLogger(config);
  return logger;
}

module.exports = {
  setup: setup,
  makeConfig: makeConfig
};
