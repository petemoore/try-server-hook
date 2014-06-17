"use strict";

var debug = require('debug')('try-server-hook:bitly_shorten');
var Bitly = require('bitly');
var config = require('../config');
var bitly = new Bitly(config.get('BITLY_API_USER'), config.get('BITLY_API_KEY'));

function shorten(url, callback) {
  bitly.shorten(url, function(err, response) {
    if (err || response.status_txt !== 'OK') {
      var shorturl = url;
      debug('Failed to shorten %s, failing safely', url);
    } else {
      var shorturl = response.data.url;
      debug('Shortened %s to %s', url, shorturl);
    }
    callback(null, shorturl);  
  });
}

module.exports = {
  shorten: shorten
}
