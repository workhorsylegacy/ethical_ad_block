// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


var frame_guid = get_iframe_guid(window);
var parent_guid = get_iframe_guid(window.parent);

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

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'get_g_user_id') {
		g_user_id = msg.data;
	}
});

window.addEventListener('message', function(event) {
/*
	// NOTE: For some reason, not all of these messages are received. So
	// We also set up the iframe in check_elements_that_may_be_ads()
	if (event.data && event.data.message === 'show_iframe_element') {
		for (var i=0; i<window.frames.length; ++i) {
			if (window.frames[i] == event.source) {
				// Show the iframe and add a button
				var f = window.frames[i].frameElement;
//				alert(f.outerHTML);
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
			message: 'show_iframe_element',
			hash: event.data.hash
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
				message: 'show_iframe_body',
				hash: event.data.hash
			};
			event.source.postMessage(request, '*');
		}
*/
	if (event.data && event.data.message === 'show_iframe_element') {
		
	} else if (event.data && event.data.message === 'show_iframe_body') {
		// Make the iframe's body visible
		window.document.body.style.opacity = 1.0;
		window.document.body.style.pointerEvents = 'all';

		// Send the iframe's parent the show iframe message
		var request = {
			message: 'show_iframe_element',
			hash: event.data.hash
		};
		window.parent.postMessage(request, '*');
	} else if (event.data && event.data.message === 'set_document_hash') {
		// Get the hash of the document, and save it inside the parent iframe
		var iframes = document.getElementsByTagName('iframe');
		for (var i=0; i<iframes.length; ++i) {
			if (iframes[i] === event.source.frameElement) {
//				alert('ass');
				console.info('XXXXXXXXXXXXXXX');
				iframes[i].setAttribute('document_hash', event.data.hash);
//				console.log(event.source.frameElement.getAttribute('document_hash'));

				show_element(iframes[i]);
				set_border(iframes[i], 'red');
				create_button(iframes[i], null);

				var request = {
					message: 'show_iframe_body',
					hash: event.data.hash
				};
				event.source.postMessage(request, '*');
				return;
			}
		}
	}
}, false);

// If running in an iframe
if (window !== window.top) {
	// Tell the parent window that this iframe has loaded
	// NOTE: This does not use the onload event, because it does not always 
	// fire, and can get trampled by other onload events.
	var load_interval = setInterval(function() {
		var request = {
			action: 'is_extension_loaded_into_frame',
			id: parent_guid
		};
//		console.info(frame_guid + ', ' + parent_guid);
//		console.info(get_iframe_guid(window) + ', ' + get_iframe_guid(window.parent));

		chrome.runtime.sendMessage(request, function(is_parent_extension_loaded) {
//			console.info(is_parent_extension_loaded);

			if (is_parent_extension_loaded && window.document.readyState === 'complete' && window.parent.document.readyState === 'complete') {
				clearInterval(load_interval);
				load_interval = null;

				// Create a hash of the iframe
				console.info('AAAAAAAAAAA');
				hash_current_document(function(hash) {
					// Save this hash inside the iframe element
					var request = {
						message: 'set_document_hash',
						hash: hash
					};
					window.parent.postMessage(request, '*');
				});
			}
		});
	}, 300);
}

check_elements_loop();


// Tell the background page that this page has loaded the extension code
var request = {
	action: 'extension_loaded_into_frame',
	id: frame_guid
};
chrome.runtime.sendMessage(request, function(response) {
	console.info(frame_guid);
});


