// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"os"
	"path"
	"io/ioutil"
	"encoding/binary"
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

	return self
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
		value_bytes, error := ioutil.ReadFile(data_dir)
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
	data_dir := path.Join(self.data_dir, key)
	if IsFile(data_dir) {
		error := os.Remove(data_dir)
		if error != nil {
			panic(error)
		}
	}
}

func (self *FileBackedMap) Len() int {
	return self.LRUCache.Len()
}

