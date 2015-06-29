// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


var canvases = [];
var BUTTON_SIZE = 15;
var has_loaded = false;

function create_buttons() {
	// Remove old canvases
	for(var i=0; i<canvases.length; ++i) {
		var canvas = canvases[i];
		document.body.removeChild(canvas);
	}
	canvases = [];

	// Add a new button to the right bottom corner of each image
	var elements = document.getElementsByTagName("img");
	for(var i=0; i<elements.length; ++i) {
		var element = elements[i];
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
}

window.addEventListener('load', function() {
	create_buttons();

	setInterval(function() {
		create_buttons();
	}, 5000);

	has_loaded = true;
});

window.addEventListener('resize', function(event) {
	if (! has_loaded)
		return;

	create_buttons();
});

