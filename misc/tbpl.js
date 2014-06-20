"use strict";

var config = require('../config');
var url = require('url');


function makeUrl(opts) {
  var urlBits = {
    protocol: 'https:',
    query: opts,
    slashes:true
  };

  console.log(JSON.stringify(opts));
  if (!opts || !opts.tree) {
    opts.tree = config.get('TBPL_TREE');
  }
  var tbplHostname = config.get('TBPL_HOST') || 'tbpl.mozilla.org';

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
