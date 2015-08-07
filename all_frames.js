// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


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

window.addEventListener('message', function(event) {
	// NOTE: For some reason, not all of these messages are received. So
	// We also set up the iframe in check_elements_that_may_be_ads()
	if (event.data && event.data.message === 'show_iframe_element') {
		for (var i=0; i<window.frames.length; ++i) {
			if (window.frames[i] == event.source) {
				var f = window.frames[i].frameElement;
				show_element(f);
				set_border(f, 'red');
				create_button(f, null);
				return;
			}
		}

	} else if (event.data && event.data.message === 'show_iframe_body') {
		// Make the iframe's body visible
		window.document.body.style.opacity = 1.0;
		window.document.body.style.pointerEvents = 'all';

		// Send the iframe's parent the show iframe message
		var request = {
			message: 'show_iframe_element'
		};
		window.parent.postMessage(request, '*');
	// Wait for the iframe to tell us that it has loaded
	} else if (event.data && event.data.message === 'iframe_loaded') {
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

// If running in an iframe
if (window !== window.top) {
	// Tell the parent window that this iframe has loaded
	// NOTE: This does not use the onload event, because it does not always 
	// fire, and can get trampled by other onload events.
	var load_interval = setInterval(function() {
		if (window.document.readyState === 'complete') {
			clearInterval(load_interval);
			load_interval = null;

			// Create a hash of the iframe
			var serializer = new XMLSerializer();
			var hash = serializer.serializeToString(document);
			hash = hex_md5(hash);

			// Send the top window the hash
			var request = {
				message: 'iframe_loaded',
				hash: hash
			};
			window.top.postMessage(request, '*');
		}
	}, 300);
}

check_elements_loop();


