// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


/*
TODO:
. Check why ads on stack overflow have different hashes, for the same ad after a reload.
. Add a moderator mode that shows all ads, including counts below them, and lets users vote on them
. There are problems with mixed content https://news.ycombinator.com/news
. Show users a warning if another Ad Blocker is running
. Many elements on http://streamtuner.me/ don't get seen as possible ads
. Save the randomly generated user id in localStorage.
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
var g_patched_opacity_elements = {};
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

function ajaxGet(request, successCb, failCb) {
	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = function() {
		if (httpRequest.readyState === 4) {
			if (httpRequest.status === 200) {
				successCb(httpRequest.responseText);
			} else {
				failCb(httpRequest.status);
			}
		} else if (httpRequest.readyState === 0) {
			failCb(0);
		}
	};
	httpRequest.onerror = function() {
		failCb(0);
	};
	httpRequest.timeout = 3000;
	httpRequest.open('GET', request, true);
	httpRequest.send(null);
}

function get_iframe_guid(win) {
	var retval = [];
	var child = win;
	var parent = win.parent;
	while (parent && child && child !== window.top) {
		for (var i=0; i < parent.frames.length; ++i) {
			if (parent.frames[i] === child) {
				retval.splice(0, 0, i);
				break;
			}
		}
		child = child.parent;
		parent = child.parent;
	}

	retval.splice(0, 0, 0);
	return retval.join('.');
}

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
	// Just return if the element is null
	if (! element) {
		return;
	}
/*
	element.style.position = '';
	element.style.top = '';
	element.style.left = '';
*/

	if (element.hasAttribute('_real_opacity')) {
		element.style.opacity = element.getAttribute('_real_opacity');
		element.removeAttribute('_real_opacity');
	} else {
		element.style.opacity = 1.0;
	}
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
	switch (element.tagName.toLowerCase()) {
		case 'img':
			// Copy the image to a cross origin safe one
			// then hash it
			var img = new Image();
			img.crossOrigin = 'Anonymous';
			img.onload = function(e) {
				var self = e.path[0];
				// Create a hash of the image
				var temp_canvas = document.createElement('canvas');
				temp_canvas.width = self.width;
				temp_canvas.height = self.height;
				var ctx = temp_canvas.getContext('2d');
				ctx.drawImage(self, 0, 0);
				var data_url = temp_canvas.toDataURL();
				var hash = hex_md5(data_url);
				cb(hash, element);
			};
			img.onerror = function(e) {
				var self = e.path[0];
				// Create a hash of the image
				console.error('Failed to hash img: ' + self.src);
				cb(null, element);
			};
			if (element.src && element.src.length > 0) {
				img.src = element.src;
			} else if (element.srcset && element.srcset.length > 0) {
				img.src = element.srcset;
			} else {
				console.error("Can't hash img with no source: " + element.outerHTML);
				cb(null, element);
			}
			break;
		case 'iframe':
			var hash = element.getAttribute('document_hash');
			cb(hash, element);
			break;
		case 'embed':
		case 'object':
			var hash = hex_md5(element.data);
			cb(hash, element);
			break;
		case 'video':
			var hash = hex_md5(element.src);
			cb(hash, element);
			break;
		case 'a':
			var hash = null;
			var bg = window.getComputedStyle(element)['background-image'];
			if (bg && bg !== 'none' && bg.length > 0 && bg.indexOf('url(') === 0 && bg[bg.length-1] === ')') {
				var img = new Image();
				img.crossOrigin = 'Anonymous';
				img.onload = function(e) {
					var self = e.path[0];
					// Create a hash of the image
					var temp_canvas = document.createElement('canvas');
					temp_canvas.width = self.width;
					temp_canvas.height = self.height;
					var ctx = temp_canvas.getContext('2d');
					ctx.drawImage(self, 0, 0);
					var data_url = temp_canvas.toDataURL();
					var hash = hex_md5(data_url);
					cb(hash, element);
				};
				img.onerror = function(e) {
					var self = e.path[0];
					// Create a hash of the image
					console.error('Failed to hash img: ' + self.src);
					cb(null, element);
				};
				img.src = bg.substring(4, bg.length-1);
			} else if (element.children.length > 0) {
				hash = hex_md5(element.href);
			} else if (element.href && element.href.length > 0) {
				hash = hex_md5(element.href);
			}
			cb(hash, element);

			break;
		default:
			throw "Unexpected element '" + element.tagName.toLowerCase() + "' to hash.";
	}
}

function hash_current_document(cb) {
	// Hash the first found meaningful element
	var tags = ['img', 'video', 'embed', 'object', 'iframe', 'a'];
	for (var i=0; i<tags.length; ++i) {
		var tag = tags[i];
		var elements = document.getElementsByTagName(tag);
		if (elements.length > 0) {
			get_element_hash(elements[0], function(hash, element) {
				cb(hash);
			});
			return;
		}
	}

	// If there are no elements, hash the document
	var serializer = new XMLSerializer();
	var hash = serializer.serializeToString(document);
	hash = hex_md5(hash);
	cb(hash);
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

							if (hash) {
								// Tell the server that this hash is for an ad
								var request = 'http://localhost:9000' +
									'?user_id=' + g_user_id +
									'&vote_ad=' + hash +
									'&ad_type=' + element.ad_type;
								var successCb = function(responseText) {
									console.log(responseText);
								};
								var failCb = function(status) {
									console.log('Failed to connect to server.');
								};
								ajaxGet(request, successCb, failCb);
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

function isAd(hash, cb) {
	// If the hash is null, just use false
	if (hash == null || hash == undefined) {
		cb(false);
		return;
	}

	// Check the web server to see if this hash is for an ad
	var request = 'http://localhost:9000?is_ad=' + hash;
	var successCb = function(responseText) {
		var is_ad = (responseText.toLowerCase() === 'true');
		cb(is_ad);
	};
	var failCb = function(status) {
		cb(false);
	};
	ajaxGet(request, successCb, failCb);
}

function check_elements_that_may_be_ads() {
	for (var tag in TAGS1) {
		var elements = document.getElementsByTagName(tag);
		for (var i=0; i<elements.length; ++i) {
			var element = elements[i];

			// If the element does not have an id, generate a random one
			if (element.id === '' || element.id === null || element.id === undefined) {
				element.id = generate_random_id();
			}

			// Save the previous opacity, just incase it was not 1.0
			if (! g_patched_opacity_elements.hasOwnProperty(element.id)) {
				g_patched_opacity_elements[element.id] = 1;

				if (element.style.opacity) {
					element.setAttribute('_real_opacity', element.style.opacity);
				}
				element.style.opacity = 0.2;
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
					case 'iframe':
						// NOTE: The 'document_hash' attribute is set when the message 
						// 'from_iframe_document_to_iframe_element' is posted to the iframe's window.			
						var document_hash = element.getAttribute('document_hash');
						if (document_hash && document_hash.length > 0) {
							g_known_elements[element.id] = 1;
							var hash = document_hash;
							isAd(hash, function(is_ad) {
								if (is_ad) {
									element.parentElement.removeChild(element);
								} else {
//									show_element(element);
//									set_border(element, 'orange');
//									create_button(element, null);
								}
							});
						// NOTE: In special cases the iframe does not get the content_script loaded into it.
						// So we will have to manually check if the iframe's document is an ad.
						} else if (element.src.toLowerCase() === 'about:blank' || element.src.toLowerCase().indexOf('javascript:') === 0 || ! element.getAttribute('src')) {
							g_known_elements[element.id] = 1;

							get_element_hash(element, function(hash, n) {
								isAd(hash, function(is_ad) {
									console.info('XXXXXXXXXXXXXXX');
									if (is_ad) {
										element.parentElement.removeChild(element);
									} else {
										// Show the iframe element
										show_element(element);
										set_border(element, 'red');
										create_button(element, null);

										// Show the iframe's document
										try {
											show_element(element.contentDocument.body);
										} catch(err) {

										}
									}
								});
							});
						}
						break;
					case 'img':
						if (element.src && element.src.length > 0 || element.srcset && element.srcset.length > 0) {
							g_known_elements[element.id] = 1;
//							console.log(element);

							// Element's image has not loaded yet
							if (! element.complete) {
								var load_cb = function(evt) {
									var node = evt.path[0];
									node.removeEventListener('load', load_cb);

									get_element_hash(node, function(hash, n) {
										isAd(hash, function(is_ad) {
											if (is_ad) {
												n.parentElement.removeChild(n);
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
									});
								};

								element.addEventListener('load', load_cb, false);
							// Element's image has already loaded
							} else {
								var node = element;

								get_element_hash(node, function(hash, n) {
									isAd(hash, function(is_ad) {
										if (is_ad) {
											n.parentElement.removeChild(n);
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
								});
							}
						}
						break;
					case 'a':
						g_known_elements[element.id] = 1;

						// Anchor has a background image
						var bg = window.getComputedStyle(element)['background-image'];
						if (bg && bg !== 'none' && bg.length > 0) {
//							console.log(element);

							// FIXME: This does not hash the image
							get_element_hash(element, function(hash, n) {
								isAd(hash, function(is_ad) {
									if (is_ad) {
										n.parentElement.removeChild(n);
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
							});
						// Anchor has children
						} else if (element.children.length > 0) {
//							console.log(element);

							get_element_hash(element, function(hash, n) {
								isAd(hash, function(is_ad) {
									if (is_ad) {
										n.parentElement.removeChild(n);
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
							});
						// Anchor is just text
						} else {
							show_element(element);
						}
						break;
					case 'object':
					case 'embed':
						g_known_elements[element.id] = 1;
//						console.log(element);

						get_element_hash(element, function(hash, n) {
							isAd(hash, function(is_ad) {
								if (is_ad) {
									n.parentElement.removeChild(n);
								} else {
									show_element(n);
									set_border(n, 'yellow');
									create_button(n, null);
								}
							});
						});
						break;
					case 'video':
						g_known_elements[element.id] = 1;
//						console.log(element);

						get_element_hash(element, function(hash, n) {
							isAd(hash, function(is_ad) {
								if (is_ad) {
									n.parentElement.removeChild(n);
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

