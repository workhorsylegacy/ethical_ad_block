// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"os"
	"io/ioutil"
	"encoding/binary"
)

// FIXME: Move this to a goroutine, so we don't have to wait for the FS to block
func saveEntryToFile(key string, value uint64) {
	// Convert the value to bytes
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, value)

	// Write the bytes to file, with the file name as the key name
	ioutil.WriteFile("data/" + key, b, 0644)
}

type FileBackedMap struct {
	*LRUCache
}

func NewFileBackedMap(max_length int) *FileBackedMap {
	if ! IsDir("data") {
		os.Mkdir("data", 0644)
	}

	self := new(FileBackedMap)
	self.LRUCache = NewLRUCache(max_length)
	self.LRUCache.on_evict_cb = saveEntryToFile
	return self
}

func (self *FileBackedMap) Set(key string, value uint64) {
	self.LRUCache.Set(key, value)
}

func (self *FileBackedMap) HasKey(key string) (bool) {
	return self.LRUCache.HasKey(key) || IsFile("data/" + key)
}

func (self *FileBackedMap) Get(key string) (uint64, bool) {
	// If the key is already in the cache, return the value
	if value, ok := self.LRUCache.Get(key); ok {
		return value, ok
	}

	// If the key is in the FS, read the value from the FS
	if IsFile("data/" + key) {
		value_bytes, error := ioutil.ReadFile("data/" + key)
		if error != nil {
			panic(error)
		} else {
			value := binary.LittleEndian.Uint64(value_bytes)
			self.Set(key, value)
			return value, true
		}
	}

	return 0, false
}

func (self *FileBackedMap) Remove(key string) {
	// Remove the key from the cache
	self.LRUCache.Remove(key)

	// Remove the key from the FS
	if IsFile("data/" + key) {
		error := os.Remove("data/" + key)
		if error != nil {
			panic(error)
		}
	}
}

func (self *FileBackedMap) Len() int {
	return self.LRUCache.Len()
}

