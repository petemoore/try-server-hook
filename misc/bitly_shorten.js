"use strict";

var Bitly = require('bitly');
var bitly = new Bitly(process.env.BITLY_API_USER, process.env.BITLY_API_KEY);

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
