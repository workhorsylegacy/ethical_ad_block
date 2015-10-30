// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


function setupEvents() {
	// Save the mouse position when it moves
	document.addEventListener('mousemove', function(e) {
		g_cursor_x = e.pageX;
		g_cursor_y = e.pageY;
	}, false);

	// When the mouse exits the page, reset the saved mouse position to 0, 0
	document.addEventListener('mouseout', function(e) {
		g_cursor_x = 0;
		g_cursor_y = 0;
	}, false);

	// Ask the background script to tell us the user id
	var message = {
		action: 'get_g_user_id'
	};
	chrome.runtime.sendMessage(message, function(response) {});

	window.addEventListener('message', function(event) {
		// Just return if there is no data in the event
		if (! event.data) {
			return;
		}

		switch (event.data.action) {
			case 'append_screen_shot':
				var img = new Image();
				img.onload = function(e) {
					var self = e.path[0];
					document.body.appendChild(self);
				};
				img.src = event.data.data_uri;
				break;
			case 'show_iframe_menu':
				var srcs = event.data.srcs;
				var svgs = event.data.svgs;
				showMenu(event.source, srcs, svgs);
				break;
			case 'remove_images_in_iframe':
				var srcs = event.data.srcs;
				var svgs = event.data.svgs;
				removeImages(srcs, svgs);
				break;
		}
	}, false);
}

// The background page tells us the user id
chrome.runtime.onMessage.addListener(function(msg, sender, send_response) {
	switch (msg.action) {
		case 'get_g_user_id':
			g_user_id = msg.data;
			break;
		case 'set_img_hash':
			var hash = msg.hash;
			var src = msg.src;
			var uid = msg.uid;
			if (g_img_hash_cb.hasOwnProperty(src)) {
				var cb = g_img_hash_cb[src];
				delete g_img_hash_cb[src];
				g_hashes[uid] = hash;
				cb(hash);
			}
			break;
		case 'set_video_hash':
			var hash = msg.hash;
			var src = msg.src;
			var uid = msg.uid;
			if (g_video_hash_cb.hasOwnProperty(src)) {
				var cb = g_video_hash_cb[src];
				delete g_video_hash_cb[src];
				g_hashes[uid] = hash;
				cb(hash);
			}
			break;
	}
});


// If running in an iframe
if (window !== window.top) {
	var is_setup = false;
	var is_checking = false;

	// Tell the parent window that this iframe has loaded
	// NOTE: This does not use the onload event, because it does not always 
	// fire, and can get trampled by other onload events.
	var setup_interval = setInterval(function() {
		// Wait for the iframe to be completely loaded, then setup events
		if (! is_setup && window.document.readyState === 'complete') {
			is_setup = true;
			setupEvents();
		}

		// Wait for the iframe head to be created
		if (! is_checking && document.head) {
			is_checking = true;
			// If the iframe is a popup window, turn off the global style sheet that hides things
			if (document.head.hasAttribute('_is_popup_menu')) {
				addStyleRemovePluginStyles();
			// If the iframe is anything else, start checking it for ads
			} else {
				checkElementsLoop();
			}
		}

		// Stop polling if everything is done
		if (is_setup && is_checking) {
			clearInterval(setup_interval);
			setup_interval = null;
		}
	}, 333);
// If running in top window
} else {
	setupEvents();
	checkElementsLoop();
}

addScriptTrackEventListeners();


