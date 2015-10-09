// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"os"
	"path/filepath"
	"path"
	"io/ioutil"
	"encoding/binary"
	"container/list"
)

// FIXME: What should we do when writing to file fails?
func saveEntryToFile(external_self interface{}, key string, value uint64) {
	self := external_self.(*FileBackedMap)

	// Convert the value to bytes
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, value)

	// Write the bytes to file, with the file name as the key name
	data_dir := path.Join(self.data_dir, key)
	err := ioutil.WriteFile(data_dir, b, 0644)
	if err != nil {
		panic(err)
	}
}

type FileBackedMap struct {
	*LRUCache
	data_dir string
}

// FIXME: What should we do when making the dir fails
func NewFileBackedMap(data_dir string, max_length int) *FileBackedMap {
	self := new(FileBackedMap)
	self.LRUCache = NewLRUCache(max_length)
	self.LRUCache.on_evict_cb = saveEntryToFile
	self.LRUCache.external_self = self
	self.data_dir = path.Join("data", data_dir)

	// Create the data directory if it does not exist
	if ! IsDir(self.data_dir) {
		err := os.Mkdir(self.data_dir, 0644)
		if err != nil {
			panic(err)
		}
	}

	// Load the recent most entries
	self.LoadFromDisk()

	return self
}

func (self *FileBackedMap) LoadFromDisk() {
	// Reset the cache
	self.LRUCache.expiration_list.Init()
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
		key := filepath.Base(file_path)
		value := binary.LittleEndian.Uint64(value_bytes)
		self.Set(key, value)
		remaining_length--
		return nil
	})
	if err != nil {
		panic(err)
	}
}

// FIXME: Update this to only overwrite if the value is different. This way the oldest stuff will have the oldest modify dates.
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
		saveEntryToFile(self, key, value)
	}
}

func (self *FileBackedMap) HasKey(key string) (bool) {
	data_dir := path.Join(self.data_dir, key)
	return self.LRUCache.HasKey(key) || IsFile(data_dir)
}

func (self *FileBackedMap) Set(key string, value uint64) {
	self.LRUCache.Set(key, value)
}

// FIXME: What should we do when reading the file fails?
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

func (self *FileBackedMap) Increment(key string) uint64 {
	return self.LRUCache.Increment(key)
}

func (self *FileBackedMap) Decrement(key string) uint64 {
	return self.LRUCache.Decrement(key)
}

// FIXME: What should we do when removing the file fails?
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

func (self *FileBackedMap) RemoveAll() {
	// Delete and recreate the data dir
	if IsDir(self.data_dir) {
		os.RemoveAll(self.data_dir)
	}
	os.Mkdir(self.data_dir, 0644)

	// Remove all the data in memory
	self.LRUCache.RemoveAll()
}

func (self *FileBackedMap) Each(cb func(key string, value uint64)) {
	self.LRUCache.Each(cb)
}

func (self *FileBackedMap) Len() int {
	return self.LRUCache.Len()
}

