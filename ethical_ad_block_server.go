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
	"runtime"
)

type AdData struct {
	good map[string]uint64
	fraudulent map[string]uint64
	taxing map[string]uint64
	malicious map[string]uint64
}

func NewAdData() *AdData {
	self := new(AdData)
	self.good = make(map[string]uint64)
	self.fraudulent = make(map[string]uint64)
	self.taxing = make(map[string]uint64)
	self.malicious = make(map[string]uint64)
	return self
}

var g_user_ads map[string]*AdData
var g_all_ads *AdData
var g_user_ids map[string]time.Time

func hasKey(self map[string][]string, key string) bool {
	value, ok := self[key]
	return ok && value != nil && len(value) > 0 && value[0] != "null"
}

func httpCB(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()

	// Set the server name
	w.Header().Set("Server", "Ethical Ad Block Server 0.1")

	//  Check if element is an ad
	if hasKey(values, "is_ad") {
		responseIsAd(w, values)
	// Vote for ad
	} else if hasKey(values, "vote_ad") && hasKey(values, "ad_type") && hasKey(values, "user_id") {
		responseVoteForAd(w, values)
	// List ads
	} else if hasKey(values, "list") {
		responseListAds(w, values)
	// Show memory
	} else if hasKey(values, "memory") {
		responseShowMemory(w, values)
	// Clear all data
	} else if hasKey(values, "clear") {
		responseClear(w, values)
	// Unexpected request
	} else {
		http.Error(w, "Unexpected request", http.StatusBadRequest)
	}
}

func responseClear(w http.ResponseWriter, values map[string][]string) {
	g_user_ads = make(map[string]*AdData)
	g_all_ads = NewAdData()
	g_user_ids = make(map[string]time.Time)

	fmt.Fprintf(w, "All data cleared\n")
}

func responseIsAd(w http.ResponseWriter, values map[string][]string) {
	// Get the arguments
	ad_id := values["is_ad"][0]

	// Get the number of times this ad is counted as good and bad
	var good_count uint64 = 0
	var bad_count uint64 = 0
	if count, ok := g_all_ads.good[ad_id]; ok && count > 0 {
		good_count = count
	} else if count, ok := g_all_ads.fraudulent[ad_id]; ok && count > 0 {
		bad_count = count
	} else if count, ok := g_all_ads.taxing[ad_id]; ok && count > 0 {
		bad_count = count
	} else if count, ok := g_all_ads.malicious[ad_id]; ok && count > 0 {
		bad_count = count
	}

	// Figure out if this is an ad
	is_ad := bad_count > good_count

	fmt.Fprintf(w, "%t\n", is_ad)
}

func responseVoteForAd(w http.ResponseWriter, values map[string][]string) {
	// Get the arguments
	ad_id := values["vote_ad"][0]
	ad_type := values["ad_type"][0]
	user_id := values["user_id"][0]

	// Initialize space for this user's ads
	if _, ok := g_user_ads[user_id]; ! ok {
		g_user_ads[user_id] = NewAdData()
	}

	// Remove the previous vote, if there already is one for this ad
	if _, ok := g_user_ads[user_id].good[ad_id]; ok {
		delete(g_user_ads[user_id].good, ad_id)
		g_all_ads.good[ad_id] -= 1
	} else if _, ok := g_user_ads[user_id].fraudulent[ad_id]; ok {
		delete(g_user_ads[user_id].fraudulent, ad_id)
		g_all_ads.fraudulent[ad_id] -= 1
	} else if _, ok := g_user_ads[user_id].taxing[ad_id]; ok {
		delete(g_user_ads[user_id].taxing, ad_id)
		g_all_ads.taxing[ad_id] -= 1
	} else if _, ok := g_user_ads[user_id].malicious[ad_id]; ok {
		delete(g_user_ads[user_id].malicious, ad_id)
		g_all_ads.malicious[ad_id] -= 1
	}

	// Figure out which type of vote it will be
	// FIXME: Move this before the removal of the previous vote
	var ad_map *map[string]uint64
	var ad_map_user *map[string]uint64
	switch ad_type {
		case "good":
			ad_map = &g_all_ads.good
			ad_map_user = &(g_user_ads[user_id].good)
		case "fraudulent":
			ad_map = &g_all_ads.fraudulent
			ad_map_user = &(g_user_ads[user_id].fraudulent)
		case "taxing":
			ad_map = &g_all_ads.taxing
			ad_map_user = &(g_user_ads[user_id].taxing)
		case "malicious":
			ad_map = &g_all_ads.malicious
			ad_map_user = &(g_user_ads[user_id].malicious)
		default:
			http.Error(w, "Invalid ad_type", http.StatusBadRequest)
			return
	}

	// Cast the vote
	(*ad_map)[ad_id] += 1
	(*ad_map_user)[ad_id] += 1
	votes := (*ad_map)[ad_id]
	user_votes := (*ad_map_user)[ad_id]

	// Save the time that the user voted
	g_user_ids[user_id] = time.Now()

	// Return the response
	fmt.Fprintf(w, "ad_id:%s, ad_type:%s, votes:%d, user_votes:%d\n", ad_id, ad_type, votes, user_votes)
}

func responseListAds(w http.ResponseWriter, values map[string][]string) {
	// Print the values of all the ad maps
	fmt.Fprintf(w, "good:\n")
	for ad_id, votes := range g_all_ads.good {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	}

	fmt.Fprintf(w, "fraudulent:\n")
	for ad_id, votes := range g_all_ads.fraudulent {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	}

	fmt.Fprintf(w, "taxing:\n")
	for ad_id, votes := range g_all_ads.taxing {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	}

	fmt.Fprintf(w, "malicious:\n")
	for ad_id, votes := range g_all_ads.malicious {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	}
}

func responseShowMemory(w http.ResponseWriter, values map[string][]string) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	fmt.Fprintf(w, "mem.Alloc: %d\n", mem.Alloc)
	fmt.Fprintf(w, "mem.TotalAlloc: %d\n", mem.TotalAlloc)
	fmt.Fprintf(w, "mem.HeapAlloc: %d\n", mem.HeapAlloc)
	fmt.Fprintf(w, "mem.HeapSys: %d\n", mem.HeapSys)
}

func main() {
	// Initialize all the maps
	g_user_ads = make(map[string]*AdData)
	g_all_ads = NewAdData()
	g_user_ids = make(map[string]time.Time)

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
