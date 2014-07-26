'use strict';

var Bitly = require('bitly');
var config = require('../config');
var bitly = new Bitly(config.get('BITLY_API_USER'), config.get('BITLY_API_KEY'));
var logging = require('../misc/logging');

var log = logging.setup(__filename);

function shorten(url, callback) {
  bitly.shorten(url, function(err, response) {
    if (err || response.status_txt !== 'OK') {
      var shorturl = url;
      log.error(err, 'Failed to shorten %s, failing safely', url);
    } else {
      var shorturl = response.data.url;
      log.debug('Shortened %s to %s', url, shorturl);
    }
    callback(null, shorturl);  
  });
}

module.exports = {
  shorten: shorten
}
