// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


function generateRandomId() {
	// Get a 20 character id
	var code_table = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	var id = [];
	for (var i=0; i<20; ++i) {
		// Get a random number between 0 and 35
		var num = Math.floor((Math.random() * 36));

		// Get the character that corresponds to the number
		id.push(code_table[num]);
	}

	return id.join('');
}

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

function isDataURI(src) {
	return src && src.startsWith('data:');
}

function blobToDataURI(blob, cb) {
	var a = new FileReader();
	a.onload = function(e) {
		cb(e.target.result);
	};
	a.readAsDataURL(blob);
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

function httpGetBlob(request, success_cb, fail_cb) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				var response_bytes = xhr.response;
				var total_len = getResponseHeaderContentLength(xhr);
				success_cb(request, response_bytes, total_len);
			} else {
				if (fail_cb) fail_cb(xhr.status);
			}
		} else if (xhr.readyState === 0) {
			if (fail_cb) fail_cb(0);
		}
	};
	xhr.onerror = function() {
		if (fail_cb) fail_cb(0);
	};
	xhr.open('GET', request, true);
	xhr.timeout = 3000;
	xhr.responseType = 'blob';
	xhr.send(null);
}

function httpGetBlobChunk(request, success_cb, fail_cb, max_len) {
	var total_len = 0;
	var data = null;
	var xhr = new XMLHttpRequest();
	xhr.onprogress = function(e) {
		if (xhr.status !== 200) {
			if (fail_cb) fail_cb(0);
			success_cb = null;
			fail_cb = null;
			xhr.abort();
		} else {
			var cur_len = 0;
			if (xhr.response) {
				cur_len = getResponseHeaderContentLength(xhr);
			}
			total_len += cur_len;
			if (data === null) {
				data = xhr.response;
			} else if (xhr.response) {
				data.append(xhr.response);
			}
			if (total_len >= max_len) {
				data = data.slice(0, max_len);
			}
			if (xhr.readyState === 4 || total_len >= max_len) {
				var content_length = getResponseHeaderContentLength(xhr);
				if (success_cb) success_cb(request, data, content_length);
				success_cb = null;
				fail_cb = null;
				xhr.abort();
			}
		}
	};
	xhr.onerror = function() {
		if (fail_cb) fail_cb(0);
		success_cb = null;
		fail_cb = null;
	};
	xhr.open('GET', request, true);
	xhr.timeout = 3000;
	xhr.responseType = 'blob';
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
				if (fail_cb) fail_cb(xhr.status);
			}
		} else if (xhr.readyState === 0) {
			if (fail_cb) fail_cb(0);
		}
	};
	xhr.onerror = function() {
		if (fail_cb) fail_cb(0);
	};
	xhr.open('GET', request, true);
	xhr.timeout = 3000;
	xhr.send(null);
}

function httpGetBlobAsDataURI(src, cb) {
	// If the source is already a Data URI, just fire the callback
	if (isDataURI(src)) {
		cb(src, src);
	// Otherwise download the source, convert it to a Data URI, and fire the callback
	} else {
		httpGetBlob(src, function(original_src, data, total_size) {
			blobToDataURI(data, function(data_uri) {
				cb(original_src, data_uri);
			});
		});
	}
}
