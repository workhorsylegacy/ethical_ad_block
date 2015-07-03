// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


var BLACKLIST = [
	'connect.facebook.net',
	'platform.twitter.com',
	'apis.google.com',
	'plus.google.com',
	'google-analytics.com',

	'tribalfusion.com',
	'kontera.com',
	'admarketplace.net',
	'exponential.com'
];

var messages = [];
var is_ready = false;

function log_to_active_tab(message) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		console.log(message);
		chrome.tabs.sendMessage(tabs[0].id, {action: message}, function(response) {});
	});
}

// Watch each request and block the ones that are in the black list
chrome.webRequest.onBeforeRequest.addListener(function(info) {
	for (var i=0; i<BLACKLIST.length; ++i) {
		var entry = BLACKLIST[i];
		if (info.url.indexOf(entry) !== -1) {
			var message = 'Blocked: ' + info.url;
			if (is_ready) {
				log_to_active_tab(message);
			} else {
				messages.push(message);
			}

			return {cancel: true};
		}
	}

	return {cancel: false};
},{ urls: ["*://*/*"] }, ['blocking']);


// When the tab is ready, print all the log messages to its console
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status == 'complete') {
		is_ready = true;
		for (var i=0; i<messages.length; ++i) {
			var message = messages[i];
			log_to_active_tab(message);
		}

		messages = [];
	} else {
		is_ready = false;
	}
});



