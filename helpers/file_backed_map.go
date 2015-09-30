// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"os"
	"fmt"
	"path/filepath"
	"path"
	"io/ioutil"
	"encoding/binary"
	"container/list"
)

// FIXME: Move this to a goroutine, so we don't have to wait for the FS to block
func saveEntryToFile(external_self interface{}, key string, value uint64) {
	self := external_self.(*FileBackedMap)

	// Convert the value to bytes
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, value)

	// Write the bytes to file, with the file name as the key name
	data_dir := path.Join(self.data_dir, key)
	ioutil.WriteFile(data_dir, b, 0644)
}

type FileBackedMap struct {
	*LRUCache
	data_dir string
}

func NewFileBackedMap(data_dir string, max_length int) *FileBackedMap {
	self := new(FileBackedMap)
	self.LRUCache = NewLRUCache(max_length)
	self.LRUCache.on_evict_cb = saveEntryToFile
	self.LRUCache.external_self = self
	self.data_dir = data_dir

	// Create the data directory if it does not exist
	if ! IsDir(self.data_dir) {
		os.Mkdir(self.data_dir, 0644)
	}

	// Load the recent most entries
	self.LoadFromDisk()

	return self
}

func (self *FileBackedMap) LoadFromDisk() {
	// Reset the cache
	self.LRUCache.expiration_list = list.New()
	self.LRUCache.cache = make(map[string]*list.Element)
	remaining_length := self.LRUCache.max_length

	// Walk the FS and look at each file
	err := filepath.Walk(self.data_dir, func(file_path string, finfo os.FileInfo, err error) error {
		// Stop adding entries if we are out of space
		if remaining_length <= 0 {
			return nil
		}

		// Skip if not a valid file
		if err != nil || finfo.IsDir() || len(finfo.Name()) == 0 {
			return nil
		}

		// Read the file into bytes, skip on failure
		value_bytes, err := ioutil.ReadFile(file_path)
		if err != nil {
			return nil
		}

		// Save the entry in the cache
		fmt.Printf("path : %v\n", file_path)
		key := path.Base(file_path)
		value := binary.LittleEndian.Uint64(value_bytes)
		self.Set(key, value)
		remaining_length--
		return nil
	})
	if err != nil {
		panic(err)
	}
}

func (self *FileBackedMap) SaveToDisk() {
	list := self.LRUCache.expiration_list
	var key string
	var value uint64
	var entry *CacheEntry

	// Dump the cache to FS
	for node := list.Back(); node != nil; node = node.Prev() {
		entry = node.Value.(*CacheEntry)
		key = entry.Key
		value = entry.Value
		fmt.Printf("%v : %v\n", key, value)
		saveEntryToFile(self, key, value)
	}
}

func (self *FileBackedMap) Set(key string, value uint64) {
	self.LRUCache.Set(key, value)
}

func (self *FileBackedMap) HasKey(key string) (bool) {
	data_dir := path.Join(self.data_dir, key)
	return self.LRUCache.HasKey(key) || IsFile(data_dir)
}

func (self *FileBackedMap) Get(key string) (uint64, bool) {
	// If the key is already in the cache, return the value
	if value, ok := self.LRUCache.Get(key); ok {
		return value, ok
	}

	// If the key is in the FS, read the value from the FS
	data_dir := path.Join(self.data_dir, key)
	if IsFile(data_dir) {
		value_bytes, err := ioutil.ReadFile(data_dir)
		if err != nil {
			panic(err)
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
	data_dir := path.Join(self.data_dir, key)
	if IsFile(data_dir) {
		err := os.Remove(data_dir)
		if err != nil {
			panic(err)
		}
	}
}

func (self *FileBackedMap) Len() int {
	return self.LRUCache.Len()
}

