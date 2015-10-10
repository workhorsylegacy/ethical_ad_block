// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"math"
	"container/list"
)


type LRUCache struct {
	// FIXME: Rename to max_len
	max_length int
	expiration_list *list.List
	cache map[string]*list.Element
	on_evict_cb func(external_self interface{}, key string, value uint64) (error)
	external_self interface{}
}

type CacheEntry struct {
	Key string
	Value uint64
}

func NewLRUCache(max_length int) *LRUCache {
	// Make sure the args are valid
	if max_length < 1 {
		panic("Cannot have a max_length less than 1.")
	}

	self := new(LRUCache)
	self.max_length = max_length
	self.expiration_list = list.New()
	self.cache = make(map[string]*list.Element)
	return self
}

func (self *LRUCache) HasKey(key string) (bool) {
	_, ok := self.cache[key]
	return ok
}

func (self *LRUCache) Set(key string, value uint64) {
	// If the key is already used, update the value
	if element, ok := self.cache[key]; ok {
		self.expiration_list.MoveToFront(element)
		element.Value.(*CacheEntry).Value = value
		return
	}

	// If the size will be greater than the max, remove the oldest element
	if self.expiration_list.Len() + 1 > self.max_length {
		element := self.expiration_list.Back()
		if element != nil {
			self.evictElement(element)
		}
	}

	// If the key is new, add the new entry
	entry := CacheEntry{key, value}
	element := self.expiration_list.PushFront(&entry)
	self.cache[key] = element
}

func (self *LRUCache) Get(key string) (uint64, bool) {
	// If it has the key, return the value
	if element, ok := self.cache[key]; ok {
		self.expiration_list.MoveToFront(element)
		return element.Value.(*CacheEntry).Value, true
	}

	// Otherwise return false
	return 0, false
}

func (self *LRUCache) Increment(key string) uint64 {
	value, _ := self.Get(key)
	if value < math.MaxUint64 {
		value++
		self.Set(key, value)
	}

	return value
}

func (self *LRUCache) Decrement(key string) uint64 {
	value, _ := self.Get(key)
	if value > 0 {
		value--
		self.Set(key, value)
	}

	return value
}

func (self *LRUCache) Remove(key string) (error) {
	if element, ok := self.cache[key]; ok {
		err := self.evictElement(element)
		if err != nil {
			return err
		}
	}

	return nil
}

func (self *LRUCache) RemoveAll() {
	self.expiration_list.Init()
	self.cache = make(map[string]*list.Element)
}

func (self *LRUCache) evictElement(element *list.Element) (error) {
	// Remove the element from the expiration list
	self.expiration_list.Remove(element)

	// Remove the item from the cache
	entry := element.Value.(*CacheEntry)
	delete(self.cache, entry.Key)

	// Fire the on evict callback
	if self.on_evict_cb != nil && self.external_self != nil {
		err := self.on_evict_cb(self.external_self, entry.Key, entry.Value)
		if err != nil {
			return err
		}
	}

	return nil
}

func (self *LRUCache) Each(cb func(key string, value uint64)) {
	for k, v := range self.cache {
		cb(k, v.Value.(*CacheEntry).Value)
	}
}

func (self *LRUCache) Len() int {
	return self.expiration_list.Len()
}

func (self *LRUCache) MaxLen() int {
	return self.max_length
}

