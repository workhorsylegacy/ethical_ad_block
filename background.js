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

chrome.webRequest.onBeforeRequest.addListener(function(info) {
	for (var i=0; i<BLACKLIST.length; ++i) {
		var entry = BLACKLIST[i];
		if (info.url.indexOf(entry) !== -1) {
			var message = 'Blocked: ' + info.url;
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				chrome.tabs.sendMessage(tabs[0].id, {action: message}, function(response) {});  
			});

			return {cancel: true};
		}
	}

	return {cancel: false};
	//return { redirectUrl: 'http://www.cnn.com' };
},{ urls: ["*://*/*"] }, ['blocking']);


