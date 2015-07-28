// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later



window.addEventListener('message', function(event) {
	if (event.data && event.data.message === 'show_iframe_element') {
		for (var i=0; i<window.frames.length; ++i) {
			if (window.frames[i] == event.source) {
				var f = window.frames[i].frameElement;
				show_element(f);
				f.style.border = '5px solid red';
				return;
			}
		}

	} else if (event.data && event.data.message === 'show_iframe_body') {
		// Make the iframe's body visible
//		window.document.body.style.border = '10px solid yellow';
		window.document.body.style.opacity = 1.0;
		window.document.body.style.pointerEvents = 'all';

		// Send the iframe's parent the show iframe message
		var request = {
			message: 'show_iframe_element'
		};
		// FIXME: For some reason, not all the messages are going to the parent
		window.parent.postMessage(request, '*');
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



