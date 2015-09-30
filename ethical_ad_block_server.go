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
	"ethical_ad_block/helpers"
)

const (
	AD_GOOD = 0
	AD_FRAUDULENT = 1
	AD_TAXING = 2
	AD_MALICIOUS = 3
)

type AdData struct {
	good *helpers.FileBackedMap
	fraudulent *helpers.FileBackedMap
	taxing *helpers.FileBackedMap
	malicious *helpers.FileBackedMap
}

func NewAdData() *AdData {
	self := new(AdData)
	self.good = helpers.NewFileBackedMap("data_good", 1024)
	self.fraudulent = helpers.NewFileBackedMap("data_fraudulent", 1024)
	self.taxing = helpers.NewFileBackedMap("data_taxing", 1024)
	self.malicious = helpers.NewFileBackedMap("data_malicious", 1024)
	return self
}

var g_user_ads map[string]*helpers.FileBackedMap
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
	// Write all data to disk
	} else if hasKey(values, "save") {
		responseSave(w, values)
	// Unexpected request
	} else {
		http.Error(w, "Unexpected request", http.StatusBadRequest)
	}
}

func responseClear(w http.ResponseWriter, values map[string][]string) {
	// Clear the overall votes
	g_all_ads.good.RemoveAll()
	g_all_ads.fraudulent.RemoveAll()
	g_all_ads.taxing.RemoveAll()
	g_all_ads.malicious.RemoveAll()

	// Clear the user votes
	for _, user_ads := range g_user_ads {
		user_ads.RemoveAll()
	}

	fmt.Fprintf(w, "All data cleared\n")
}

func responseIsAd(w http.ResponseWriter, values map[string][]string) {
	// Get the arguments
	ad_id := values["is_ad"][0]

	// Get the number of times this ad is counted as good and bad
	good_count, _ := g_all_ads.good.Get(ad_id)
	fraudulent_count, _ := g_all_ads.fraudulent.Get(ad_id)
	taxing_count, _ := g_all_ads.taxing.Get(ad_id)
	malicious_count, _ := g_all_ads.malicious.Get(ad_id)
	bad_count := helpers.Larger(fraudulent_count, taxing_count, malicious_count)

	// Figure out if this is an ad
	is_ad := bad_count > good_count

	fmt.Fprintf(w, "%t\n", is_ad)
}

func responseVoteForAd(w http.ResponseWriter, values map[string][]string) {
	// Get the arguments
	ad_id := values["vote_ad"][0]
	ad_type := values["ad_type"][0]
	user_id := values["user_id"][0]

	// Figure out which type of vote it will be
	var all_ads *helpers.FileBackedMap
	var user_vote_type uint64
	switch ad_type {
		case "good":
			all_ads = g_all_ads.good
			user_vote_type = AD_GOOD
		case "fraudulent":
			all_ads = g_all_ads.fraudulent
			user_vote_type = AD_FRAUDULENT
		case "taxing":
			all_ads = g_all_ads.taxing
			user_vote_type = AD_TAXING
		case "malicious":
			all_ads = g_all_ads.malicious
			user_vote_type = AD_MALICIOUS
		default:
			http.Error(w, "Invalid ad_type", http.StatusBadRequest)
			return
	}

	// Initialize space for this user's ads
	user_ads, ok := g_user_ads[user_id]
	if ! ok {
		user_ads = helpers.NewFileBackedMap("user_" + user_id, 1024)
		g_user_ads[user_id] = user_ads
	}

	// Remove the previous vote, if there already is one for this ad
	if vote_type, ok := user_ads.Get(ad_id); ok {
		user_ads.Remove(ad_id)
		switch vote_type {
			case AD_GOOD:
				g_all_ads.good.Decrement(ad_id)
			case AD_FRAUDULENT:
				g_all_ads.fraudulent.Decrement(ad_id)
			case AD_TAXING:
				g_all_ads.taxing.Decrement(ad_id)
			case AD_MALICIOUS:
				g_all_ads.malicious.Decrement(ad_id)
		}
	}

	// Cast the vote
	votes := all_ads.Increment(ad_id)
	user_ads.Set(ad_id, user_vote_type)

	// Save the time that the user voted
	g_user_ids[user_id] = time.Now()

	// Return the response
	fmt.Fprintf(w, "ad_id:%s, ad_type:%s, votes:%d\n", ad_id, ad_type, votes)
}

func responseListAds(w http.ResponseWriter, values map[string][]string) {
	// Print the values of all the ad maps
	fmt.Fprintf(w, "good:\n")
	g_all_ads.good.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "fraudulent:\n")
	g_all_ads.fraudulent.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "taxing:\n")
	g_all_ads.taxing.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "malicious:\n")
	g_all_ads.malicious.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})
}

func responseShowMemory(w http.ResponseWriter, values map[string][]string) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	fmt.Fprintf(w, "mem.Alloc: %d\n", mem.Alloc)
	fmt.Fprintf(w, "mem.TotalAlloc: %d\n", mem.TotalAlloc)
	fmt.Fprintf(w, "mem.HeapAlloc: %d\n", mem.HeapAlloc)
	fmt.Fprintf(w, "mem.HeapSys: %d\n", mem.HeapSys)
}

func responseSave(w http.ResponseWriter, values map[string][]string) {
	// Write the overall votes to disk
	g_all_ads.good.SaveToDisk()
	g_all_ads.fraudulent.SaveToDisk()
	g_all_ads.taxing.SaveToDisk()
	g_all_ads.malicious.SaveToDisk()

	// Write the user votes to disk
	for _, user_ads := range g_user_ads {
		user_ads.SaveToDisk()
	}

	fmt.Fprintf(w, "All data saved\n")
}

func main() {
	// Initialize all the maps
	g_user_ads = make(map[string]*helpers.FileBackedMap)
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
