// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


// If running in an iframe
if (window.location !== window.parent.location) {
	// Add a message event handler
	window.addEventListener('message', function(event) {
		// Hashing the iframe
		if (event.data === 'close_iframe') {
			var serializer = new XMLSerializer();
			var content = serializer.serializeToString(document);
			var hash = hex_md5(content);
			// Post the hash back to the parent page
			window.parent.postMessage(hash, '*');
		}
	});
}

