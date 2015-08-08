// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later

package main

import (
	"fmt"
	"os"
	"log"
	"strconv"
	"time"
	"net/http"
)

var hashes_good map[string]uint64
var hashes_fraudulent map[string]uint64
var hashes_taxing map[string]uint64
var hashes_malicious map[string]uint64
var user_ids map[string]time.Time

func httpCB(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()

	// Vote for ad request
	if _, ok := values["vote_ad"]; ok {
		hash := values["vote_ad"][0]
		ad_type := values["ad_type"][0]
		user_id := values["user_id"][0]
		var votes uint64 = 0

		// Save the time that the user voted
		user_ids[user_id] = time.Now()

		switch ad_type {
			case "good":
				hashes_good[hash] += 1
				votes = hashes_good[hash]
			case "fraudulent":
				hashes_fraudulent[hash] += 1
				votes = hashes_fraudulent[hash]
			case "taxing":
				hashes_taxing[hash] += 1
				votes = hashes_taxing[hash]
			case "malicious":
				hashes_malicious[hash] += 1
				votes = hashes_malicious[hash]
		}
		fmt.Fprintf(w, "hash:%s, ad_type:%s, votes:%d\n", hash, ad_type, votes)

	// List ads request
	} else if _, ok := values["list"]; ok {
		fmt.Fprintf(w, "hashes_good:\n")
		for hash, votes := range hashes_good {
			fmt.Fprintf(w, "    %s : %d\n", hash, votes)
		}

		fmt.Fprintf(w, "hashes_fraudulent:\n")
		for hash, votes := range hashes_fraudulent {
			fmt.Fprintf(w, "    %s : %d\n", hash, votes)
		}

		fmt.Fprintf(w, "hashes_taxing:\n")
		for hash, votes := range hashes_taxing {
			fmt.Fprintf(w, "    %s : %d\n", hash, votes)
		}

		fmt.Fprintf(w, "hashes_malicious:\n")
		for hash, votes := range hashes_malicious {
			fmt.Fprintf(w, "    %s : %d\n", hash, votes)
		}

	// Unexpected request
	} else {
		fmt.Fprintf(w, "Unexpected request")
	}
}

func main() {
	hashes_good = make(map[string]uint64)
	hashes_fraudulent = make(map[string]uint64)
	hashes_taxing = make(map[string]uint64)
	hashes_malicious = make(map[string]uint64)
	user_ids = make(map[string]time.Time)

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
