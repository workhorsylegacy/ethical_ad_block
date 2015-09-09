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
	'exponential.com',
	'cpmstar.com'
];
// NOTE: Ignore the black list for now
BLACKLIST = [];


var active_url = null;
var g_user_id = null;

g_user_id = generateRandomId();

// FIXME: When the headers are changed, it breaks some other headers
chrome.webRequest.onHeadersReceived.addListener(function(details) {
	// New headers
	var new_headers = [
		{name: 'Access-Control-Allow-Origin', value: '*'},
		{name: 'Access-Control-Allow-Headers', value: '*'},
		{name: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS, DELETE, PUT'}
	];

	// Add the new headers
	for (var i=0; i<new_headers.length; ++i) {
		var new_header = new_headers[i];
		var has_header = false;
		// Update an existing header
		for (var j=0; j<details.responseHeaders.length; ++j) {
			var header = details.responseHeaders[j];
			if (header.name.toLowerCase() === new_header.name.toLowerCase()) {
				header.value = new_header.value;
				has_header = true;
			}
		}
		// Or add new header
		if (! has_header) {
			details.responseHeaders.push(new_header);
		}
	}

	// Remove any X-Frame-Options headers
	for (var i=0; i<details.responseHeaders.length; ++i) {
		var header = details.responseHeaders[i];
		if (header.name.toLowerCase() === 'x-frame-options') {
			details.responseHeaders.splice(i, 1);
		}
	}

/*
	// Print all the headers
	console.log(details.method + ', ' + details.url);
	for (var i=0; i<details.responseHeaders.length; ++i) {
		var responseHeader = details.responseHeaders[i];
		if (responseHeader.name.toLowerCase() === 'x-frame-options') {
			console.log('    ' + responseHeader.name + ' : ' + responseHeader.value);
		}
	}
*/
	return {responseHeaders: details.responseHeaders};
}, { urls: ['<all_urls>'] }, ['blocking', 'responseHeaders']);


// Watch each request and block the ones that are in the black list
chrome.webRequest.onBeforeRequest.addListener(function(info) {
	if (active_url !== null) {
		for (var i=0; i<BLACKLIST.length; ++i) {
			var entry = BLACKLIST[i];
			// Block the request if it is to a black listed site,
			// But not if the current page is the black listed site
			if (info.url.indexOf(entry) !== -1 && active_url.indexOf(entry) === -1) {
				var message = 'Blocked: ' + info.url + ', ' + active_url;
				console.log(message);

				return {cancel: true};
			}
		}
	}

	return {cancel: false};
}, { urls: ['<all_urls>'] }, ['blocking']);


chrome.runtime.onMessage.addListener(function(msg, sender, send_response) {
	if (msg.action === 'screen_shot') {
		var rect = msg.rect;

		// Screen capture the tab and send it to the tab's console
		chrome.tabs.captureVisibleTab(
			null,
			{},
			function(data_url) {
				var message = {
					action: 'screen_shot',
					data: data_url
				};
				chrome.tabs.sendMessage(sender.tab.id, message, function(response) {});
			}
		);
		return false; // FIXME: Update this to use send_response instead of sending another message
	}
});


// When the tab is ready
chrome.tabs.onUpdated.addListener(function(tab_id, change_info, tab) {
	active_url = tab.url;

	if (change_info.status === 'complete') {
		// Send the user id to each new tab
		var message = {
			action: 'get_g_user_id',
			data: g_user_id
		};
		chrome.tabs.sendMessage(tab_id, message, function(response) {});
	}
});



