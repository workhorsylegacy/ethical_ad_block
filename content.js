// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


window.addEventListener('message', function(event) {
	// Wait for the iframe to tell us that it has loaded
	if (event.data && event.data.message === 'iframe_loaded') {
		// FIXME: Remove the iframe if the hash is in the black list
		if (event.data.hash) {
			try {
				var element = event.source.frameElement;
				create_button(element, null);
			} catch (SecurityError) {
				// pass
			}
		}

		// Send the iframe window back the show iframe message
		if (event.source) {
			var request = {
				message: 'show_iframe_body'
			};
			event.source.postMessage(request, '*');
		}
	}
}, false);


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'log') {
		console.log(msg.data);
	}
});


document.addEventListener('mousemove', function(e) {
	g_cursor_x = e.pageX;
	g_cursor_y = e.pageY;
//	console.log(g_cursor_x + ', ' + g_cursor_y);
}, false);




// Keep looking at page elements, and add buttons to ones that loaded
var check_elements_loop = function() {
//	console.log('called check_elements_loop ...');

	check_elements_that_may_be_ads();

	setTimeout(check_elements_loop, 500);
};
check_elements_loop();

