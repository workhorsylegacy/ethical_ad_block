// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later



var BUTTON_SIZE = 15;
var g_next_id = 0;
var g_cb_table = {};
var g_element_table = {};
var g_known_elements = {};
var g_cursor_x = 0;
var g_cursor_y = 0;

var TAGS1 = {
	'a' : 'purple',
	'img' : 'blue',
	'video' : 'blue',
	'object' : 'yellow',
	'embed' : 'yellow',
	'iframe' : 'red'
};

var TAGS2 = {
	'a' : 'purple',
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
		case 'a':
			hash = hex_md5(element.outerHTML);
			cb(hash, element);
			break;
		default:
			throw "FIXME: Add hashing of the '" + element.tagName.toLowerCase() + "' element.";
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


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'log') {
		console.log(msg.data);
	}
});

function generate_random_id() {
	// Get a 20 character id
	var code_table = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	var id = [];
	for (var i = 0; i < 20; ++i) {
		// Get a random number between 0 and 35
		var num = Math.floor((Math.random() * 36));

		// Get the character that corresponds to the number
		id.push(code_table[num]);
	}

	return id.join('');
}


document.addEventListener('mousemove', function(e) {
	g_cursor_x = e.pageX;
	g_cursor_y = e.pageY;
}, false);

function create_button(element) {
	// Add a button when the mouse is over the element
	var mouse_enter = function(e) {
		var node = e.path[0];

		// Just return if there is already a canvas
		if (node.canvas !== null && node.canvas !== undefined) {
			return;
		}

		var tag = node.tagName.toLowerCase();
		var color = TAGS1[tag];
		var rect = get_element_rect(node);

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

		// Connect the canvas to the element
		node.canvas = canvas;
		canvas.node = node;

		// Keep checking the mouse position. If it moves out of the element, remove the button
		var rect_interval = setInterval(function() {
			if (g_cursor_x < rect.left || g_cursor_x > rect.left + rect.width ||
				g_cursor_y < rect.top || g_cursor_y > rect.top + rect.height) {
				node.canvas = null;
				document.body.removeChild(canvas);
				clearInterval(rect_interval);
				rect_interval = null;
			}
		}, 100);

		// Remove the element when the button is clicked
		canvas.addEventListener('click', function(e) {
			var canvas = e.path[0];
			var node = canvas.node;

			// Remove the button
			element.removeEventListener('mouseenter', mouse_enter);
			node.canvas = null;
			document.body.removeChild(canvas);
			if (rect_interval) {
				clearInterval(rect_interval);
				rect_interval = null;
			}

			// Remove the border around the element
			node.style['border'] = '';

			// Wait for the next set of DOM events, so the element's border will be removed
			setTimeout(function() {
				// Get a screen shot from the background script
				rect = get_element_rect(node);
				get_screen_shot(rect, function(image, dataURI) {
					document.body.appendChild(image);

					// Hide the element
					node.style.display = 'none';

					// Get a hash of the element
					get_element_hash(node, function(hash, node) {
						console.log(hash);

						// Remove the element
						node.parentElement.removeChild(node);
					});
				});
			}, 100);

		}, false);
	};

	element.addEventListener('mouseenter', mouse_enter, false);
}


function check_elements_that_may_be_ads() {
	for (var tag in TAGS2) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an id, generate a random one
			if (element.id === '' || element.id === undefined) {
				element.id = generate_random_id();
			}

			// Only look at elements that have not already been examined
			if (! g_known_elements.hasOwnProperty(element.id)) {

				// Element image has a source
				switch (element.tagName.toLowerCase()) {
					case 'img':
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
								});
							}

							create_button(element);
						}
						break;
					case 'a':
						// Anchor has a background image
						var bg = window.getComputedStyle(element)['background-image'];
						if (bg && bg !== 'none' && bg.length > 0) {
							g_known_elements[element.id] = 1;
							console.log(element);

							// FIXME: This does not hash the image
							get_element_hash(element, function(hash, n) {
								// Set the opacity to 1.0
								n.style.opacity = 1.0;
								n.style.border = '5px solid purple';
							});
						// Anchor does not have a background image
						} else {
							g_known_elements[element.id] = 1;

							// Set the opacity to 1.0
							element.style.opacity = 1.0;
						}

						create_button(element);
						break;
					default:
						console.log("FIXME: Add support for the '" + element.tagName.toLowerCase() + "' element.");
				}
			}
		}
	}
}


// Keep looking at page elements, and add buttons to ones that loaded
var check_elements_loop = function() {
//	console.log('called check_elements_loop ...');

	check_elements_that_may_be_ads();

	setTimeout(check_elements_loop, 500);
};
check_elements_loop();

