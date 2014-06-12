"use strict";

var EventStream = require('./event_stream');

function NotificationEvents () {}

NotificationEvents.prototype = new EventStream('notification_events',
    ['start_monitoring', 'irc_message']);

module.exports = NotificationEvents;
                
