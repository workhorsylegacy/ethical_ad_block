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

	// Get the user id from the background page
	chrome.runtime.onMessage.addListener(function(msg, sender, send_response) {
		if (msg.action === 'get_g_user_id') {
			g_user_id = msg.data;
		}
	});

	window.addEventListener('message', function(event) {
		// Just return if there is no data in the event
		if (! event.data) {
			return;
		}

		switch (event.data.message) {
			case 'append_screen_shot':
				var img = new Image();
				img.onload = function(e) {
					var self = e.path[0];
					document.body.appendChild(self);
				};
				img.src = event.data.data_url;
				break;
		}
	}, false);
}



// If running in an iframe
if (window !== window.top) {
	// Tell the parent window that this iframe has loaded
	// NOTE: This does not use the onload event, because it does not always 
	// fire, and can get trampled by other onload events.
	setInterval(function() {
		if (window.document.readyState === 'complete' && ! document.body.hasAttribute('_is_loaded')) {
			document.body.setAttribute('_is_loaded', 'true');

			setupEvents();
		}
	}, 333);
} else {
	setupEvents();
}

applyMonkeyPatch();
checkElementsLoop();


