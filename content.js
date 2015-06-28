// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


window.onload = function() {
	var canvases = [];

	setInterval(function() {
		// Remove old canvases
		for(var i=0; i<canvases.length; ++i) {
			var canvas = canvases[i];
			document.body.removeChild(canvas);
		}
		canvases = [];

		// Add a new canvas over each image
		var elements = document.getElementsByTagName("img");
		for(var i=0; i<elements.length; ++i) {
			var element = elements[i];
			//element.style.display = 'none';
			var rect = element.getBoundingClientRect();

			// Create a canvas
			var canvas = document.createElement('canvas');
			canvas.style.width = rect.width + 'px';
			canvas.style.height = rect.height + 'px';
			canvas.style.position = 'absolute';
			canvas.style.left = rect.left + window.pageXOffset + 'px';
			canvas.style.top = rect.top + window.pageYOffset + 'px';
			canvas.style.zIndex = 100000;
			canvas.style.pointerEvents = 'none';
			document.body.appendChild(canvas);

			//Draw rectangle
			var context = canvas.getContext('2d');
			context.rect(0, 0, 300, 300);
			context.fillStyle = 'yellow';
			context.fill();
			canvases.push(canvas);
		}
	}, 5000);
};
