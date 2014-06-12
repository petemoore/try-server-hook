"use strict";

var EventStream = require('./event_stream');

function NotificationEvents () {}

NotificationEvents.prototype = new EventStream('notification_events', ['start_monitoring', 'irc_start']);
NotificationEvents.prototype.constructor = NotificationEvents;

module.exports = NotificationEvents;
                
