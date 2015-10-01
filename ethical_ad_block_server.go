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
	AD_UNKNOWN = 0
	AD_GOOD = 1
	AD_FRAUDULENT = 2
	AD_TAXING = 3
	AD_MALICIOUS = 4
)

type AdData struct {
	votes_good *helpers.FileBackedMap
	votes_fraudulent *helpers.FileBackedMap
	votes_taxing *helpers.FileBackedMap
	votes_malicious *helpers.FileBackedMap
	voted_ad_type *helpers.FileBackedMap
}

func NewAdData() *AdData {
	self := new(AdData)
	self.votes_good = helpers.NewFileBackedMap("votes_good", 1024)
	self.votes_fraudulent = helpers.NewFileBackedMap("votes_fraudulent", 1024)
	self.votes_taxing = helpers.NewFileBackedMap("votes_taxing", 1024)
	self.votes_malicious = helpers.NewFileBackedMap("votes_malicious", 1024)
	self.voted_ad_type = helpers.NewFileBackedMap("voted_ad_type", 1048576)
	return self
}

var g_user_ads map[string]*helpers.FileBackedMap
var g_all_ads *AdData
var g_user_ids map[string]time.Time

func hasParameter(self map[string][]string, key string) bool {
	value, ok := self[key]
	return ok && value != nil && len(value) > 0 && value[0] != "null"
}

func isAlphaNumeric(value string) bool {
	for _, n := range value {
		if n >= '0' && n <= '9' || n >= 'a' && n <= 'z' || n >= 'A' && n <= 'Z' {
			
		} else {
			return false
		}
	}

	return true
}

func validateParameters(parameters map[string][]string, keys... string) (map[string]string, bool) {
	var validated_parameters map[string]string
	for _, key := range keys {
		if value, ok := parameters[key]; ok {
			if value != nil && len(value) > 0 && value[0] != "null" && isAlphaNumeric(value[0]) {
				validated_parameters[key] = value[0]
			} else {
				return nil, false
			}
		} else {
			return nil, false
		}
	}

	return validated_parameters, true
}

func httpCB(w http.ResponseWriter, r *http.Request) {
	parameters := r.URL.Query()

	// Set the server headers
	epoch := "Thu, 01 Jan 1970 00:00:00 UTC"
	header := w.Header()
	header.Set("Server", "Ethical Ad Block Server 0.1")
	header.Set("Pragma", "no-cache")
	header.Set("Cache-Control", "no-store, no-cache, must-revalidate, post-check=0, pre-check=0")
	header.Set("Expires", "0")
	header.Set("Last-Modified", epoch)
	header.Set("If-Modified-Since", epoch)

	// FIXME: Validate the HTTP method too
	//  Check which type the ad is
	if hasParameter(parameters, "voted_ad_type") {
		if v, ok := validateParameters(parameters, "voted_ad_type"); ok {
			responseVotedAdType(w, v)
		} else {
			http.Error(w, "Invalid parameters", 422)
		}
	// Vote for ad
	} else if hasParameter(parameters, "vote_ad") && hasParameter(parameters, "ad_type") && hasParameter(parameters, "user_id") {
		if v, ok := validateParameters(parameters, "vote_ad", "ad_type", "user_id"); ok {
			responseVoteForAd(w, v)
		} else {
			http.Error(w, "Invalid parameters", 422)
		}
	// List ads
	} else if hasParameter(parameters, "list") {
		responseListAds(w)
	// Show memory
	} else if hasParameter(parameters, "memory") {
		responseShowMemory(w)
	// Clear all data
	} else if hasParameter(parameters, "clear") {
		responseClear(w)
	// Write all data to disk
	} else if hasParameter(parameters, "save") {
		responseSave(w)
	// Unexpected request
	} else {
		http.Error(w, "Unexpected request", http.StatusBadRequest)
	}
}

func responseClear(w http.ResponseWriter) {
	// Clear the overall votes
	g_all_ads.votes_good.RemoveAll()
	g_all_ads.votes_fraudulent.RemoveAll()
	g_all_ads.votes_taxing.RemoveAll()
	g_all_ads.votes_malicious.RemoveAll()
	g_all_ads.voted_ad_type.RemoveAll()

	// Clear the user votes
	for _, user_ads := range g_user_ads {
		user_ads.RemoveAll()
	}

	fmt.Fprintf(w, "All data cleared\n")
}

func responseVotedAdType(w http.ResponseWriter, parameters map[string]string) {
	// Get the arguments
	ad_id := parameters["voted_ad_type"]

	// Get the voted ad type
	voted_ad_type, _ := g_all_ads.voted_ad_type.Get(ad_id)

	fmt.Fprintf(w, "%d\n", voted_ad_type)
}

func responseVoteForAd(w http.ResponseWriter, parameters map[string]string) {
	// Get the arguments
	ad_id := parameters["vote_ad"]
	ad_type := parameters["ad_type"]
	user_id := parameters["user_id"]

	// Figure out which type of vote it will be
	var all_ads *helpers.FileBackedMap
	var user_vote_type uint64 = AD_UNKNOWN
	switch ad_type {
		case "good":
			all_ads = g_all_ads.votes_good
			user_vote_type = AD_GOOD
		case "fraudulent":
			all_ads = g_all_ads.votes_fraudulent
			user_vote_type = AD_FRAUDULENT
		case "taxing":
			all_ads = g_all_ads.votes_taxing
			user_vote_type = AD_TAXING
		case "malicious":
			all_ads = g_all_ads.votes_malicious
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
				g_all_ads.votes_good.Decrement(ad_id)
			case AD_FRAUDULENT:
				g_all_ads.votes_fraudulent.Decrement(ad_id)
			case AD_TAXING:
				g_all_ads.votes_taxing.Decrement(ad_id)
			case AD_MALICIOUS:
				g_all_ads.votes_malicious.Decrement(ad_id)
		}
	}

	// Cast the new vote
	votes := all_ads.Increment(ad_id)
	user_ads.Set(ad_id, user_vote_type)

	// Update the voted ad type
	updateVotedAdType(ad_id)

	// Save the time that the user voted
	g_user_ids[user_id] = time.Now()

	// Return the response
	fmt.Fprintf(w, "ad_id:%s, ad_type:%s, votes:%d\n", ad_id, ad_type, votes)
}

func responseListAds(w http.ResponseWriter) {
	// Print the values of all the ad maps
	fmt.Fprintf(w, "good:\n")
	g_all_ads.votes_good.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "fraudulent:\n")
	g_all_ads.votes_fraudulent.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "votes_taxing:\n")
	g_all_ads.votes_taxing.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "malicious:\n")
	g_all_ads.votes_malicious.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})

	fmt.Fprintf(w, "voted_ad_type:\n")
	g_all_ads.voted_ad_type.Each(func(ad_id string, votes uint64) {
		fmt.Fprintf(w, "    %s : %d\n", ad_id, votes)
	})
}

func responseShowMemory(w http.ResponseWriter) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	fmt.Fprintf(w, "mem.Alloc: %d\n", mem.Alloc)
	fmt.Fprintf(w, "mem.TotalAlloc: %d\n", mem.TotalAlloc)
	fmt.Fprintf(w, "mem.HeapAlloc: %d\n", mem.HeapAlloc)
	fmt.Fprintf(w, "mem.HeapSys: %d\n", mem.HeapSys)
}

func responseSave(w http.ResponseWriter) {
	// Write the overall votes to disk
	g_all_ads.votes_good.SaveToDisk()
	g_all_ads.votes_fraudulent.SaveToDisk()
	g_all_ads.votes_taxing.SaveToDisk()
	g_all_ads.votes_malicious.SaveToDisk()
	g_all_ads.voted_ad_type.SaveToDisk()

	// Write the user votes to disk
	for _, user_ads := range g_user_ads {
		user_ads.SaveToDisk()
	}

	fmt.Fprintf(w, "All data saved\n")
}

func updateVotedAdType(ad_id string) {
	// Get the number of times this ad is counted for each category
	good_count, _ := g_all_ads.votes_good.Get(ad_id)
	fraudulent_count, _ := g_all_ads.votes_fraudulent.Get(ad_id)
	taxing_count, _ := g_all_ads.votes_taxing.Get(ad_id)
	malicious_count, _ := g_all_ads.votes_malicious.Get(ad_id)
	largest_count := helpers.Larger(good_count, fraudulent_count, taxing_count, malicious_count)

	// Figure out the top type of votes
	var ad_type uint64
	if largest_count == 0 {
		ad_type = AD_UNKNOWN
	} else if good_count >= largest_count {
		ad_type = AD_GOOD
	} else if fraudulent_count >= largest_count {
		ad_type = AD_FRAUDULENT
	} else if taxing_count >= largest_count {
		ad_type = AD_TAXING
	} else if malicious_count >= largest_count {
		ad_type = AD_MALICIOUS
	}

	// Save the top ad type in the cache
	g_all_ads.voted_ad_type.Set(ad_id, ad_type)
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
