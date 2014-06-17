"use strict";

var Bitly = require('bitly');
var config = require('../config');
var bitly = new Bitly(config.get('BITLY_API_USER'), config.get('BITLY_API_KEY'));

function shorten(url, callback) {
  bitly.shorten(url, function(err, response) {
    if (err || response.status_txt !== 'OK') {
      var shorturl = url;
    } else {
      var shorturl = response.data.url;
      console.log('shortened: ' + url + ' --> ' + shorturl);
    }
    callback(null, shorturl);  
  });
}

module.exports = {
  shorten: shorten
}
