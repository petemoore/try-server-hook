'use strict';

var platformFiles = require('./platform_files');
var logging = require('./logging');

var log = logging.setup(__filename);

process.on('message', function(msg) {
  log.debug('Received a request from mommy and daddy: %s', msg);
  var pfFiles = platformFiles.all(msg, function(err, contents) {
    if (err) {
      log.error(err, 'Figuring out platform files');
      process.send({err: err});
    } else {
      log.info('Found platform files');
      process.send({contents: contents});
    }
  })
});
