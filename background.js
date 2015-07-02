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

function log_to_content_script(message) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		console.log(message);
		chrome.tabs.sendMessage(tabs[0].id, {action: message}, function(response) {});
	});
}

chrome.webRequest.onBeforeRequest.addListener(function(info) {
	for (var i=0; i<BLACKLIST.length; ++i) {
		var entry = BLACKLIST[i];
		if (info.url.indexOf(entry) !== -1) {
			var message = 'Blocked: ' + info.url;
			if (is_ready) {
				log_to_content_script(message);
			} else {
				messages.push('Late ' + message);
			}

			return {cancel: true};
		}
	}

	return {cancel: false};
	//return { redirectUrl: 'http://www.cnn.com' };
},{ urls: ["*://*/*"] }, ['blocking']);


chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status == 'complete') {
		is_ready = true;
		for (var i=0; i<messages.length; ++i) {
			var message = messages[i];
			log_to_content_script(message);
		}

		messages = [];
	} else {
		is_ready = false;
	}
});

