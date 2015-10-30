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
var g_response_cache = {};
var g_hash_cache = {};


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
/*
chrome.webRequest.onCompleted.addListener(function(details) {
	console.info(details);
}, { urls: ['<all_urls>'] }, ['responseHeaders']);
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
		case 'get_img_hash':
			var src = msg.src;
			if (g_hash_cache.hasOwnProperty(src)) {
				msg.hash = g_hash_cache[src];
				chrome.tabs.sendMessage(sender.tab.id, msg, {frameId: sender.frameId}, null);
			} else {
				httpGetBlobAsDataURI(src, function(original_src, data_uri) {
					msg.hash = hexMD5(data_uri);
					g_hash_cache[src] = msg.hash;
					chrome.tabs.sendMessage(sender.tab.id, msg, {frameId: sender.frameId}, null);
				});
			}
			return false;
			break;
		case 'get_video_hash':
			var src = msg.src;
			if (g_hash_cache.hasOwnProperty(src)) {
				msg.hash = g_hash_cache[src];
				chrome.tabs.sendMessage(sender.tab.id, msg, {frameId: sender.frameId}, null);
			} else {
				// Get only the first 50KB and length of the video
				httpGetBlobChunk(src, function(src, data, total_size) {
					blobToDataURI(data, function(data_uri) {
						msg.hash = data_uri && total_size ? hexMD5(total_size + ':' + data_uri) : null;
						g_hash_cache[src] = msg.hash;
//						console.info(msg.hash + ', ' + src);
						chrome.tabs.sendMessage(sender.tab.id, msg, {frameId: sender.frameId}, null);
					});
				}, 50000);
			}
			return false;
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
					chrome.tabs.sendMessage(sender.tab.id, message, {frameId: sender.frameId}, null);
				}
			);
			return false;
			break;
		case 'get_g_user_id':
			var message = {
				action: 'get_g_user_id',
				data: g_user_id
			};
			chrome.tabs.sendMessage(sender.tab.id, message, {frameId: sender.frameId}, null);
			return false;
			break;
	}
});




