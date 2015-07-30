// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later

package main

import (
	"fmt"
	"net/http"
)

var hashes map[string]uint64

func handler(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()

	// Vote for ad request
	if _, ok := values["vote_ad"]; ok {
		hash := values["vote_ad"][0]

		hashes[hash] += 1
		fmt.Fprintf(w, "%s : %d\n", hash, hashes[hash])

	// List ads request
	} else if _, ok := values["list"]; ok {
		for hash, votes := range hashes {
			fmt.Fprintf(w, "%s : %d\n", hash, votes)
		}

	// Unexpected request
	} else {
		fmt.Fprintf(w, "Unexpected request")
	}
}

func main() {
	hashes = make(map[string]uint64)

	http.HandleFunc("/", handler)
	http.ListenAndServe(":9000", nil)
}
