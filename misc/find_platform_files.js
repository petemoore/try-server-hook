'use strict';

var debug = require('debug')('try-server-hook:find_platform_files');
var platformFiles = require('./platform_files');

process.on('message', function(msg) {
  debug('Received a request from mommy and daddy: %s', msg);
  var pfFiles = platformFiles.all(msg, function(err, contents) {
    process.send({err:err, contents: contents});
  })
});
