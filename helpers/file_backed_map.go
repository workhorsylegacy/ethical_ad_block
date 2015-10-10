// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"errors"
	"os"
	"path/filepath"
	"io/ioutil"
	"encoding/binary"
	"container/list"
)

// FIXME: What should we do when writing to file fails?
func saveEntryToFile(external_self interface{}, key string, value uint64) (error) {
	self := external_self.(*FileBackedMap)

	// Convert the value to bytes
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, value)

	// Write the bytes to file, with the file name as the key name
	key_path := filepath.Join(self.FullPath(), key)
	err := ioutil.WriteFile(key_path, b, 0644)
	if err != nil {
		return err
	}

	return nil
}

type FileBackedMap struct {
	*LRUCache
	data_dir string
	data_name string
}

func NewFileBackedMap(data_name string, max_length int) (*FileBackedMap, error) {
	if data_name == "" {
		err := errors.New("Invalid dir name '" + data_name + "'.")
		return nil, err
	}

	if max_length < 1 {
		err := errors.New("The max length must be greater than zero.")
		return nil, err
	}

	self := new(FileBackedMap)
	self.LRUCache = NewLRUCache(max_length)
	self.LRUCache.on_evict_cb = saveEntryToFile
	self.LRUCache.external_self = self
	self.data_dir, _ = filepath.Abs("data")
	self.data_name = data_name

	// Create the data directory if it does not exist
	if ! IsDir(self.FullPath()) {
		err := os.MkdirAll(self.FullPath(), 0644)
		if err != nil {
			return nil, err
		}
	}

	// Load the recent most entries
	err := self.LoadFromDisk()
	if err != nil {
		return nil, err
	}

	return self, nil
}

func (self *FileBackedMap) LoadFromDisk() (error) {
	// Reset the cache
	self.LRUCache.expiration_list.Init()
	self.LRUCache.cache = make(map[string]*list.Element)
	remaining_length := self.LRUCache.max_length

	// Walk the FS and look at each file
	err := filepath.Walk(self.FullPath(), func(file_path string, finfo os.FileInfo, err error) error {
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
		return err
	}

	return nil
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
	key_path := filepath.Join(self.FullPath(), key)
	return self.LRUCache.HasKey(key) || IsFile(key_path)
}

func (self *FileBackedMap) Set(key string, value uint64) {
	self.LRUCache.Set(key, value)
}

func (self *FileBackedMap) Get(key string) (uint64, bool) {
	// If the key is already in the cache, return the value
	if value, ok := self.LRUCache.Get(key); ok {
		return value, ok
	}

	// If the key is in the FS, read the value from the FS
	key_path := filepath.Join(self.FullPath(), key)
	if IsFile(key_path) {
		value_bytes, err := ioutil.ReadFile(key_path)
		if err != nil {
			return 0, false
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

func (self *FileBackedMap) Remove(key string) (error) {
	// Remove the key from the FS
	key_path := filepath.Join(self.FullPath(), key)
	if IsFile(key_path) {
		err := os.Remove(key_path)
		if err != nil {
			return err
		}
	}

	// Remove the key from the cache
	err := self.LRUCache.Remove(key)
	if err != nil {
		return nil
	}

	return nil
}

// FIXME: What should we do when removing the directory or creating it fails?
func (self *FileBackedMap) RemoveAll() {
	// Delete and recreate the data dir
	if IsDir(self.FullPath()) {
		err := os.RemoveAll(self.FullPath())
		if err != nil {
			panic(err)
		}
	}
	err := os.Mkdir(self.FullPath(), 0644)
	if err != nil {
		panic(err)
	}

	// Fatal error if the directory does not exist
	if ! IsDir(self.FullPath()) {
		panic("Failed to create the directory: '" + self.FullPath() + "'.")
	}

	// Remove all the data in memory
	self.LRUCache.RemoveAll()
}

func (self *FileBackedMap) Each(cb func(key string, value uint64)) {
	self.LRUCache.Each(cb)
}

func (self *FileBackedMap) Len() int {
	return self.LRUCache.Len()
}

func (self *FileBackedMap) DataName() string {
	return self.data_name
}

func (self *FileBackedMap) FullPath() string {
	return filepath.Join(self.data_dir, self.data_name)
}
