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
	if (event.data && event.data.message === 'from_iframe_document_to_top_window') {
		var request = {
			message: 'from_top_window_to_iframe_document',
			hash: event.data.hash
		};
		event.source.postMessage(request, '*');
	} else if (event.data && event.data.message === 'from_top_window_to_iframe_document') {
		// FIXME: Here we need to check if this is an ad
		var request = {
			message: 'from_iframe_document_to_iframe_element',
			hash: event.data.hash
		};
		// FIXME: This will often fail in iframes with no src, because they don't get content scripts loaded
		window.parent.postMessage(request, '*');
	} else if (event.data && event.data.message === 'from_iframe_document_to_iframe_element') {
		// Get the hash of the document, and save it inside the parent iframe
		var iframes = document.getElementsByTagName('iframe');
		for (var i=0; i<iframes.length; ++i) {
			if (iframes[i] === event.source.frameElement) {
//				console.info('XXXXXXXXXXXXXXX');
				iframes[i].setAttribute('document_hash', event.data.hash);

				show_element(iframes[i]);
				set_border(iframes[i], 'red');
				create_button(iframes[i], null);
				break;
			}
		}

		var request = {
			message: 'from_iframe_element_to_iframe_document',
			hash: event.data.hash
		};
		event.source.postMessage(request, '*');
	// Make the iframe's document visible
	} else if (event.data && event.data.message === 'from_iframe_element_to_iframe_document') {

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

			if (is_parent_extension_loaded && window.document.readyState === 'complete') {
				clearInterval(load_interval);
				load_interval = null;

				// Create a hash of the iframe
//				console.info('AAAAAAAAAAA');
				get_element_hash(true, document, null, function(hash, node) {
					// Save this hash inside the iframe element
					var request = {
						message: 'from_iframe_document_to_top_window',
						hash: hash
					};
					window.top.postMessage(request, '*');
				});
			}
		});
	}, 300);
}

check_elements_loop();

// FIXME: This is just for debugging
// Tell the background page that this page has loaded the extension code
var request = {
	action: 'extension_loaded_into_frame',
	id: frame_guid
};
chrome.runtime.sendMessage(request, function(response) {
//	console.info(frame_guid);
});


