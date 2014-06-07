"use strict";

var Pineapple = require('./pineapple');

function NotificationEvents () {}

NotificationEvents.prototype = new Pineapple('notification_events',
    ['start_monitoring', 'irc_message']);

module.exports = NotificationEvents;
                
