// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


// If running in an iframe
if (window.location !== window.parent.location) {
	window.addEventListener('load', function() {
//		console.log('!!!!!!!!!!!!!!!!!!!!!! Event iframe load ...');
		// Tell the parent window that this iframe has loaded
		var request = {
			message: 'iframe_loaded'
		};
		console.log(request);
		window.parent.postMessage(request, '*');
	}, false);

	// Add a message event handler
	window.addEventListener('message', function(event) {
//		console.log(event);
		// Hashing the iframe
		if (event.data && event.data.hasOwnProperty('message') && event.data.message == 'hash_iframe') {
			console.log(event);
			var id = event.data.id;

			// Create a hash of the iframe
			var serializer = new XMLSerializer();
			var hash = serializer.serializeToString(document);
			var imgs = document.getElementsByTagName('img');
			var count_down = imgs.length;
//			console.log(count_down);

			// iframe has no images
			if (imgs.length === 0) {
				hash = hex_md5(hash);
//				console.log(hash);
				var response = {
					message: 'hash_iframe_response',
					hash: hash,
					id: id
				};
				console.log(response);
				window.parent.postMessage(response, '*');
			}

			// iframe has images
			for (var i=0; i<imgs.length; ++i) {
				var iframe_img = imgs[i];
//				console.log(iframe_img.src);
				var img = new Image;
				img.crossOrigin = 'Anonymous';
				img.onload = function() {
//					console.log('onload');
					// Create a hash of the image
					var temp_canvas = document.createElement('canvas');
					temp_canvas.width = img.width;
					temp_canvas.height = img.height;
					var ctx = temp_canvas.getContext('2d');
					ctx.drawImage(img, 0, 0);
					var data_url = temp_canvas.toDataURL();
					hash += iframe_img.outerHTML + data_url;
					count_down -= 1;

					// If this is the last image to load,
					// post the hash back to the parent page
					if (count_down < 1) {
						hash = hex_md5(hash);
//						console.log(hash);
						var response = {
							message: 'hash_iframe_response',
							hash: hash,
							id: id
						};
						console.log(response);
						window.parent.postMessage(response, '*');
					}
				};
				img.onerror = function() {
//					console.log('onerror');
					count_down -= 1;

					// If this is the last image to load,
					// post the hash back to the parent page
					if (count_down < 1) {
						hash = hex_md5(hash);
//						console.log(hash);
						var response = {
							message: 'hash_iframe_response',
							hash: hash,
							id: id
						};
						console.log(response);
						window.parent.postMessage(response, '*');
					}
				};
				img.src = iframe_img.src;
			}
		}
	}, false);
}

