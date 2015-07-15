// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


// FIXME: Add support for blocking links with css background-image styles
var canvases = [];
var BUTTON_SIZE = 15;
var g_has_loaded = false;
var g_next_id = 0;
var g_cb_table = {};
var g_element_table = {};
var g_known_elements = {};

var TAGS1 = {
	'img' : 'blue',
	'video' : 'blue',
	'object' : 'yellow',
	'embed' : 'yellow',
	'iframe' : 'red'
};

var TAGS2 = {
	'img' : 'blue',
	'video' : 'blue',
	'object' : 'yellow',
	'embed' : 'yellow'
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
			// Copy the image to a cross origin safe one
			// then hash it
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
				cb(hash, element);
			};
			img.onerror = function() {
				// Create a hash of the image
				hash = hex_md5(element.outerHTML);
				cb(hash, element);
			};
			img.src = element.src;
			break;
		case 'iframe':
			var id = g_next_id++;
			g_cb_table[id] = cb;
			g_element_table[id] = element;
			var request = {message: 'hash_iframe', id: id};
			element.contentWindow.postMessage(request, '*');
			break;
		case 'embed':
		case 'object':
		case 'video':
			hash = hex_md5(element.outerHTML);
			cb(hash, element);
			break;
		default:
			throw "FIXME: Add hashing of the '" + element.tagName.toLowerCase() + "' element.";
	}
}


// Adds a close button to the bottom right of the element
function create_button(element) {
	var tag = element.tagName.toLowerCase();
	var color = TAGS1[tag];
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

	// Give the element a border when the mouse hovers over the button
	var mouse_enter = function() {
		element.style['border'] = '10px solid ' + color;
		console.log(element);
	};

	// Remove the border when the mouse stops hovering over the button
	var mouse_leave = function() {
		element.style['border'] = '';
	};

	// Remove the element when the button is clicked
	canvas.addEventListener('click', function() {
		// Remove the button
		canvas.removeEventListener('mouseenter', mouse_enter);
		canvas.removeEventListener('mouseleave', mouse_leave);
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

				// Hide the element
				element.style.display = 'none';

				// Get a hash of the element
				get_element_hash(element, function(hash, node) {
					console.log(hash);

					// Remove the element
					node.parentElement.removeChild(node);
				});
			});
		}, 100);

	}, false);

	// Setup mouse events
	canvas.addEventListener('mouseenter', mouse_enter, false);
	canvas.addEventListener('mouseleave', mouse_leave, false);
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
	for (var tag in TAGS1) {
		var elements = parent_element.getElementsByTagName(tag);
		for (var j=0; j<elements.length; ++j) {
			var element = elements[j];
			create_button(element);
		}
	}
}


window.addEventListener('message', function(event) {
	if (!event.data || !event.data.hasOwnProperty('message')) {
		return;
	}

	// Wait for the iframe to tell us that it has loaded
	if (event.data.message === 'iframe_loaded') {
		// Get the iframe
		var iframes = document.getElementsByTagName('iframe');
		var i = event.data.iframe_index;
		var iframe_window = window.frames[i];
		var node = null;
		for (var j=0; j<iframes.length; ++j) {
			if (iframes[j].contentWindow == iframe_window) {
				node = iframes[j];
				break;
			}
		}

		// Get a hash of the element
		get_element_hash(node, function(hash, node) {
			// Set the opacity to 1.0
			node.style.opacity = 1.0;
			node.style.border = '5px solid purple';

			// Add a new button
			create_button(node);
		});
	// Wait for the hash to be sent back from the iframes
	} else if (event.data.message === 'hash_iframe_response') {
		var hash = event.data.hash;
		var id = event.data.id;
		var cb = g_cb_table[id];
		var element = g_element_table[id];
		cb(hash, element);
		delete g_cb_table[id];
		delete g_element_table[id];
	}
}, false);


// When the page is done loading, add a button to all the tags we care about
window.addEventListener('load', function() {
	g_has_loaded = true;
}, false);

// When the page resizes, add a button to all the tags we care about
window.addEventListener('resize', function(event) {
	if (! g_has_loaded)
		return;

	// Remove old buttons
	remove_all_buttons();

	// Add a new button to each element we care about
	add_buttons_to_all_tags(document);
}, false);


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'log') {
		console.log(msg.data);
	}
});

// Keep looking at page elements, and ad buttons to ones that loaded
var show_all_tags_we_care_about = function() {
	console.log('called show_all_tags_we_care_about ...');

	for (var tag in TAGS2) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// Skip elements that do not have ids
			// FIXME: Add a randomly generated id, if there is none
			if (element.id === undefined)
				continue;

			// Only look at elements that have not already been examined
			if (! g_known_elements.hasOwnProperty(element.id)) {

				// Element image has a source
				// FIXME: Update this to work on non images
				if (element.src && element.src.length > 0) {
					g_known_elements[element.id] = 1;
					console.log(element);

					// Element's image has not loaded yet
					if (element.clientWidth === 0) {
						var load_cb = function(evt) {
							var node = evt.path[0];
							node.removeEventListener('load', load_cb);

							get_element_hash(node, function(hash, n) {
								// Set the opacity to 1.0
								n.style.opacity = 1.0;
								n.style.border = '5px solid purple';

								// Add a new button
								create_button(n);
							});
						};

						element.addEventListener('load', load_cb, false);
					// Element's image has already loaded
					} else {
						var node = element;

						get_element_hash(node, function(hash, n) {
							// Set the opacity to 1.0
							n.style.opacity = 1.0;
							n.style.border = '5px solid purple';

							// Add a new button
							create_button(n);
						});
					}
				}
			}
		}
	}

	setTimeout(show_all_tags_we_care_about, 500);
};
show_all_tags_we_care_about();

