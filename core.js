// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


/*
TODO:

. Make it get CSS background-image images in the popup selector.
. Make popup selector submit images as ads and remove iframe
. Move popup menu to center of top frame
. Make hashing work with svg
. Save the randomly generated user id in localStorage

. Add a Selenium test suite to stop regressions
. Update so things can be marked as "social". Then users can block all social media buttons and crap.
. Add a moderator mode that shows all ads, including counts below them, and lets users vote on them
. Show users a warning if another Ad Blocker is running
. Add element screen shot to ad voting
. Getting screen shots gets the wrong area in Windows 8.1 tablet
. Make it work on Firefox
. Make it work on touch screens
*/

var DEBUG = true;
var BUTTON_SIZE = 15;
var OPACITY = DEBUG ? 0.2 : 0.0;
var OUTLINE_SIZE = DEBUG ? 6 : 2;
var g_known_elements = {};
var g_patched_elements = {};
var g_cursor_x = 0;
var g_cursor_y = 0;
var g_user_id = null;

var BLUE = function(alpha) { return 'rgba(0, 0, 255, ' + alpha + ')'; };
var GREEN = function(alpha) { return 'rgba(0, 255, 0, ' + alpha + ')'; };
var RED = function(alpha) { return 'rgba(255, 0, 0, ' + alpha + ')'; };
var ORANGE = function(alpha) { return 'rgba(255, 165, 0, ' + alpha + ')'; };
var PURPLE = function(alpha) { return 'rgba(128, 0, 128, ' + alpha + ')'; };
var YELLOW = function(alpha) { return 'rgba(255, 255, 0, ' + alpha + ')'; };

var TAGS1 = {
	'a' : PURPLE,
	'img' : BLUE,
	'video' : BLUE,
	'object' : YELLOW,
	'embed' : YELLOW,
	'iframe' : RED,
	'div' : ORANGE
};

function toArray(obj) {
	var retval = [];
	for (var i=0; i<obj.length; ++i) {
		retval.push(obj[i]);
	}
	return retval;
}

function hexMD5(value) {
	if (value) {
		return hex_md5(value);
	} else {
		return null;
	}
}

// NOTE: CORS stops us from accessing the Content-Length header field. But
// we can access it by manually parsing the raw headers
function getResponseHeaderContentLength(xhr) {
	// Get the headers as a raw string
	var raw = xhr.getAllResponseHeaders().toLowerCase();

	// If there is no Content-Length, just return 0
	if (raw.indexOf('content-length: ') === -1) {
		return 0;
	}

	// Get the value
	var content_length = 0;
	content_length = raw.split('content-length: ')[1];
	content_length = content_length.split('\r\n')[0];
	content_length = parseInt(content_length);
	return content_length;
}

function blobToDataURL(blob, cb) {
	var a = new FileReader();
	a.onload = function(e) {
		cb(e.target.result);
	}
	a.readAsDataURL(blob);
}

function httpGetBinary(request, success_cb, fail_cb) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				var response_bytes = xhr.response;
				success_cb(response_bytes, response_bytes.length);
			} else {
				fail_cb(xhr.status);
			}
		} else if (xhr.readyState === 0) {
			fail_cb(0);
		}
	};
	xhr.onerror = function() {
		fail_cb(0);
	};
	xhr.timeout = 3000;
	xhr.responseType = "blob";
	xhr.open('GET', request, true);
	xhr.send(null);
}

function httpGetText(request, success_cb, fail_cb) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				var content_length = getResponseHeaderContentLength(xhr);
				success_cb(xhr.responseText, content_length);
			} else {
				fail_cb(xhr.status);
			}
		} else if (xhr.readyState === 0) {
			fail_cb(0);
		}
	};
	xhr.onerror = function() {
		fail_cb(0);
	};
	xhr.timeout = 3000;
	xhr.open('GET', request, true);
	xhr.send(null);
}

function httpGetTextChunk(request, success_cb, fail_cb, max_len) {
//	console.info('request: ' + request);
	var total_len = 0;
	var data = '';
	var xhr = new XMLHttpRequest();
	xhr.onprogress = function(e) {
//		console.info('    status: ' + xhr.status);
//		console.info('    readyState: ' + xhr.readyState);
		if (xhr.status !== 200) {
//			console.info('        total: ' + total_len);
			if (fail_cb) fail_cb(0);
			success_cb = null;
			fail_cb = null;
			xhr.abort();
		} else {
			var cur_len = xhr.responseText.length;
//			console.info('        cur: ' + cur_len);
			total_len += cur_len;
			// FIXME: Appending to a string is bad for GC, as it creates a new string each time. Replace with array.
			data += xhr.responseText;
			if (total_len >= max_len) {
				data = data.slice(0, max_len);
			}
			if (xhr.readyState === 4 || total_len >= max_len) {
				var content_length = getResponseHeaderContentLength(xhr);
//				console.info('        total: ' + total_len);
//				console.info('        content_length: ' + content_length);
				if (success_cb) success_cb(data, content_length);
				success_cb = null;
				fail_cb = null;
				xhr.abort();
			}
		}
	};
	xhr.onerror = function() {
//		console.info('        total: ' + total_len);
		if (fail_cb) fail_cb(0);
		success_cb = null;
		fail_cb = null;
	};
	xhr.timeout = 3000;
	xhr.open('GET', request, true);
	xhr.send(null);
}

function getFileBinary(element, src, cb, max_len) {
	if (! src) {
		console.error("Element src is missing: " + element.outerHTML);
		cb(null, 0);
	} else {
		var request = src;
		var success_cb = function(response_text, total_size) {
//			console.info(response_text);
			cb(response_text, total_size);
		};
		var fail_cb = function(status) {
			cb(null, 0);
		};
		if (max_len) {
			httpGetTextChunk(request, success_cb, fail_cb, max_len);
		} else {
			httpGetText(request, success_cb, fail_cb);
		}
	}
}

function getImageDataUrl(element, src, cb) {
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

// Return true if value is a valid CSS image path, such as "url(blah.png)"
function isValidCSSImagePath(value) {
	value = value.toLowerCase();
	return value && value.length > 0 && value.indexOf('url(') === 0 && value[value.length-1] === ')';
}
/*
function isElementInsideLink(element) {
	var parent = element.parentElement;
	while (parent) {
		if (parent.tagName.toLowerCase() === 'a') {
			return true;
		}
		parent = parent.parentElement;
	}
	return false;
}
*/
function isElementTooSmall(element) {
	var rect = getElementRect(element);
	return (rect.width < 20 || rect.height < 20);
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
	if (! g_patched_elements.hasOwnProperty(element.getAttribute('uid'))) {
		g_patched_elements[element.getAttribute('uid')] = true;

		var computed_style = window.getComputedStyle(element);

		// position
		if (! DEBUG) {
			if (computed_style.position !== 'fixed') {
				element.setAttribute('_real_position', computed_style.position);
			}
			element.style.position = 'fixed';
		}

		// opacity
		if (computed_style.opacity != OPACITY) {
			element.setAttribute('_real_opacity', computed_style.opacity);
		}
		element.style.opacity = OPACITY;

		// pointerEvents
		if (computed_style.pointerEvents !== 'none') {
			element.setAttribute('_real_pointer_events', computed_style.pointerEvents);
		}
		element.style.pointerEvents = 'none';
	}
}

function setElementOutline(element, color) {
	if (! element.outline_color) {
		element.outline_color = color;
	}

	if (DEBUG) {
		element.style.outline = OUTLINE_SIZE + 'px solid ' + color(0.5);
		element.style.outlineOffset = - (OUTLINE_SIZE / 2) + 'px';
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

function getImageSrc(element) {
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

function isElementLoaded(element) {
	var name = element.tagName.toLowerCase();

	switch (name) {
		case 'div':
		case 'a':
		case 'iframe':
			return true;
		case 'img':
			var src = getImageSrc(element);
			return src && src.length > 0 && element.complete;
		case 'video':
			var src = getVideoSrc(element);
			return src && src.length > 0 && element.readyState === 4;
		case 'embed':
		case 'object':
			return element.data && element.data.length > 0;
		default:
			throw "Unexpected element '" + name + "' to check if loaded.";
	}

	return false;
}

function isElementHashable(element) {
	var name = element.tagName.toLowerCase();

	switch (name) {
		case 'div':
			// Element has a background image or click event
			var bg = window.getComputedStyle(element)['background-image'];
			return isValidCSSImagePath(bg) || element.getAttribute('onclick') || element.getAttribute('_has_event_listener_click');
		case 'a':
			// Element has a background image or href
			var bg = window.getComputedStyle(element)['background-image'];
			return isValidCSSImagePath(bg) || element.href && element.href.length > 0;
		case 'iframe':
			return true;
		case 'img':
			var src = getImageSrc(element);
			return src && src.length > 0 && element.complete;
		case 'video':
			var src = getVideoSrc(element);
			return src && src.length > 0 && element.readyState === 4;
		case 'embed':
		case 'object':
			return element.data && element.data.length > 0;
		default:
			throw "Unexpected element '" + name + "' to check if hashable.";
	}

	return false;
}

function getElementHash(is_printed, element, cb) {
	function printInfo(element, data) {
		console.info(element);
		console.info('hash ' + element.tagName.toLowerCase() + ': ' + data);
	}

	// Hash the element based on its type
	switch (element.tagName.toLowerCase()) {
		case 'img':
			var src = getImageSrc(element);
			getFileBinary(element, src, function(data, total_size) {
				var hash = hexMD5(data);
				if (is_printed) {printInfo(element, hash);}
				cb(hash);
			});
			break;
		case 'embed':
		case 'object':
			var hash = hexMD5(element.data);
			if (is_printed) {printInfo(element, hash);}
			cb(hash);
			break;
		case 'video':
			var src = getVideoSrc(element);
			// Get only the first 50KB and length of the video
			getFileBinary(element, src, function(data, total_size) {
//				console.info(data.length);
				var hash = data && total_size ? hexMD5(total_size + ':' + data) : null;
				if (is_printed) {printInfo(element, hash);}
				cb(hash);
			}, 50000);
			break;
		// FIXME: Update to hash divs that have click events
		case 'div':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);
				getFileBinary(element, src, function(data, total_size) {
					var hash = hexMD5(data);
					if (is_printed) {printInfo(element, hash);}
					cb(hash);
				});
			} else {
				cb(hash);
			}
			break;
		case 'a':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);
				getFileBinary(element, src, function(data, total_size) {
					var hash = hexMD5(data);
					if (is_printed) {printInfo(element, hash);}
					cb(hash);
				});
			} else if (element.href && element.href.length > 0) {
				hash = hexMD5(element.href);
				if (is_printed) {printInfo(element, hash);}
				cb(hash);
			} else {
				cb(hash);
			}
			break;
		default:
			throw "Unexpected element '" + element.tagName.toLowerCase() + "' to hash.";
	}
}

function isElementAd(hash, cb) {
	// If the hash is null, just use false
	if (hash === null || hash === undefined) {
		cb(false);
		return;
	}

	// Check the web server to see if this hash is for an ad
	/*
	Ad types:
	AD_UNKNOWN = 0
	AD_GOOD = 1
	AD_FRAUDULENT = 2
	AD_TAXING = 3
	AD_MALICIOUS = 4
	*/
	var request = 'http://localhost:9000?voted_ad_type=' + hash;
	var success_cb = function(response_text) {
		var ad_type = parseInt(response_text);
		var is_ad = (ad_type >= 2 && ad_type <= 4);
		cb(is_ad);
	};
	var fail_cb = function(status) {
		cb(false);
	};
	httpGetText(request, success_cb, fail_cb);
}

function removeElementIfAd(element, color, cb_after_not_ad) {
	getElementHash(false, element, function(hash) {
		isElementAd(hash, function(is_ad) {
			if (is_ad) {
				var parent = element.parentElement;

				if (parent) {
					// If the parent has children, remove only the element
					if (parent.children && parent.children.length > 0) {
						parent.removeChild(element);
					// If the parent has innerHTML, remove only the element
					} else if (parent.innerHTML && parent.innerHTML.length > 0) {
						parent.removeChild(element);
					// Else remove the parent
					} else {
						parent.parentElement.removeChild(parent);
					}
				// Else remove the element
				} else {
					parent.removeChild(element);
				}
			} else {
				showElement(element);
				if (! isElementTooSmall(element)) {
					setElementOutline(element, color);
					createButton(element);
				} else {
//					setElementOutline(element, GREEN);
				}

				if (cb_after_not_ad) {
					cb_after_not_ad(element);
				}
			}
		});
	});
}

function createButton(element) {
	// Just return if this element already has a button
	if (element.canvas) {
		return;
	}

	if (! element.prev_outline) {
		element.prev_outline = element.style.outline;
	}

	// Add a button when the mouse is over the element
	var mouse_enter = function(e) {
		var node = e.path[0];

		// Just return if there is already a canvas
		if (node.canvas !== null && node.canvas !== undefined) {
			return;
		}

		var tag = node.tagName.toLowerCase();
		var color = TAGS1[node.tagName.toLowerCase()];
//		if (! DEBUG) {
			color = PURPLE;
//		}
		node.style.outline = OUTLINE_SIZE + 'px dashed ' + node.outline_color(1.0);
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
		ctx.fillStyle = color(1.0);
		ctx.fill();

		// Connect the canvas to the element
		node.canvas = canvas;
		canvas.node = node;

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
				node.style.outline = node.prev_outline;
				node.canvas = null;
				document.body.removeChild(canvas);
				clearInterval(rect_interval);
				rect_interval = null;
			}
		}, 100);
		canvas.rect_interval = rect_interval;

		// Remove the element when the button is clicked
		canvas.addEventListener('click', function(e) {
			if (window !== window.top) {
				handleIframeClick(e);
			} else {
				handleNormalClick(e);
			}
		}, false);
	};

	element.addEventListener('mouseenter', mouse_enter, false);
}

function handleIframeClick(e) {
	var canvas = e.path[0];
	var rect_interval = canvas.rect_interval;
	var node = canvas.node;

	// Hide the button
	canvas.style.display = 'none';

	// Get all the image sources
	var imgs = document.getElementsByTagName('img');
	var srcs = [];
	for (var i=0; i<imgs.length; ++i) {
		srcs.push(imgs[i].src);
	}

	// Send the image sources to the top window, so it can make a menu
	var request = {
		message: 'show_iframe_menu',
		srcs: srcs
	};
	window.top.postMessage(request, '*');
}

// FIXME: Make it so the menu has a scroll bar instead of the iframe
function showMenu(srcs) {
	// Transparent container
	var container = document.createElement('iframe');
	container.className = 'nostyle';
	container.style.position = 'fixed';
	container.style.textAlign = 'center';
	container.style.width = '100%';
	container.style.height = '100%';
	container.style.top = '0px';
	container.style.bottom = '0px';
	container.style.right = '0px';
	container.style.left = '0px';
	container.style.margin = '0px';
	container.style.padding = '0px';
	container.style.zIndex = 100000;
	container.style.overflow = 'visible';
	document.body.appendChild(container);
	var frame = container.contentDocument;
	frame.open();
	frame.writeln("<!doctype html><html><body></body></html>");
	frame.close();
	frame.body.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
	frame.body.style.textAlign = 'center';

	// Button menu
	var menu = document.createElement('div');
	menu.style.overflow = 'visible';
	menu.style.margin = 'auto';
	menu.style.padding = '10px';
	menu.style.textAlign = 'center';
	menu.style.width = '60%';
	menu.style.backgroundColor = '#f0f0f0';
	menu.style.outline = '1px solid black';
	menu.style.boxShadow = '10px 10px 5px grey';
	frame.body.appendChild(menu);

	// Header
	var header = document.createElement('h3');
	header.innerHTML = 'Select the elements that best identify the Ad.';
	menu.appendChild(header);

	// Load each src into an image
	for (var i=0; i<srcs.length; ++i) {
		var request = srcs[i];

		var success_cb = function(response_binary, total_size) {
			blobToDataURL(response_binary, function(data_url) {
//				console.info(request);
//				console.info(data_url);
				var new_img = document.createElement('img');
				new_img.src = data_url;
				menu.appendChild(new_img);
				menu.appendChild(document.createElement('br'));
			});
		};
		var fail_cb = function(status) {

		};
		httpGetBinary(request, success_cb, fail_cb);
	}
}

function handleNormalClick(e) {
	var canvas = e.path[0];
	var rect_interval = canvas.rect_interval;
	var node = canvas.node;

	// Hide the button
	canvas.style.display = 'none';

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
	menu.style.outline = '1px solid black';
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

		// Remove the outline and buttons
		node.style.outline = node.prev_outline;
		menu.parentElement.removeChild(menu);

		// Wait for the next set of DOM events, so the element's outline will be removed
		setTimeout(function() {
			// Get a screen shot from the background script
			rect = getElementRectWithChildren(node);
			getScreenShot(rect, function(image, data_uri) {
				// Send the image to the top window
				if (DEBUG) {
					var src = getImageSrc(image);
					getImageDataUrl(image, src, function(data_url) {
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
				getElementHash(true, node, function(hash) {
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
							console.error('Failed to connect to server.');
						};
						httpGetText(request, success_cb, fail_cb);
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
}

function checkElementsThatMayBeAds() {
	for (var tag in TAGS1) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an uid, generate a random one
			if (! element.hasAttribute('uid')) {
				element.setAttribute('uid', generateRandomId());
			}
			var uid = element.getAttribute('uid');

			// Only look at elements that have not already been examined
			if (! g_known_elements.hasOwnProperty(uid)) {
				// Make the element hidden before we can examine it
				hideElement(element);

				// Skip the element if it has not finished loading
				if (! isElementLoaded(element)) {
					continue;
				}

				// Show the element if it is not hashable
				if (! isElementHashable(element)) {
					g_known_elements[uid] = true;
					showElement(element);
					continue;
				}

				// Check if the element is an ad
				var name = element.tagName.toLowerCase();
				switch (name) {
					// Show all iframes, and add an outline
					case 'iframe':
						g_known_elements[uid] = true;
						showElement(element);
						setElementOutline(element, RED);
						break;
					// Check everything else
					case 'img':
					case 'div':
					case 'a':
					case 'object':
					case 'embed':
					case 'video':
						var color = TAGS1[name];
						g_known_elements[uid] = true;
						removeElementIfAd(element, color);
						break;
					default:
						throw "Unexpected element '" + name + "' to check for ads.";
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
		if (!a || !b) return;

		// Init everything
		c = c || false;
		this._event_listeners = this._event_listeners || {};
		this._event_listeners[a] = this._event_listeners[a] || [];

		// Add the event
		// FIXME: Remove the previous listener if it is already in the list
		this._event_listeners[a].push({listener: b, useCapture: c});
		this.setAttribute('_has_event_listener_' + a.toLowerCase(), 'true');

		// Call the real method
		this._addEventListener(a, b, c);
	};

	// removeEventListener
	Element.prototype._removeEventListener = Element.prototype.removeEventListener;
	Element.prototype.removeEventListener = function(a, b, c) {
		if (!a || !b) return;

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
