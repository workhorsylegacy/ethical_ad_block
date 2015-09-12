// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


/*
TODO:
. fix issue with variable hoisting
. use promises

. Videos from http://youtube.com load very slowly, or error out from header changes
. Check why ads on http://stackoverflow.com have different hashes, for the same ad after a reload
. News story titles on http://news.google.com do not show

. Some videos have a transparent div on top of them with an onclick event. This makes it hard to click the video.
	Fix this by making it detect elements with onclick events.
. Hashing animated images won't work
. When an element is the only one in an iframe/link, or the largest, make closing it close the iframe/link instead
. Move popup menu to center of top frame
. Make hashing work with svg
. Save the randomly generated user id in localStorage
. Save and load server data from file

. Update so things can be marked as "social". Then users can block all socal media buttons and crap.
. Add a moderator mode that shows all ads, including counts below them, and lets users vote on them
. Show users a warning if another Ad Blocker is running
. Ad element screen shot to ad voting
. Getting screen shots gets the wrong area in Windows 8.1 tablet
. Make it work on Firefox
. Make it work on touch screens
*/

var DEBUG = true;
var BUTTON_SIZE = 15;
var BORDER_SIZE = DEBUG ? 5 : 1;
// FIXME: Change these to use bools as keys instead of ints
var g_known_elements = {};
var g_patched_elements = {};
var g_cursor_x = 0;
var g_cursor_y = 0;
var g_user_id = null;

var TAGS1 = {
	'a' : 'purple',
	'img' : 'blue',
	'video' : 'blue',
	'object' : 'yellow',
	'embed' : 'yellow',
	'iframe' : 'red',
	'div' : 'orange'
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

function hexMD5(value) {
	if (value) {
		return hex_md5(value);
	} else {
		return null;
	}
}

function ajaxGet(request, success_cb, fail_cb) {
	var http_request = new XMLHttpRequest();
	http_request.onreadystatechange = function() {
		if (http_request.readyState === 4) {
			if (http_request.status === 200) {
				success_cb(http_request.responseText);
			} else {
				fail_cb(http_request.status);
			}
		} else if (http_request.readyState === 0) {
			fail_cb(0);
		}
	};
	http_request.onerror = function() {
		fail_cb(0);
	};
	http_request.timeout = 3000;
	http_request.open('GET', request, true);
	http_request.send(null);
}

function showElement(element) {
	// Just return if the element is null
	if (! element) {
		return;
	}

	// position
	if (! DEBUG) {
		if (element.hasAttribute('_real_position')) {
			element.style.position = element.getAttribute('_real_position');
			element.removeAttribute('_real_position');
		} else {
			element.style.position = 'static';
		}
	}

	// opacity
	if (element.hasAttribute('_real_opacity')) {
		element.style.opacity = element.getAttribute('_real_opacity');
		element.removeAttribute('_real_opacity');
	} else {
		element.style.opacity = 1.0;
	}

	// pointerEvents
	if (element.hasAttribute('_real_pointer_events')) {
		element.style.pointerEvents = element.getAttribute('_real_pointer_events');
		element.removeAttribute('_real_pointer_events');
	} else {
		element.style.pointerEvents = 'all';
	}
}

function hideElement(element) {
	// Save the style attributes that are temporarily overridden by the extension
	if (! g_patched_elements.hasOwnProperty(element.id)) {
		g_patched_elements[element.id] = 1;

		// position
		if (! DEBUG) {
			if (element.style.position) {
				element.setAttribute('_real_position', element.style.position);
			}
			element.style.position = 'fixed';
		}

		// opacity
		if (element.style.opacity) {
			element.setAttribute('_real_opacity', element.style.opacity);
		}
		element.style.opacity = DEBUG ? 0.2 : 0.0;

		// pointerEvents
		if (element.style.pointerEvents) {
			element.setAttribute('_real_pointer_events', element.style.pointerEvents);
		}
		element.style.pointerEvents = 'none';
	}
}

function setBorder(element, color) {
	if (! element.border_color) {
		element.border_color = color;
	}

	if (DEBUG) {
		element.style.border = BORDER_SIZE + 'px solid ' + color;
	}
}

function getElementRect(element) {
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

function getElementRectWithChildren(element) {
	// Update the rect to overlap all the child rects
	var rect = getElementRect(element);
	var children = [element];
	while (children.length > 0) {
		var child = children.pop();
		var c_rect = getElementRect(child);

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

		children = children.concat(toArray(child.children));
	}
	return rect;
}

function imageToDataUrl(element, src, cb) {
	var img = new Image();
	img.crossOrigin = 'Anonymous';
	img.onload = function(e) {
		var temp_canvas = document.createElement('canvas');
		temp_canvas.width = img.width;
		temp_canvas.height = img.height;
		var ctx = temp_canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);
		var data_url = temp_canvas.toDataURL('image/png', 1.0);
		cb(data_url);
	};
	img.onerror = function(e) {
		console.error('Failed to copy image: ' + img.src);
		cb(null);
	};

	if (! src) {
		console.error("Can't copy img with no source: " + element.outerHTML);
		cb(null);
	} else {
		img.src = src;
	}
}

function getScreenShot(rect, cb) {
	var message = {
		action: 'screen_shot',
		rect: rect
	};

	// Get a screen shot from the background script
	var screen_shot = function(msg, sender, send_response) {
		if (msg.action === 'screen_shot') {
			// Remove the handler for this callback
			chrome.runtime.onMessage.removeListener(screen_shot);

			// Copy the full page screen shot into an image
			var image = new Image();
			image.onload = function() {
				// Create a blank canvas to copy the screen shot segment to
				var canvas = document.createElement('canvas');
				canvas.width = rect.width;
				canvas.height = rect.height;

				// Copy a segment of the full screen shot to the canvas
				var ctx = canvas.getContext('2d');
				ctx.drawImage(
					image,
                    rect.left, rect.top,
                    rect.width, rect.height,
                    0, 0,
                    rect.width, rect.height
				);

				// Copy the screen shot segment to a new image
				var segment_image = new Image();
				var segment_data_uri = canvas.toDataURL('image/png', 1.0);
				segment_image.src = segment_data_uri;
				cb(segment_image, segment_data_uri);
			};
			var data_uri = msg.data;
			image.src = data_uri;
		}
	};
	chrome.runtime.onMessage.addListener(screen_shot);
	chrome.runtime.sendMessage(message, function(response) {});
}

function getElementSrcOrSrcSetOrImgSrc(element) {
	var sources = [
		element.src,
		element.getAttribute('srcset'),
		element.getAttribute('imgsrc')
	];

	for (var i=0; i<sources.length; ++i) {
		var source = sources[i];
		if (source && source.length > 0) {
			return source;
		}
	}

	return null;
}

function getVideoSrc(element) {
	// Video has src attribute
	if (element.src && element.src.length > 0) {
		return element.src;
	// Video has source children
	} else {
		var sources = element.getElementsByTagName('source');
		if (sources) {
			for (var i=0; i<sources.length; ++i) {
				var source = sources[0];
				if (source && source.src && source.src.length > 0) {
					return source.src;
				}
			}
		}
	}

	return null;
}

// Return true if value is a valid CSS image path, such as "url(blah.png)"
function isValidCSSImagePath(value) {
	value = value.toLowerCase();
	return value && value.length > 0 && value.indexOf('url(') === 0 && value[value.length-1] === ')';
}

function getElementHash(is_printed, element, parent_element, cb) {
	function printInfo(element, data) {
		console.info(element);
		console.info('hash ' + element.tagName.toLowerCase() + ': ' + data);
	}
/*
	// If the element is a document, create a hash of its children
	if (element.nodeType === 9) {
		// Hash the first found meaningful element
		var tags = ['img', 'video', 'embed', 'object', 'iframe', 'a'];
		for (var i=0; i<tags.length; ++i) {
			var tag = tags[i];
			var elements = element.getElementsByTagName(tag);
			if (elements.length > 0) {
				getElementHash(is_printed, elements[0], parent_element, function(hash, element, parent_element) {
					cb(hash, element, parent_element);
				});
				return;
			}
		}

		// If there are none, hash the document instead
//		console.error('Failed to hash document');
		var serializer = new XMLSerializer();
		var hash = serializer.serializeToString(element);
		hash = hexMD5(hash);
		cb(hash, element, parent_element);
		return;
	}
*/
	// Or the element is another type
	switch (element.tagName.toLowerCase()) {
		case 'img':
			// If the src has not loaded, wait for it to load
			if (! element.complete) {
				var load_cb = function(e) {
					element.removeEventListener('load', load_cb);

					var src = getElementSrcOrSrcSetOrImgSrc(element);
					imageToDataUrl(element, src, function(data_url) {
						if (is_printed) {printInfo(element, data_url);}
						var hash = hexMD5(data_url);
						cb(hash, element, parent_element);
					});
				};

				element.addEventListener('load', load_cb, false);
			// The src is already loaded
			} else {
				var src = getElementSrcOrSrcSetOrImgSrc(element);
				imageToDataUrl(element, src, function(data_url) {
					if (is_printed) {printInfo(element, data_url);}
					var hash = hexMD5(data_url);
					cb(hash, element, parent_element);
				});
			}
			break;
		case 'iframe':
			var hash = element.getAttribute('document_hash');
			if (is_printed) {printInfo(element, hash);}
			cb(hash, element, parent_element);
			break;
		case 'embed':
		case 'object':
			if (is_printed) {printInfo(element, element.data);}
			var hash = null;
			if (element.data) {
				hash = hexMD5(element.data);
			}
			cb(hash, element, parent_element);
			break;
		case 'video':
			// The src is already loaded
			if (element.readyState === 4) {
				var src = getVideoSrc(element);
				if (is_printed && src) {printInfo(element, src);}
				var hash = src ? hexMD5(src) : null;
				cb(hash, element, parent_element);
			// If the src has not loaded, wait for it to load
			} else {
				var load_cb = setInterval(function() {
					if (element.readyState === 4) {
						clearInterval(load_cb);

						var src = getVideoSrc(element);
						if (is_printed && src) {printInfo(element, src);}
						var hash = src ? hexMD5(src) : null;
						cb(hash, element, parent_element);
					}
				}, 333);
			}
			break;
		// FIXME: Update to hash divs that have click events
		case 'div':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);
				imageToDataUrl(element, src, function(data_url) {
					if (is_printed) {printInfo(element, data_url);}
					var hash = hexMD5(data_url);
					cb(hash, element, parent_element);
				});
			} else {
				cb(hash, element, parent_element);
			}

			break;
		case 'a':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);
				imageToDataUrl(element, src, function(data_url) {
					if (is_printed) {printInfo(element, data_url);}
					var hash = hexMD5(data_url);
					cb(hash, element, parent_element);
				});
			} else if (element.children.length > 0) {
				getElementChildHash(is_printed, element, element, cb);
//				if (is_printed) {printInfo(element, element.href);}
//				hash = hexMD5(element.href);
//				cb(hash, element, parent_element);
			} else if (element.href && element.href.length > 0) {
				if (is_printed) {printInfo(element, element.href);}
				hash = hexMD5(element.href);
				cb(hash, element, parent_element);
			} else {
				cb(hash, element, parent_element);
			}

			break;
		default:
			throw "Unexpected element '" + element.tagName.toLowerCase() + "' to hash.";
	}
}

function getElementChildHash(is_printed, element, parent_element, cb) {
	var elements = toArray(element.children);

	while (elements.length > 0) {
		var child = elements.pop();
		switch (child.tagName.toLowerCase()) {
			case 'img':
			case 'iframe':
			case 'embed':
			case 'object':
			case 'video':
			case 'a':
				getElementHash(is_printed, child, parent_element, cb);
				return;
		}
		if (child.children) {
			for (var i=0; i<child.children.length; ++i) {
				elements.push(child.children[i]);
			}
		}
	}

	cb(null, element, parent_element);
}

function createButton(element, container_element) {
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
		var rect = getElementRect(node);

		// Create a button over the top left of the element
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
		var ctx = canvas.getContext('2d');
		ctx.rect(0, 0, BUTTON_SIZE, BUTTON_SIZE);
		ctx.fillStyle = color;
		ctx.fill();

		// Connect the canvas to the element
		node.canvas = canvas;
		canvas.node = node;
		canvas.container_element = container_element;

		// Keep checking the mouse position. If it moves out of the element, remove the button
		var rect_interval = setInterval(function() {
			var r = getElementRect(node);
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
			var rect = getElementRectWithChildren(node);
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
				var rect = getElementRectWithChildren(node);
				menu.style.width = rect.width + 'px';
				menu.style.height = rect.height + 'px';
				menu.style.left = rect.left + window.pageXOffset + 'px';
				menu.style.top = rect.top + window.pageYOffset + 'px';
			}, 100);

			function buttonClick(e) {
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
					rect = getElementRectWithChildren(node);
					getScreenShot(rect, function(image, data_uri) {
						// Send the image to the top window
						if (DEBUG) {
							var src = getElementSrcOrSrcSetOrImgSrc(image);
							imageToDataUrl(image, src, function(data_url) {
								var request = {
									message: 'append_screen_shot',
									data_url: data_url
								};
								window.top.postMessage(request, '*');
							});
						}

						// Hide the element
						node.style.display = 'none';

						// Get a hash of the element
						getElementHash(true, node, null, function(hash, node, parent_node) {
							console.log(hash);

							// Remove the element
							node.parentElement.removeChild(node);

							if (hash) {
								// Tell the server that this hash is for an ad
								var request = 'http://localhost:9000' +
									'?user_id=' + g_user_id +
									'&vote_ad=' + hash +
									'&ad_type=' + element.ad_type;
								var success_cb = function(response_text) {
									console.log(response_text);
								};
								var fail_cb = function(status) {
									console.log('Failed to connect to server.');
								};
								ajaxGet(request, success_cb, fail_cb);
							}
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
			button_good.addEventListener('click', buttonClick);

			// Fraudulent button
			var button_fraud = document.createElement('button');
			button_fraud.innerHTML = 'Fraudulent';
			button_fraud.className = 'btnYellow';
			button_fraud.ad_type = 'fraudulent';
			button_fraud.div_interval = div_interval;
			button_fraud.rect_interval = rect_interval;
			menu.appendChild(button_fraud);
			menu.appendChild(document.createElement('br'));
			button_fraud.addEventListener('click', buttonClick);

			// Resource taxing button
			var button_resource = document.createElement('button');
			button_resource.innerHTML = 'Resource taxing';
			button_resource.className = 'btnYellow';
			button_resource.ad_type = 'taxing';
			button_resource.div_interval = div_interval;
			button_resource.rect_interval = rect_interval;
			menu.appendChild(button_resource);
			menu.appendChild(document.createElement('br'));
			button_resource.addEventListener('click', buttonClick);

			// Malicious button
			var button_malicious = document.createElement('button');
			button_malicious.innerHTML = 'Malicious';
			button_malicious.className = 'btnRed';
			button_malicious.ad_type = 'malicious';
			button_malicious.div_interval = div_interval;
			button_malicious.rect_interval = rect_interval;
			menu.appendChild(button_malicious);
			menu.appendChild(document.createElement('br'));
			button_malicious.addEventListener('click', buttonClick);

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

function isInsideLinkElement(element) {
	var parent = element.parentElement;
	while (parent) {
		if (parent.tagName.toLowerCase() === 'a') {
			return true;
		}
		parent = parent.parentElement;
	}
	return false;
}

function isTooSmall(element) {
	var rect = getElementRect(element);
	return (rect.width < 20 || rect.height < 20);
}

function toArray(obj) {
	var retval = [];
	for (var i=0; i<obj.length; ++i) {
		retval.push(obj[i]);
	}
	return retval;
}

function isAd(hash, cb) {
	// If the hash is null, just use false
	if (hash === null || hash === undefined) {
		cb(false);
		return;
	}

	// Check the web server to see if this hash is for an ad
	var request = 'http://localhost:9000?is_ad=' + hash;
	var success_cb = function(response_text) {
		var is_ad = (response_text.toLowerCase() === 'true');
		cb(is_ad);
	};
	var fail_cb = function(status) {
		cb(false);
	};
	ajaxGet(request, success_cb, fail_cb);
}

function removeElementIfAd(element, color, cb_after_not_ad) {
	getElementHash(false, element, null, function(hash, node, parent_node) {
		isAd(hash, function(is_ad) {
			if (is_ad) {
				node.parentElement.removeChild(node);
			} else {
				showElement(parent_node);
				showElement(node);
				if (! isTooSmall(node)) {
					setBorder(node, color);
					createButton(node, null);
				} else {
//					setBorder(node, 'green');
				}

				if (cb_after_not_ad) {
					cb_after_not_ad(node);
				}
			}
		});
	});
}

function checkElementsThatMayBeAds() {
	for (var tag in TAGS1) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an id, generate a random one
			if (element.id === '' || element.id === null || element.id === undefined) {
				element.id = generateRandomId();
			}

			hideElement(element);

			// Only look at elements that have not already been examined
			if (! g_known_elements.hasOwnProperty(element.id)) {
				var name = element.tagName.toLowerCase();

				// Skip the element if it is inside a link
				if (TAGS3.hasOwnProperty(name)) {
					if (isInsideLinkElement(element)) {
						g_known_elements[element.id] = 1;
						showElement(element);
						continue;
					}
				}

				// Element image has a source
				switch (name) {
					case 'iframe':
						g_known_elements[element.id] = 1;
						showElement(element);
						setBorder(element, 'red');
						break;
					case 'img':
						if (getElementSrcOrSrcSetOrImgSrc(element)) {
							g_known_elements[element.id] = 1;
//							console.log(element);

							removeElementIfAd(element, 'blue');
						}
						break;
					case 'div':
						g_known_elements[element.id] = 1;
//						console.info(element.getEventListeners());

						// Element has a background image
						var bg = window.getComputedStyle(element)['background-image'];
						if (isValidCSSImagePath(bg)) {
							removeElementIfAd(element, 'orange');
						// Element has an onclick event
						} else if (element.getAttribute('onclick')) {
//							console.info(element.getAttribute('onclick'));
							removeElementIfAd(element, 'orange');
						// Element has an addEventListener('click') event
						} else if (element.getAttribute('_has_event_listener_click')) {
//							console.info(element.getAttribute('_has_event_listener_click'));
							removeElementIfAd(element, 'orange');
						} else {
							showElement(element);
						}
						break;
					case 'a':
						g_known_elements[element.id] = 1;

						// Anchor has a background image
						var bg = window.getComputedStyle(element)['background-image'];
						if (isValidCSSImagePath(bg)) {
//							console.log(element);

							removeElementIfAd(element, 'purple');
						// Anchor has children
						} else if (element.children.length > 0) {
//							console.log(element);

							removeElementIfAd(element, 'purple', function(node) {
								// Add buttons to any children that are big enough
								var children = toArray(node.children);
								while (children.length > 0) {
									var child = children.pop();
									children = children.concat(toArray(child.children));
									// If the child is a tag we care about, or it has a background image
									var bg = window.getComputedStyle(child)['background-image'];
									if (child.tagName.toLowerCase() in TAGS2 || isValidCSSImagePath(bg)) {
										showElement(child);
										if (! isTooSmall(child)) {
											setBorder(child, 'purple');
											createButton(child, node);
										}
									}
								}
							});
						// Anchor is just text
						} else {
							showElement(element);
						}
						break;
					case 'object':
					case 'embed':
						g_known_elements[element.id] = 1;
//						console.log(element);

						removeElementIfAd(element, 'yellow');
						break;
					case 'video':
						g_known_elements[element.id] = 1;
//						console.log(element);

						removeElementIfAd(element, 'blue');
						break;
					default:
						throw "Unexpected element '" + element.tagName.toLowerCase() + "' to check for ads.";
				}
			}
		}
	}
}

// Keep looking at page elements, and add buttons to ones that loaded
function checkElementsLoop() {
//	console.log('called checkElementsLoop ...');

	checkElementsThatMayBeAds();

	setTimeout(checkElementsLoop, 500);
}

// Monkey patch the addEventListener and removeEventListener methods to
// keep a list of events for lookup via the getEventListeners method.
function monkeyPatch() {
	// Don't patch the methods if already patched
	if (Element.prototype._has_monkey_patched_event_listeners) {
		return;
	}
	Element.prototype._has_monkey_patched_event_listeners = true;

	// addEventListener
	Element.prototype._addEventListener = Element.prototype.addEventListener;
	Element.prototype.addEventListener = function(a, b, c) {
		// Init everything
		c = c || false;
		this._event_listeners = this._event_listeners || {};
		this._event_listeners[a] = this._event_listeners[a] || [];

		// Add the event
		// FIXME: Remove the previous listner is at already is in the list
		this._event_listeners[a].push({listener: b, useCapture: c});
		this.setAttribute('_has_event_listener_' + a.toLowerCase(), 'true');

		// Call the real method
		this._addEventListener(a, b, c);
	};

	// removeEventListener
	Element.prototype._removeEventListener = Element.prototype.removeEventListener;
	Element.prototype.removeEventListener = function(a, b, c) {
		// Init everything
		c = c || false;
		this._event_listeners = this._event_listeners || {};
		this._event_listeners[a] = this._event_listeners[a] || [];

		// Remove the event
		for (var i=0; i<this._event_listeners[a].length; ++i) {
			if (this._event_listeners[a][i] === {listener: b, useCapture: c}) {
				this._event_listeners[a].splice(i, 1);
				break;
			}
		}
		if (this._event_listeners[a].length === 0) {
			delete this._event_listeners[a];
			this.removeAttribute('_has_event_listener_' + a.toLowerCase());
		}

		// Call the real method
		this._removeEventListener(a, b, c);
	};

	// getEventListeners
	Element.prototype.getEventListeners = function(a) {
		// Init everything
		this._event_listeners = this._event_listeners || {};

		// Return only the events for this type
		if (a) {
			return this._event_listeners[a];
		// Return all events
		} else {
			return this._event_listeners;
		}
	};

	// clearEventListeners
	Element.prototype.clearEventListeners = function(a) {
		// Init everything
		this._event_listeners = this._event_listeners || {};

		// Remove only the events for this type
		if (a) {
			var type_events = this.getEventListeners(a);
			if (type_events) {
				for (var i=type_events.length-1; i>=0; --i) {
					var event = type_events[i];
					this.removeEventListener(a, event.listener, event.useCapture);
				}
			}
		// Remove all events
		} else {
			for (var n in this.getEventListeners()) {
				this.clearEventListeners(n);
			}
		}
	};
}

function applyMonkeyPatch() {
	var script = document.createElement('script');
	script.textContent = '(' + monkeyPatch + ')();';
	(document.head || document.documentElement).appendChild(script);
}
