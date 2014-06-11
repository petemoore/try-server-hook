"use strict";

var when = require('when');
var gaiaTry = require('./gaia_try');

var NotificationEvents = require('./notification_events');

function CommitToNotificationFilter(notificationEvents) {
  this.notificationEvents = notificationEvents;
}

CommitToNotificationFilter.prototype = {
  parse: function (obj) {
    var tryCommit = {};
    tryCommit = obj;
    
  },
  validate: function(obj) {
    ['type', 'hg_id', 'who', 'msg'].forEach(function(element){
      if (!obj[element]) {
        return false;
      }
    });
    return true;
  },
  interesting: function(obj) {
    if (obj) {
      return true
    } else {
      console.log('Huh, why is obj falsy?');
      return false
    }
  },
  handle: function(obj, callback) {
    if (!this.interesting(obj)){
      console.log('This message is not interesting');
      return callback(null);
    }
    try {
      var commitInfo = this.parse(obj);
    } catch(e) {
      return callback(e);
    }

    gaiaTry.commit(obj, function (err, hgId) {
      obj['hg_id'] = hgId;
      this.notificationEvents.insertJson(obj).then(
        function () {
          return callback(null);
        },
        function (err) {
          return callback(err);
        }
        )
    }.bind(this));
      
  },
  makeAction: function() {
    return function (obj, cb) {
      this.handle(obj, cb);
    }.bind(this);
  }

}

module.exports = CommitToNotificationFilter;
