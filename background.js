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


//var active_url = null;
var g_user_id = generateRandomId();
var g_response_cache = [];


/*
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
*/

// FIXME: Update this to use send_response instead of sending another message, instead of return false
chrome.runtime.onMessage.addListener(function(msg, sender, send_response) {
	switch (msg.action) {
		case 'get_voted_ad_type':
			var ad_id = msg.ad_id;
			var voted_ad_type = null;
			if (g_response_cache.hasOwnProperty(ad_id)) {
				voted_ad_type = g_response_cache[ad_id];
			}

			var message = {
				action: 'get_voted_ad_type',
				voted_ad_type: voted_ad_type
			};
			send_response(message);
			break;
		// FIXME: Update this to limit the size of the cache
		// FIXME: Update this to expire items in the cache after 5 minutes or so
		case 'set_voted_ad_type':
			var ad_id = msg.ad_id;
			var voted_ad_type = msg.voted_ad_type;
			g_response_cache[ad_id] = voted_ad_type;
			return false;
			break;
		case 'remove_voted_ad_type':
			var ad_id = msg.ad_id;
			delete g_response_cache[ad_id];
			var message = {
				action: 'remove_voted_ad_type'
			};
			send_response(message);
			break;
		case 'screen_shot':
			var rect = msg.rect;

			// Screen capture the tab and send it to the tab's console
			chrome.tabs.captureVisibleTab(
				null,
				{'format': 'png'},
				function(data_uri) {
					var message = {
						action: 'screen_shot',
						data: data_uri
					};
					chrome.tabs.sendMessage(sender.tab.id, message, function(response) {});
				}
			);
			return false;
			break;
		case 'get_g_user_id':
			var message = {
				action: 'get_g_user_id',
				data: g_user_id
			};
			chrome.tabs.sendMessage(sender.tab.id, message, function(response) {});
			return false;
			break;
	}
});




