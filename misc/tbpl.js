"use strict";

var url = require('url');

var tbplHostname = 'tbpl.mozilla.org'

function makeUrl(opts) {
  var urlBits = {
    protocol: 'https:',
    query: opts,
    slashes:true
  };

  if (tbplHostname.charAt(tbplHostname.length - 1) === '/') {
    urlBits.host = tbplHostname;
  } else {
    urlBits.host = tbplHostname + '/';
  }

  return url.format(urlBits);
}

module.exports = {
  url: makeUrl
}
