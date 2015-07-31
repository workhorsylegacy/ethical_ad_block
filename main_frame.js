// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (msg.action === 'log') {
		console.log(msg.data);
	}
});

