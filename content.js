// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


var canvases = [];
var BUTTON_SIZE = 15;
var has_loaded = false;

function create_button(element) {
	//element.style['border'] = '10px solid green';
	//element.style.display = 'none';
	var rect = element.getBoundingClientRect();

	// Create a canvas
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

	// Draw rectangle
	var context = canvas.getContext('2d');
	context.rect(0, 0, BUTTON_SIZE, BUTTON_SIZE);
	context.fillStyle = 'red';
	context.fill();
	canvases.push(canvas);

	canvas.addEventListener('click', function() {
		alert('clicked!');
	}, false);	
}

// FIXME: Instead of using this load event, just use the observer for all image loads
window.addEventListener('load', function() {
	has_loaded = true;

	// Remove old canvases
	for (var i=0; i<canvases.length; ++i) {
		var canvas = canvases[i];
		document.body.removeChild(canvas);
	}
	canvases = [];

	// Add a new button to the right bottom corner of each element
	var elements = document.getElementsByTagName("img");
	for (var i=0; i<elements.length; ++i) {
		var element = elements[i];
		create_button(element);
	}

	// When new images load, add a button to them too
	var observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			for (var i=0; i<mutation.addedNodes.length; ++i) {
				var node = mutation.addedNodes[i];

				// Skip if not a function
				if (typeof node.getElementsByTagName !== 'function') {
					return;
				}
	 
				// Look at each new image
				var imgs = node.getElementsByTagName('img');
				for (var j=0; j<imgs.length; ++j) {
					var img = imgs[i];
					//console.log(img);
					create_button(img);
				}
			}
		});
	});
	 
	observer.observe(document, {childList: true, subtree: true});
});


window.addEventListener('resize', function(event) {
	if (! has_loaded)
		return;

	// Remove old canvases
	for (var i=0; i<canvases.length; ++i) {
		var canvas = canvases[i];
		document.body.removeChild(canvas);
	}
	canvases = [];

	// Add a new button to the right bottom corner of each element
	var elements = document.getElementsByTagName("img");
	for (var i=0; i<elements.length; ++i) {
		var element = elements[i];
		create_button(element);
	}
});





