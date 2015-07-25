// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later



window.addEventListener('message', function(event) {
	if (event.data && event.data.message === 'show_iframe_parent') {
		for (var i=0; i<window.frames.length; ++i) {
			if (window.frames[i] === event.source) {
				var frame = window.frames[i].frameElement;
				frame.style.opacity = 1.0;
				frame.style.pointerEvents = 'all';
				frame.style.border = '5px solid red';
				return;
			}
		}
	} else if (event.data && event.data.message === 'show_iframe_body') {
		// Make the iframe's body visible
		window.document.body.style.opacity = 1.0;
		window.document.body.style.pointerEvents = 'all';

		// Send the iframe's parent the show iframe message
		var request = {
			message: 'show_iframe_parent'
		};
		window.parent.postMessage(request, '*');
	}
}, false);


// Tell the parent window that this iframe has loaded
window.addEventListener('load', function() {
	// If running in an iframe
	if (window !== window.top) {
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
}, false);
