// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later

// FIXME: Add support for blocking links with css background-image styles
var canvases = [];
var BUTTON_SIZE = 15;
var has_loaded = false;
var TAGS = {
	'img' : 'blue',
	'video' : 'blue',
	'object' : 'yellow',
	'embed' : 'yellow',
	'iframe' : 'red'
};

function get_element_rect(element) {
	var rect = element.getBoundingClientRect();
	rect = {
		bottom: rect.bottom,
		height: rect.height,
		left: rect.left,
		right: rect.right,
		top: rect.top,
		width: rect.width
	};
	return rect;
}

function get_screen_shot(rect, cb) {
	var message = {
		action: 'screen_shot',
		rect: rect
	};

	// Get a screen shot from the background script
	var screen_shot = function(msg, sender, sendResponse) {
		if (msg.action === 'screen_shot') {
			// Remove the handler for this callback
			chrome.runtime.onMessage.removeListener(screen_shot);

			var dataURI = msg.data;
			var canvas = document.createElement('canvas');
			canvas.width = rect.width;
			canvas.height = rect.height;
			var ctx = canvas.getContext('2d');

			var image = new Image();
			image.width = rect.width;
			image.height = rect.height;
			image.onload = function() {
				ctx.drawImage(
					image,
                    rect.left, rect.top,
                    rect.width, rect.height,
                    0, 0,
                    rect.width, rect.height
				);
				image.onload = null;
				image.src = canvas.toDataURL();
				cb(image, dataURI);
			};
			image.src = dataURI;
		}
	};
	chrome.runtime.onMessage.addListener(screen_shot);
	chrome.runtime.sendMessage(message, function(response) {});
}

function get_element_hash(element, cb) {
	// Create a hash of the image and its src
	var hash = null;
	switch (element.tagName.toLowerCase()) {
		case 'img':
			// Hide the image
			element.style.display = 'none';

			// Copy the image to a cross origin safe one
			// then hash and hide it
			var img = new Image;
			img.crossOrigin = 'Anonymous';
			img.onload = function() {
				// Create a hash of the image
				var temp_canvas = document.createElement('canvas');
				temp_canvas.width = img.width;
				temp_canvas.height = img.height;
				var ctx = temp_canvas.getContext('2d');
				ctx.drawImage(img, 0, 0);
				var data_url = temp_canvas.toDataURL();
				hash = hex_md5(element.outerHTML + data_url);
				cb(hash);

				// Remove the image
				element.parentElement.removeChild(element);
			};
			img.src = element.src;
			break;
		case 'iframe':
			// Hide the iframe
			element.style.display = 'none';

			// Wait for the hash to be sent back from the iframe
			var get_iframe_hash = function(event) {
				var hash = event.data;
				cb(hash);

				// Remove the iframe
				element.parentElement.removeChild(element);

				window.removeEventListener('message', get_iframe_hash);
			};
			window.addEventListener('message', get_iframe_hash);
			element.contentWindow.postMessage('close_iframe', '*');
			break;
		default:
			throw "FIXME: Add hashing of the '" + element.tagName.toLowerCase() + "' element.";
	}
}

// Adds a close button to the bottom right of the element
function create_button(element, color) {
	var rect = get_element_rect(element);

	// Create a button over the bottom right of the element
	var canvas = document.createElement('canvas');
	canvas.width = BUTTON_SIZE;
	canvas.height = BUTTON_SIZE;
	canvas.style.width = BUTTON_SIZE + 'px';
	canvas.style.height = BUTTON_SIZE + 'px';
	canvas.style.position = 'absolute';
	canvas.style.left = rect.left + window.pageXOffset + (rect.width - BUTTON_SIZE) + 'px';
	canvas.style.top = rect.top + window.pageYOffset + (rect.height - BUTTON_SIZE) + 'px';
	canvas.style.zIndex = 100000;
	document.body.appendChild(canvas);

	// Make the button a color
	var context = canvas.getContext('2d');
	context.rect(0, 0, BUTTON_SIZE, BUTTON_SIZE);
	context.fillStyle = color;
	context.fill();
	canvases.push(canvas);

	// Remove the element when the button is clicked
	canvas.addEventListener('click', function() {
		// Remove the button
		document.body.removeChild(canvas);
		var i = canvases.indexOf(canvas);
		if (i != -1) {
			canvases.splice(i, 1);
		}

		// Remove the border around the element
		element.style['border'] = '';

		// Wait for the next set of DOM events, so the element's border will be removed
		setTimeout(function() {
			// Get a screen shot from the background script
			rect = get_element_rect(element);
			get_screen_shot(rect, function(image, dataURI) {
				document.body.appendChild(image);

				// Get a hash of the image
				get_element_hash(element, function(hash) {
					console.log(dataURI);
					console.log(hash);
				});
			});
		}, 100);

	}, false);

	// Give the element a border when the mouse hovers over the button
	canvas.addEventListener('mouseenter', function() {
		element.style['border'] = '10px solid ' + color;
		console.log(element);
	}, false);

	// Remove the border when the mouse stops hovering over the button
	canvas.addEventListener('mouseleave', function() {
		element.style['border'] = '';
	}, false);
}

function remove_all_buttons() {
	for (var i=0; i<canvases.length; ++i) {
		var canvas = canvases[i];
		document.body.removeChild(canvas);
	}
	canvases = [];
}

function add_buttons_to_all_tags(parent_element) {
	// Add a new button to the right bottom corner of each element
	for (var tag in TAGS) {
		var color = TAGS[tag];
		var elements = parent_element.getElementsByTagName(tag);
		for (var j=0; j<elements.length; ++j) {
			var element = elements[j];
			create_button(element, color);
		}
	}
}

// When the page is done loading, add a button to all the tags we care about
window.addEventListener('load', function() {
	has_loaded = true;

	// Remove old buttons
	remove_all_buttons();

	// Add a new button to each element we care about
	add_buttons_to_all_tags(document);

	// When new tags we care about are created, add a button to them too
	var observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			for (var i=0; i<mutation.addedNodes.length; ++i) {
				var node = mutation.addedNodes[i];

				// Skip if not a function
				if (typeof node.getElementsByTagName !== 'function') {
					return;
				}
	 
				// Add a new button to each element we care about
				add_buttons_to_all_tags(node);
			}
		});
	});
	 
	observer.observe(document, {childList: true, subtree: true});
});

// When the page resizes, add a button to all the tags we care about
window.addEventListener('resize', function(event) {
	if (! has_loaded)
		return;

	// Remove old buttons
	remove_all_buttons();

	// Add a new button to each element we care about
	add_buttons_to_all_tags(document);
});


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'log') {
		console.log(msg.data);
	}
});
	




