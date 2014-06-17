"use strict";

var EventStream = require('./event_stream');

function NotificationEvents () {}

NotificationEvents.prototype = new EventStream('notification_events', ['pr_comment_start', 'start_monitoring', 'irc_start']);
NotificationEvents.prototype.constructor = NotificationEvents;

module.exports = NotificationEvents;
