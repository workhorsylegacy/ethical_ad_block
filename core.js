// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


/*
TODO:

. Give SVGs in the menu a max width and height
. Make popup selector remove iframe
. Move popup menu to center of top frame
. Save the randomly generated user id in localStorage

. If a video has autoplay, turn it off when hidden, then back on when shown
. Save the element hash inside the element with setAttribute, so we will not have to download images multiples times to hash.
. on the server, replace path with filepath
. on the server, when reading/writing from file, stop allocations by using strconv.ParseUint/fmt.Sprintf
. change any video elements to not have auto play
. Add a Selenium test suite to stop regressions
. Update so things can be marked as "social". Then users can block all social media buttons and crap.
. Add a moderator mode that shows all ads, including counts below them, and lets users vote on them
. Show users a warning if another Ad Blocker is running
. Add element screen shot to ad voting
. Add the size and URLS of images to votes. This way we can track large images
. Getting screen shots gets the wrong area in Windows 8.1 tablet
. Make it work on Firefox
. Make it work on touch screens
*/

var DEBUG = true;
var BUTTON_SIZE = 15;
var OPACITY = DEBUG ? 0.2 : 0.0;
var OUTLINE_SIZE = DEBUG ? 6 : 2;
var g_checked_hashes = {};
var g_hashes = {};
var g_patched_elements = {};
var g_set_file_hash_cb = {};
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
	'svg' : BLUE,
	'object' : YELLOW,
	'embed' : YELLOW,
	'iframe' : RED,
	'div' : ORANGE
};

function svgToString(element) {
	// Make a copy of the element
	var copy = element.cloneNode(true);

	// Remove all the non SVG attributes
	copy.removeAttribute('style');
	copy.removeAttribute('id');
	copy.removeAttribute('uid');
	var attrs = toArray(copy.attributes);
	for (var i=0; i<attrs.length; ++i) {
		var attr = attrs[i];
		if (attr.nodeName.startsWith('_real_')) {
			copy.removeAttribute(attr.nodeName);
		}
	}

	// Convert the element to XML
	var serializer = new XMLSerializer();
	var data = serializer.serializeToString(copy);
	return data;
}

function svgToDataURI(element, cb) {
	var raw_svg = element;
	if (typeof element !== 'string') {
		raw_svg = svgToString(element);
	}
	var blob = new Blob([raw_svg], {type: "image/svg+xml;charset=utf-8"});
	blobToDataURI(blob, function(data_uri) {
		cb(data_uri);
	});
}

function getImageDataURI(element, src, cb) {
	// If the src is already a Data URI, just return that
	if (isDataURI(src)) {
		cb(src);
		return;
	}

	// Otherwise, load it into a canvas, and return the Data URI
	var img = new Image();
	img.crossOrigin = 'Anonymous';
	img.onload = function(e) {
		var temp_canvas = document.createElement('canvas');
		temp_canvas.width = img.width;
		temp_canvas.height = img.height;
		var ctx = temp_canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);
		var data_uri = temp_canvas.toDataURL('image/png', 1.0);
		console.info('data_uri: ' + data_uri);
		cb(data_uri);
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
	return value && value.length > 0 && value.startsWith('url(') && value.endsWith(')');
}

function isElementInsideSVG(element) {
	var parent = element.parentElement;
	while (parent) {
		if (parent.tagName.toLowerCase() === 'svg') {
			return true;
		}
		parent = parent.parentElement;
	}
	return false;
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
		case 'svg':
			var src = element.innerHTML;
			return src && src.length > 0;
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
		case 'svg':
			var src = element.innerHTML;
			return src && src.length > 0;
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

	var uid = element.getAttribute('uid');
	if (g_hashes.hasOwnProperty(uid)) {
		cb(g_hashes[uid]);
		return;
	}

	// Hash the element based on its type
	switch (element.tagName.toLowerCase()) {
		case 'img':
			var src = getImageSrc(element);
			g_set_file_hash_cb[src] = cb;
			var message = {
				action: 'get_file_hash',
				src: src
			};
			chrome.runtime.sendMessage(message, null);
			break;
		case 'embed':
		case 'object':
			var hash = hexMD5(element.data);
			if (is_printed) {printInfo(element, hash);}
			g_hashes[uid] = hash;
			cb(hash);
			break;
		case 'video':
			var src = getVideoSrc(element);
			// Get only the first 50KB and length of the video
			httpGetBlobChunk(src, function(src, data, total_size) {
//				console.info(data.length);
				blobToDataURI(data, function(data_uri) {
					var hash = data_uri && total_size ? hexMD5(total_size + ':' + data_uri) : null;
					if (is_printed) {printInfo(element, hash);}
					g_hashes[uid] = hash;
					cb(hash);
				});
			}, 50000);
			break;
		case 'svg':
			svgToDataURI(element, function(data_uri) {
				var hash = hexMD5(data_uri);
				if (is_printed) {printInfo(element, hash);}
				g_hashes[uid] = hash;
				cb(hash);
			});
			break;
		// FIXME: Update to hash divs that have click events
		case 'div':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);

				httpGetBlobAsDataURI(src, function(original_src, data_uri) {
					var hash = hexMD5(data_uri);
					if (is_printed) {printInfo(element, hash);}
					g_hashes[uid] = hash;
					cb(hash);
				});
			} else {
				g_hashes[uid] = hash;
				cb(hash);
			}
			break;
		case 'a':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (isValidCSSImagePath(bg)) {
				var src = bg.substring(4, bg.length-1);
				httpGetBlobAsDataURI(src, function(original_src, data_uri) {
					var hash = hexMD5(data_uri);
					if (is_printed) {printInfo(element, hash);}
					g_hashes[uid] = hash;
					cb(hash);
				});
			} else if (element.href && element.href.length > 0) {
				hash = hexMD5(element.href);
				if (is_printed) {printInfo(element, hash);}
				g_hashes[uid] = hash;
				cb(hash);
			} else {
				g_hashes[uid] = hash;
				cb(hash);
			}
			break;
		default:
			throw "Unexpected element '" + element.tagName.toLowerCase() + "' to hash.";
	}
}

function adTypeToIsAd(ad_type) {
	var is_ad = (ad_type >= 2 && ad_type <= 4);
	return is_ad;
}

function isElementAd(hash, cb) {
	/*
	Ad types:
	AD_UNKNOWN = 0
	AD_GOOD = 1
	AD_FRAUDULENT = 2
	AD_TAXING = 3
	AD_MALICIOUS = 4
	*/

	// If the hash is null, just use false
	if (hash === null || hash === undefined || g_checked_hashes.hasOwnProperty(hash)) {
		cb(false);
		return;
	}
	g_checked_hashes[hash] = true;

	// Check the background script if it has the cached ad type
	var message = {
		action: 'get_voted_ad_type',
		ad_id: hash
	};
	chrome.runtime.sendMessage(message, function(response) {
		// The ad type was in the background script
		if (response.voted_ad_type !== null) {
			var is_ad = adTypeToIsAd(response.voted_ad_type);
			cb(is_ad);
		// The ad type was not in the background script, so check for it on the web server
		} else {
			var request = 'http://localhost:9000?voted_ad_type=' + hash;
			var success_cb = function(response_text) {
				var voted_ad_type = parseInt(response_text);
				var is_ad = adTypeToIsAd(voted_ad_type);
				cb(is_ad);

				// Save the vote type in the background script
				var message = {
					action: 'set_voted_ad_type',
					ad_id: hash,
					voted_ad_type: voted_ad_type
				};
				chrome.runtime.sendMessage(message, function(response) {});
			};
			var fail_cb = function(status) {
				cb(false);
			};
			httpGetText(request, success_cb, fail_cb);
		}
	});
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
	var srcs = [];
	var imgs = document.getElementsByTagName('img');
	for (var i=0; i<imgs.length; ++i) {
		var src = getImageSrc(imgs[i]);
		if (! srcs.includes(src)) {
			srcs.push(src);
		}
	}

	// Get all the background-image sources
	var elements = document.getElementsByTagName('*');
	for (var i=0; i<elements.length; ++i) {
		var bg = window.getComputedStyle(elements[i])['background-image'];
		if (isValidCSSImagePath(bg)) {
			var src = bg.substring(4, bg.length-1);
			if (! srcs.includes(src)) {
				srcs.push(src);
			}
		}
	}

	// Get all the SVGs
	var svg_strings = [];
	var svgs = document.getElementsByTagName('svg');
	for (var i=0; i< svgs.length; ++i) {
		if (isElementInsideSVG(svgs[i])) {
			continue;
		}
		var data = svgToString(svgs[i]);
		var rect = getElementRect(svgs[i]);
		var message = {
			data: data,
			width: rect.width,
			height: rect.height
		};
		if (! svg_strings.includes(message)) {
			svg_strings.push(message);
		}
	}

	// Send the image sources to the top window, so it can make a menu
	var request = {
		action: 'show_iframe_menu',
		srcs: srcs,
		svgs: svg_strings
	};
	window.top.postMessage(request, '*');
}

function removeImages(srcs, svgs) {
	// Remove any images that use those sources
	var imgs = document.getElementsByTagName('img');
	for (var i=0; i<imgs.length; ++i) {
		var img = imgs[i];
		var src = getImageSrc(img);
		for (var j=0; j<srcs.length; ++j) {
			if (src === srcs[j]) {
				img.parentElement.removeChild(img);
				break;
			}
		}
	}

	// Remove any elements that use those sources as background-images
	var elements = document.getElementsByTagName('*');
	for (var i=0; i<elements.length; ++i) {
		var element = elements[i];
		var bg = window.getComputedStyle(element)['background-image'];
		if (isValidCSSImagePath(bg)) {
			var src = bg.substring(4, bg.length-1);
			for (var j=0; j<srcs.length; ++j) {
				if (src === srcs[j]) {
					element.parentElement.removeChild(element);
					break;
				}
			}
		}
	}

	// Remove any SVGs that have the same structure
	var elements = document.getElementsByTagName('svg');
	for (var i=0; i<elements.length; ++i) {
		var element = elements[i];
		svgToDataURI(element, function(data_uri) {
			for (var j=0; j<svgs.length; ++j) {
				if (data_uri === svgs[j]) {
					element.parentElement.removeChild(element);
					break;
				}
			}
		});
	}
}

function showMenu(source_window, srcs, svgs) {
	// Transparent container
	var container = document.createElement('iframe');
	container.className = 'nostyle';
	container.style.overflow = 'hidden';
	container.style.boxSizing = 'border-box';
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
	document.body.appendChild(container);
	var frame = container.contentDocument;
	frame.open();
	frame.writeln("<!DOCTYPE html><html><head _is_popup_menu></head><body></body></html>");
	frame.close();
	frame.body.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
	frame.body.style.textAlign = 'center';
	frame.body.style.position = 'fixed';
	frame.body.style.overflow = 'hidden';
	frame.body.style.boxSizing = 'border-box';
	frame.body.style.margin = '0px';
	frame.body.style.padding = '0px';
	frame.body.style.width = '100%';
	frame.body.style.height = '100%';

	// Menu
	var menu = document.createElement('div');
	menu.style.overflow = 'scroll';
	menu.style.boxSizing = 'border-box';
	menu.style.margin = 'auto';
	menu.style.padding = '0px';
	menu.style.textAlign = 'center';
	menu.style.width = '80%';
	menu.style.height = '80%';
	menu.style.backgroundColor = '#f0f0f0';
	menu.style.outline = '1px solid black';
	menu.style.boxShadow = '10px 10px 5px grey';
	frame.body.appendChild(menu);

	// FIXME: Move to the corner of the menu, instead of the page
	// Close button
	var close = document.createElement('button');
	close.style.position = 'absolute';
	close.style.top = '0px';
	close.style.right = '0px';
	close.innerHTML = 'Close';
	close.addEventListener('click', function() {
		document.body.removeChild(container);
	});
	menu.appendChild(close);

	// Header
	var header = document.createElement('h3');
	header.innerHTML = 'Select the elements that best identify the Ad.';
	menu.appendChild(header);

	// Images
	var images = document.createElement('div');
	menu.appendChild(images);

	// Load each src into an image
	for (var i=0; i<srcs.length; ++i) {
		httpGetBlobAsDataURI(srcs[i], function(original_src, data_uri) {
//			console.info(original_src);
//			console.info(data_uri);

			var box = document.createElement('div');
			box.type = 'checkbox';
			images.appendChild(box);

			var new_img = document.createElement('img');
			new_img.src = data_uri;
			new_img.style.border = '1px solid black';
			box.appendChild(new_img);
			box.appendChild(document.createElement('br'));

			var check = document.createElement('input');
			check.type = 'checkbox';
			check.original_src = original_src;
			box.appendChild(check);

			var span = document.createElement('span');
			span.innerHTML = original_src;
			box.appendChild(span);
			box.appendChild(document.createElement('hr'));
		});
	}

	// Load SVGs
	if (svgs) {
		for (var i=0; i<svgs.length; ++i) {
			var svg = svgs[i];
			svgToDataURI(svg.data, function(data_uri) {
				var box = document.createElement('div');
				box.type = 'checkbox';
				images.appendChild(box);

				var new_img = document.createElement('img');
				new_img.src = data_uri;
/*
				if (svg.width > 0 && svg.height > 0) {
					new_img.width = svg.width;
					new_img.width = svg.height;
				}
*/
				new_img.style.border = '1px solid black';
				box.appendChild(new_img);
				box.appendChild(document.createElement('br'));

				var check = document.createElement('input');
				check.type = 'checkbox';
				check.svg_data_uri = data_uri;
				box.appendChild(check);

				var span = document.createElement('span');
				span.innerHTML = data_uri;
				box.appendChild(span);
				box.appendChild(document.createElement('hr'));
			});
		}
	}

	// Button
	var button = document.createElement('button');
	button.innerHTML = 'Submit as Ads';
	button.addEventListener('click', function() {
		// Tell the server that all the selected images are ads
		var srcs_to_remove = [];
		var svgs_to_remove = [];
		var inputs = menu.getElementsByTagName('input');
		for (var i=0; i<inputs.length; ++i) {
			var input = inputs[i];
			if (input.type === 'checkbox' && input.checked) {
				// Image
				if (input.original_src) {
					srcs_to_remove.push(input.original_src);
					httpGetBlobAsDataURI(input.original_src, function(original_src, data_uri) {
						var hash = hexMD5(data_uri);
						if (hash) {
							voteForAd(hash, 'fraudulent'); // FIXME: Let the user select the ad type
						}
					});
				// SVG
				} else if (input.svg_data_uri) {
					svgs_to_remove.push(input.svg_data_uri);
					var hash = hexMD5(input.svg_data_uri);
					if (hash) {
						voteForAd(hash, 'fraudulent'); // FIXME: Let the user select the ad type
					}
				}
			}
		}

		// Remove all the images that are ads
		var request = {
			action: 'remove_images_in_iframe',
			srcs: srcs_to_remove,
			svgs: svgs_to_remove
		};
		source_window.postMessage(request, '*');

		// Remove the popup menu
		document.body.removeChild(container);
	});
	menu.appendChild(button);
}

function voteForAd(hash, ad_type) {
	var message = {
		action: 'remove_voted_ad_type',
		ad_id: hash
	};
	chrome.runtime.sendMessage(message, function(response) {
		// Tell the server that this hash is for an ad
		var request = 'http://localhost:9000' +
			'?user_id=' + g_user_id +
			'&vote_ad=' + hash +
			'&ad_type=' + ad_type;
		console.info(request);
		var success_cb = function(response_text) {
			console.log(response_text);
		};
		var fail_cb = function(status) {
			console.error('Failed to connect to server.');
		};
		httpGetText(request, success_cb, fail_cb);
	});
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
					getImageDataURI(image, src, function(data_uri) {
						var request = {
							action: 'append_screen_shot',
							data_uri: data_uri
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
						voteForAd(hash, element.ad_type);
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

function checkAllElementsForAds(known_elements, parent) {
	// Skip if the parent has no children, no tag name, or is an iframe
	if (! parent || ! parent.getElementsByTagName || (parent.tagName && parent.tagName.toLowerCase() === 'iframe')) {
		return;
	}

	for (var tag in TAGS1) {
		var elements = parent.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an uid, generate a random one
			if (! element.hasAttribute('uid')) {
				element.setAttribute('uid', generateRandomId());
			}
			var uid = element.getAttribute('uid');

			// Only look at elements that have not already been examined
			if (! known_elements.hasOwnProperty(uid)) {
				// Make the element hidden before we can examine it
				hideElement(element);

				// Skip the element if it has not finished loading
				if (! isElementLoaded(element)) {
					// Check all images after they load
					if (tag === 'img') {
						element.addEventListener('load', function(e) {
							checkElementForAds(this);
						});
					// Check all videos after they load
					} else if (tag === 'video') {
						element.addEventListener('loadeddata', function(e) {
							checkElementForAds(this);
						});
					}
					continue;
				}

				// Show the element if it is not hashable
				if (! isElementHashable(element)) {
					known_elements[uid] = true;
					showElement(element);
					continue;
				}

				// Check if the element is an ad
				var name = element.tagName.toLowerCase();
				switch (name) {
					// Show all iframes, and add an outline
					case 'iframe':
						known_elements[uid] = true;
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
					case 'svg':
						var color = TAGS1[name];
						known_elements[uid] = true;
						removeElementIfAd(element, color);
						break;
					default:
						throw "Unexpected element '" + name + "' to check for ads.";
				}
			}
		}
	}
}

function checkElementForAds(element) {
	// If the element does not have an uid, generate a random one
	if (! element.hasAttribute('uid')) {
		// Make the element hidden before we can examine it for the first time
		hideElement(element);

		element.setAttribute('uid', generateRandomId());
	}

	// Skip the element if it has not finished loading
	if (! isElementLoaded(element)) {
		return;
	}

	// Show the element if it is not hashable
	if (! isElementHashable(element)) {
		showElement(element);
		return;
	}

	// Check if the element is an ad
	var name = element.tagName.toLowerCase();
	switch (name) {
		// Show all iframes, and add an outline
		case 'iframe':
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
		case 'svg':
			var color = TAGS1[name];
			removeElementIfAd(element, color);
			break;
		default:
			throw "Unexpected element '" + name + "' to check for ads.";
	}
}

// Keep looking at page elements, and add buttons to ones that loaded
function checkElementsLoop() {

	// Wait for the body to be created
	document.addEventListener('DOMContentLoaded', function() {
		var known_elements = {};
		checkAllElementsForAds(known_elements, document);

		// Create an observer to look at all element changes
		var observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				switch (mutation.type) {
					case 'attributes':
						var name = mutation.target.tagName ? mutation.target.tagName.toLowerCase() : null;
						// FIXME: Have this only trigger on attributes that change the hashed value
						if (name && TAGS1.hasOwnProperty(name)) {
							switch (name) {
								case 'img':
									if (mutation.attributeName === 'src' ||
										mutation.attributeName === 'srcset' ||
										mutation.attributeName === 'imgsrc') {
//										console.info('attributes img "' + mutation.attributeName + '"...');
										checkElementForAds(mutation.target);
									}
									break;
								case 'embed':
								case 'object':
									if (mutation.attributeName === 'data') {
//										console.info('attributes object "' + mutation.attributeName + '"...');
										checkElementForAds(mutation.target);
									}
									break;
								case 'video':
									if (mutation.attributeName === 'src') {
//										console.info('attributes video "' + mutation.attributeName + '"...');
										checkElementForAds(mutation.target);
									}
									break;
								case 'a':
									if (mutation.attributeName === 'href') {
//										console.info('attributes a "' + mutation.attributeName + '"...');
										checkElementForAds(mutation.target);
									}
									break;
							}
						}
						break;
					case 'childList':
						if (mutation.addedNodes) {
							var known_elements = {};
							for (var i=0; i<mutation.addedNodes.length; ++i) {
								var node = mutation.addedNodes[i];
								var name = node.tagName ? node.tagName.toLowerCase() : null;
								if (name && TAGS1.hasOwnProperty(name)) {
//									console.info('childList ...');
									checkElementForAds(node);
								}
								checkAllElementsForAds(known_elements, node);
							}
						}
						break;
				}
			});
		});

		// Look for all changes to attributes, and new elements
		var config = {
			attributes: true,
//			attributeOldValue: true,
			childList: true,
			subtree: true
		};

		// Start observing any changes to the body
		observer.observe(document.body, config);
	});
}

// Monkey patch the addEventListener and removeEventListener methods to
// keep a list of events for lookup via the getEventListeners method.
function monkeyPatchTrackEventListeners() {
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

function addScriptTrackEventListeners() {
	var script = document.createElement('script');
	script.textContent = '(' + monkeyPatchTrackEventListeners + ')();';
	(document.head || document.documentElement).appendChild(script);
}

function addStyleRemovePluginStyles() {
	var style = document.createElement('style');
	style.textContent = "a, img, video, iframe, object, embed, div, svg { opacity: 1; pointer-events: all; }";
	document.head.appendChild(style);
}


