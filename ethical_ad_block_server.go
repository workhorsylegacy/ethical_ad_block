// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

var ads_good map[string]uint64
var ads_fraudulent map[string]uint64
var ads_taxing map[string]uint64
var ads_malicious map[string]uint64
var user_ids map[string]time.Time

func httpCB(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()

	// Vote for ad request
	if _, ok := values["vote_ad"]; ok {
		// FIXME: This will break if these arguments are not present
		// Get the arguments
		ad_id := values["vote_ad"][0]
		ad_type := values["ad_type"][0]
		user_id := values["user_id"][0]

		// Figure out which type of vote it will be
		var ad_map *map[string]uint64
		switch ad_type {
			case "good": ad_map = &ads_good
			case "fraudulent": ad_map = &ads_fraudulent
			case "taxing": ad_map = &ads_taxing
			case "malicious": ad_map = &ads_malicious
			default:
				fmt.Fprintf(w, "Invalid ad_type\n")
				return
		}

		// Cast the vote
		(*ad_map)[ad_id] += 1
		votes := (*ad_map)[ad_id]

		// Save the time that the user voted
		user_ids[user_id] = time.Now()

		// Return the response
		fmt.Fprintf(w, "ad_id:%s, ad_type:%s, votes:%d\n", ad_id, ad_type, votes)

	// List ads request
	} else if _, ok := values["list"]; ok {
		// Print the values of all the ad maps
		fmt.Fprintf(w, "ads_good:\n")
		for ad_id, votes := range ads_good {
			fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
		}

		fmt.Fprintf(w, "ads_fraudulent:\n")
		for ad_id, votes := range ads_fraudulent {
			fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
		}

		fmt.Fprintf(w, "ads_taxing:\n")
		for ad_id, votes := range ads_taxing {
			fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
		}

		fmt.Fprintf(w, "ads_malicious:\n")
		for ad_id, votes := range ads_malicious {
			fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
		}

	// Unexpected request
	} else {
		fmt.Fprintf(w, "Unexpected request\n")
	}
}

func main() {
	// Initialize all the maps
	ads_good = make(map[string]uint64)
	ads_fraudulent = make(map[string]uint64)
	ads_taxing = make(map[string]uint64)
	ads_malicious = make(map[string]uint64)
	user_ids = make(map[string]time.Time)

	// Get the port number
	var err error
	var port int64 = 9000
	if len(os.Args) >= 1 {
		port, err = strconv.ParseInt(os.Args[1], 10, 0)
		if err != nil {
			log.Fatal(err)
		}
	}

	// Run the server
	server_address := fmt.Sprintf("127.0.0.1:%v", port)
	http.HandleFunc("/", httpCB)
	err = http.ListenAndServe(server_address, nil)
	if err != nil {
		log.Fatal(err)
	}
}
