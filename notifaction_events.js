"use strict";

var Pineapple = require('./Pineapple');

function NotificationEvents() {}

NotificationEvents.prototype = new Pineapple('notification_events', ['start_irc', 'start_gh_status', 'start_pr_comment']);

module.exports = NotificationEvents;


