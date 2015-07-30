// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later

package main

import (
	"fmt"
	"os"
	"log"
	"strconv"
	"net/http"
)

var hashes map[string]uint64

func httpCB(w http.ResponseWriter, r *http.Request) {
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
		if len(hashes) == 0 {
			fmt.Fprintf(w, "none\n")
		}

	// Unexpected request
	} else {
		fmt.Fprintf(w, "Unexpected request")
	}
}

func main() {
	hashes = make(map[string]uint64)

	var err error
	var port int64 = 9000
	if len(os.Args) >= 1 {
		port, err = strconv.ParseInt(os.Args[1], 10, 0)
		if err != nil {
			log.Fatal(err)
		}
	}

	server_address := fmt.Sprintf("127.0.0.1:%v", port)
	http.HandleFunc("/", httpCB)
	err = http.ListenAndServe(server_address, nil)
	if err != nil {
		log.Fatal(err)
	}
}
