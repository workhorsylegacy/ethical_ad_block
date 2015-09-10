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
/*
	window.addEventListener('message', function(event) {
		// Just return if there is no data in the event
		if (! event.data) {
			return;
		}

		switch (event.data.message) {
			case 'from_iframe_document_to_top_window':
//				console.info('CCCCCCCCC');
				var request = {
					message: 'from_top_window_to_iframe_document',
					hash: event.data.hash
				};
				event.source.postMessage(request, '*');
				break;
			case 'from_top_window_to_iframe_document':
//				console.info('DDDDDDDDD');
//				window.document.body.style.padding = '10px';
//				window.document.body.style.margin = '10px';
//				window.document.body.style.backgroundColor = 'orange';

				// FIXME: Here we need to check if this is an ad
				var request = {
					message: 'from_iframe_document_to_iframe_element',
					hash: event.data.hash
				};
				window.parent.postMessage(request, '*');
				break;
			case 'from_iframe_document_to_iframe_element':
//				console.info('EEEEEEEEEE');
				// Get the hash of the document, and save it inside the parent iframe
				var iframes = document.getElementsByTagName('iframe');
				for (var i=0; i<iframes.length; ++i) {
					var frame = iframes[i];
					if (frame === event.source.frameElement) {
//						window.document.body.style.padding = '10px';
//						window.document.body.style.margin = '10px';
//						window.document.body.style.backgroundColor = 'pink';

//						console.info('XXXXXXXXXXXXXXX');
						frame.setAttribute('document_hash', event.data.hash);
//						delete g_known_elements[frame.id];

//						showElement(frame);
//						setBorder(frame, 'red');
//						createButton(frame, null);
						break;
					}
				}

				var request = {
					message: 'from_iframe_element_to_iframe_document',
					hash: event.data.hash
				};
				event.source.postMessage(request, '*');
				break;
			// Make the iframe's document visible
			case 'from_iframe_element_to_iframe_document':
//				window.document.body.style.padding = '10px';
//				window.document.body.style.margin = '10px';
//				window.document.body.style.backgroundColor = 'purple';
				break;
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
*/
}



// If running in an iframe
if (window !== window.top) {
	// Tell the parent window that this iframe has loaded
	// NOTE: This does not use the onload event, because it does not always 
	// fire, and can get trampled by other onload events.
	setInterval(function() {
		if (window.document.readyState === 'complete' && ! document.body.hasAttribute('_is_loaded')) {
			document.body.setAttribute('_is_loaded', 'true');
//			console.info('document loaded ...');
			setupEvents();
/*
			window.document.body.style.padding = '10px';
			window.document.body.style.margin = '10px';
			window.document.body.style.backgroundColor = 'yellow';
*/
/*
			// Create a hash of the iframe
//			console.info('AAAAAAAAAAA');
			getElementHash(true, document, null, function(hash, node, parent_node) {
//				console.info('BBBBBBBBBBB');
				// Send the hash to the top window, so it can check if this an ad
				var request = {
					message: 'from_iframe_document_to_top_window',
					hash: hash
				};
				window.top.postMessage(request, '*');
			});
*/
		}
	}, 333);
} else {
	setupEvents();
}

checkElementsLoop();


