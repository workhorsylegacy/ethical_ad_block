// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


/*
TODO:
. When an element is the only one in an iframe, or the largest, make closing it close the iframe instead.
. When we show elements, we just force the opacity and pointerEvents to 1.0 and 'all'. 
	This will break items that did not have them on 1.0 and 'all' to begin with.
. News story titles on Google news do not show
. Getting element screen shots breaks inside iframes
. Getting screen shots gets the wrong area in Windows 8.1 tablet
. Move popup menu to top window when inside iframe
. Popup menu can get stuck off partially off screen
. Ad info posted to the server should include URL, and extension id
. We need a way to count active users.
. Make it work on Firefox
. Make it work on touch screens
*/

var DEBUG = true;
var BUTTON_SIZE = 15;
var BORDER_SIZE = DEBUG ? 5 : 1;
var g_known_elements = {};
var g_cursor_x = 0;
var g_cursor_y = 0;
var g_user_id = null;

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

var TAGS3 = {
	'img' : 'blue',
	'video' : 'blue'
};

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

function show_element(element) {
	element.style.position = '';
	element.style.top = '';
	element.style.left = '';
	element.style.opacity = 1.0;
	element.style.pointerEvents = 'all';
}

function set_border(element, color) {
	if (! element.border_color) {
		element.border_color = color;
	}

	if (DEBUG) {
		element.style.border = BORDER_SIZE + 'px solid ' + color;
	}
}

function get_element_rect(element) {
	var rect = element.getBoundingClientRect();
	rect = {
		bottom: rect.bottom,
		top: rect.top,
		left: rect.left,
		right: rect.right,
		height: rect.height,
		width: rect.width,
		x: rect.x,
		y: rect.y
	};
	return rect;
}

function get_element_rect_with_children(element) {
	// Update the rect to overlap all the child rects
	var rect = get_element_rect(element);
	var children = [element];
	while (children.length > 0) {
		var child = children.pop();
		var c_rect = get_element_rect(child);

		if (c_rect.width === 0 || c_rect.height === 0) {
			continue;
		}

		if (c_rect.bottom > rect.bottom) rect.bottom = c_rect.bottom;
		if (c_rect.top < rect.top) rect.top = c_rect.top;
		if (c_rect.left < rect.left) rect.left = c_rect.left;
		if (c_rect.right > rect.right) rect.right = c_rect.right;
		if (c_rect.x < rect.x) rect.x = c_rect.x;
		if (c_rect.y < rect.y) rect.y = c_rect.y;
		rect.height = rect.bottom - rect.top;
		rect.width = rect.right - rect.left;

		children = children.concat(to_array(child.children));
	}
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
			img.src = element.src || element.srcset;
			break;
		case 'iframe':
			throw "Can't hash iframe";
			break;
		// FIXME: video, object, and embed can NOT be properly hashed yet
		case 'embed':
		case 'object':
		case 'video':
		case 'a':
			hash = hex_md5(element.outerHTML);
			cb(hash, element);
			break;
		default:
			throw "Unexpected element '" + element.tagName.toLowerCase() + "' to hash.";
	}
}

function create_button(element, container_element) {
	// Just return if this element already has a button
	if (element.canvas) {
		return;
	}

	if (! element.prev_border) {
		element.prev_border = element.style.border;
	}

	// Add a button when the mouse is over the element
	var mouse_enter = function(e) {
		var node = e.path[0];

		// Just return if there is already a canvas
		if (node.canvas !== null && node.canvas !== undefined) {
			return;
		}

		var tag = node.tagName.toLowerCase();
		var color = TAGS1[(container_element ? container_element.tagName : node.tagName).toLowerCase()];
//		if (! DEBUG) {
			color = 'purple';
//		}
		node.style.border = BORDER_SIZE + 'px dashed ' + node.border_color;
		var rect = get_element_rect(node);

		// Create a button over the bottom right of the element
		var canvas = document.createElement('canvas');
		canvas.width = BUTTON_SIZE;
		canvas.height = BUTTON_SIZE;
		canvas.style.width = BUTTON_SIZE + 'px';
		canvas.style.height = BUTTON_SIZE + 'px';
		canvas.style.position = 'absolute';
		canvas.style.left = rect.left + window.pageXOffset + 'px';
		canvas.style.top = rect.top + window.pageYOffset + 'px';
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
		canvas.container_element = container_element;

		// Keep checking the mouse position. If it moves out of the element, remove the button
		var rect_interval = setInterval(function() {
			var r = get_element_rect(node);
			var l = r.left + window.pageXOffset;
			var t = r.top + window.pageYOffset;
			l = l < 0.0 ? 0.0 : l;
			t = t < 0.0 ? 0.0 : t;
			if (g_cursor_x <= l ||
				g_cursor_x >= l + r.width ||
				g_cursor_y <= t ||
				g_cursor_y >= t + r.height) {
				node.style.border = node.prev_border;
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
			var container_element = canvas.container_element;

			// Hide the button
			canvas.style.display = 'none';

			// If there is a container element, use that instead
			if (container_element) {
				node = container_element;
			}

			// Button menu
			var rect = get_element_rect_with_children(node);
			var menu = document.createElement('div');
			menu.className = 'nostyle';
			menu.style.padding = '10px';
			menu.style.position = 'absolute';
			menu.style.textAlign = 'center';
			menu.style.minWidth = '200px';
			menu.style.minHeight = '230px';
			menu.style.width = rect.width + 'px';
			menu.style.height = rect.height + 'px';
			menu.style.left = rect.left + window.pageXOffset + 'px';
			menu.style.top = rect.top + window.pageYOffset + 'px';
			menu.style.zIndex = 100000;
			menu.style.backgroundColor = '#f0f0f0';
			menu.style.border = '1px solid black';
			menu.style.boxShadow = '10px 10px 5px grey';
			document.body.appendChild(menu);

			// Keep moving the button menu to cover the element
			var div_interval = setInterval(function() {
				var rect = get_element_rect_with_children(node);
				menu.style.width = rect.width + 'px';
				menu.style.height = rect.height + 'px';
				menu.style.left = rect.left + window.pageXOffset + 'px';
				menu.style.top = rect.top + window.pageYOffset + 'px';
			}, 100);

			// Title
			var span = document.createElement('span');
			span.innerHTML = 'This Element is ...';
			menu.appendChild(span);
			menu.appendChild(document.createElement('br'));

			function button_click(e) {
				var element = e.path[0];

				// Stop checking button and button menu positions
				if (element.rect_interval) {
					clearInterval(element.rect_interval);
					element.rect_interval = null;
				}
				if (element.div_interval) {
					clearInterval(element.div_interval);
					element.div_interval = null;
				}

				// Remove the border and buttons
				node.style.border = node.prev_border;
				menu.parentElement.removeChild(menu);

				// Wait for the next set of DOM events, so the element's border will be removed
				setTimeout(function() {
					// Get a screen shot from the background script
					rect = get_element_rect_with_children(node);
					get_screen_shot(rect, function(image, dataURI) {
						if (DEBUG) {
							document.body.appendChild(image);
						}

						// Hide the element
						node.style.display = 'none';

						// Get a hash of the element
						get_element_hash(node, function(hash, node) {
							console.log(hash);

							// Remove the element
							node.parentElement.removeChild(node);

							// Tell the server that this hash is for an ad
							var httpRequest = new XMLHttpRequest();
							httpRequest.onreadystatechange = function() {
								if (httpRequest.readyState === 4) {
									console.log(httpRequest.status);
									console.log(httpRequest.responseText);
								}
							};
							var request = 'http://localhost:9000' +
								'?user_id=' + g_user_id +
								'&vote_ad=' + hash +
								'&ad_type=' + element.ad_type;
							httpRequest.open('GET', request, true);
							httpRequest.send(null);
						});
					});
				}, 333);
			}

			// Good button
			var button_good = document.createElement('button');
			button_good.innerHTML = 'Good';
			button_good.className = 'btnGreen';
			button_good.ad_type = 'good';
			button_good.div_interval = div_interval;
			button_good.rect_interval = rect_interval;
			menu.appendChild(button_good);
			menu.appendChild(document.createElement('br'));
			button_good.addEventListener('click', button_click);

			// Fraudulent button
			var button_fraud = document.createElement('button');
			button_fraud.innerHTML = 'Fraudulent';
			button_fraud.className = 'btnYellow';
			button_fraud.ad_type = 'fraudulent';
			button_fraud.div_interval = div_interval;
			button_fraud.rect_interval = rect_interval;
			menu.appendChild(button_fraud);
			menu.appendChild(document.createElement('br'));
			button_fraud.addEventListener('click', button_click);

			// Resource taxing button
			var button_resource = document.createElement('button');
			button_resource.innerHTML = 'Resource taxing';
			button_resource.className = 'btnYellow';
			button_resource.ad_type = 'taxing';
			button_resource.div_interval = div_interval;
			button_resource.rect_interval = rect_interval;
			menu.appendChild(button_resource);
			menu.appendChild(document.createElement('br'));
			button_resource.addEventListener('click', button_click);

			// Malicious button
			var button_malicious = document.createElement('button');
			button_malicious.innerHTML = 'Malicious';
			button_malicious.className = 'btnRed';
			button_malicious.ad_type = 'malicious';
			button_malicious.div_interval = div_interval;
			button_malicious.rect_interval = rect_interval;
			menu.appendChild(button_malicious);
			menu.appendChild(document.createElement('br'));
			button_malicious.addEventListener('click', button_click);

			// Cancel button
			var button_cancel = document.createElement('button');
			button_cancel.innerHTML = 'or Cancel';
			button_cancel.div_interval = div_interval;
			button_cancel.rect_interval = rect_interval;
			menu.appendChild(button_cancel);
			button_cancel.addEventListener('click', function(e) {
				var element = e.path[0];

				// Stop checking button and button menu positions
				if (element.rect_interval) {
					clearInterval(element.rect_interval);
					element.rect_interval = null;
				}
				if (element.div_interval) {
					clearInterval(element.div_interval);
					element.div_interval = null;
				}

				menu.parentElement.removeChild(menu);
				canvas.style.display = '';
			});

		}, false);
	};

	element.addEventListener('mouseenter', mouse_enter, false);
}

function is_inside_link_element(element) {
	var parent = element.parentElement;
	while (parent) {
		if (parent.tagName.toLowerCase() === 'a') {
			return true;
		}
		parent = parent.parentElement;
	}
	return false;
}

function is_too_small(element) {
	var rect = get_element_rect(element);
	return (rect.width < 20 || rect.height < 20);
}

function to_array(obj) {
	var retval = [];
	for (var i=0; i<obj.length; ++i) {
		retval.push(obj[i]);
	}
	return retval;
}

function is_ad(hash) {
	return false;
}

function check_elements_that_may_be_ads() {
	for (var tag in TAGS1) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an id, generate a random one
			if (element.id === '' || element.id === undefined) {
				element.id = generate_random_id();
			}

			// Only look at elements that have not already been examined
			if (! g_known_elements.hasOwnProperty(element.id)) {
				var name = element.tagName.toLowerCase();

				// Skip the element if it is inside a link
				if (TAGS3.hasOwnProperty(name)) {
					if (is_inside_link_element(element)) {
						g_known_elements[element.id] = 1;
						show_element(element);
						continue;
					}
				}

				// Element image has a source
				switch (name) {
					// NOTE: For some reason, this is not triggered for all iframes. So
					// we also do it when the message 'show_iframe_element' is posted to the
					// iframe itself.
					case 'iframe':
						show_element(element);
						set_border(element, 'red');
						create_button(element, null);
						break;
					case 'img':
						if (element.src && element.src.length > 0 || element.srcset && element.srcset.length > 0) {
							g_known_elements[element.id] = 1;
							console.log(element);

							// Element's image has not loaded yet
							if (element.clientWidth === 0) {
								var load_cb = function(evt) {
									var node = evt.path[0];
									node.removeEventListener('load', load_cb);

									get_element_hash(node, function(hash, n) {
										if (is_ad(hash)) {
											document.body.removeChild(n);
										} else {
											show_element(n);
											if (! is_too_small(n)) {
												set_border(n, 'blue');
												create_button(n, null);
											} else {
//												set_border(n, 'green');
											}
										}
									});
								};

								element.addEventListener('load', load_cb, false);
							// Element's image has already loaded
							} else {
								var node = element;

								get_element_hash(node, function(hash, n) {
									if (is_ad(hash)) {
										document.body.removeChild(n);
									} else {
										show_element(n);
										if (! is_too_small(n)) {
											set_border(n, 'blue');
											create_button(n, null);
										} else {
//											set_border(n, 'green');
										}
									}
								});
							}
						}
						break;
					case 'a':
						g_known_elements[element.id] = 1;

						// Anchor has a background image
						var bg = window.getComputedStyle(element)['background-image'];
						if (bg && bg !== 'none' && bg.length > 0) {
							console.log(element);

							// FIXME: This does not hash the image
							get_element_hash(element, function(hash, n) {
								if (is_ad(hash)) {
									document.body.removeChild(n);
								} else {
									show_element(n);
									if (! is_too_small(n)) {
										set_border(n, 'purple');
										create_button(n, null);
									} else {
										set_border(n, 'green');
									}
								}
							});
						// Anchor has children
						} else if (element.children.length > 0) {
							console.log(element);

							get_element_hash(element, function(hash, n) {
								if (is_ad(hash)) {
									document.body.removeChild(n);
								} else {
									// Add a button to the link
									show_element(n);
									if (! is_too_small(n)) {
										set_border(n, 'purple');
										create_button(n, null);
									}

									// Add buttons to any children that are big enough
									var cs = to_array(n.children);
									while (cs.length > 0) {
										var c = cs.pop();
										cs = cs.concat(to_array(c.children));
										// If the child is a tag we care about, or it has a background image
										var bg = window.getComputedStyle(c)['background-image'];
										if (c.tagName.toLowerCase() in TAGS2 || bg && bg !== 'none' && bg.length > 0) {
											show_element(c);
											if (! is_too_small(c)) {
												set_border(c, 'purple');
												create_button(c, n);
											}
										}
									}
								}
							});
						// Anchor is just text
						} else {
							show_element(element);
						}
						break;
					case 'object':
					case 'embed':
						g_known_elements[element.id] = 1;
						console.log(element);

						get_element_hash(element, function(hash, n) {
							if (is_ad(hash)) {
								document.body.removeChild(n);
							} else {
								show_element(n);
								set_border(n, 'yellow');
								create_button(n, null);
							}
						});
						break;
					case 'video':
						g_known_elements[element.id] = 1;
						console.log(element);

						get_element_hash(element, function(hash, n) {
							if (is_ad(n)) {
								document.body.removeChild(n);
							} else {
								show_element(n);
								if (! is_too_small(n)) {
									set_border(n, 'blue');
									create_button(n, null);
								} else {
									set_border(n, 'green');
								}
							}
						});
						break;
					default:
						throw "Unexpected element '" + element.tagName.toLowerCase() + "' to check for ads.";
				}
			}
		}
	}
}

// Keep looking at page elements, and add buttons to ones that loaded
function check_elements_loop() {
//	console.log('called check_elements_loop ...');

	check_elements_that_may_be_ads();

	setTimeout(check_elements_loop, 500);
}

