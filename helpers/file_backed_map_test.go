// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers


import (
	"os"
	"path/filepath"
	"io/ioutil"
	"log"
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

// Setting key fails when dir does not exist
// Setting key fails when file to write to is locked
// Getting key fails when file to read is locked

type TestSuite struct {
    suite.Suite
}

func (suite *TestSuite) SetupTest() {
	if IsDir("data") {
		err := os.RemoveAll("data")
		assert.Nil(suite.T(), err)
	}
	err := os.Mkdir("data", 0644)
	assert.Nil(suite.T(), err)
}

func (suite *TestSuite) TestNew() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Make sure the fields are correct
	assert.Equal(suite.T(), "test", fbm.DataName())
	assert.Equal(suite.T(), 0, fbm.Len())
	assert.Equal(suite.T(), 1, fbm.MaxLen())

	// Make sure the directory exists
	full_path, _ := filepath.Abs(filepath.Join("data", "test"))
	assert.Equal(suite.T(), full_path, fbm.FullPath())
	assert.True(suite.T(), IsDir(fbm.FullPath()))
}

func (suite *TestSuite) TestSet() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Write key "aaa" to FS
	err = fbm.Set("aaa", 8)
	assert.Nil(suite.T(), err)
	fbm.SaveToDisk()

	// Make sure the "data" dir and keys were created
	assert.True(suite.T(), IsDir(fbm.FullPath()))
	key_path := fbm.FullKeyPath("aaa")
	assert.True(suite.T(), IsFile(key_path))
}

func (suite *TestSuite) TestRemove() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Write key to FS
	err = fbm.Set("zzz", 8)
	assert.Nil(suite.T(), err)
	fbm.SaveToDisk()

	// Make sure the key is in the cache and FS
	assert.True(suite.T(), fbm.HasKey("zzz"))
	assert.True(suite.T(), IsFile(fbm.FullKeyPath("zzz")))

	// Remove the key and make sure it is gone from the cache and FS
	err = fbm.Remove("zzz")
	assert.Nil(suite.T(), err)
	assert.False(suite.T(), fbm.HasKey("zzz"))
	assert.False(suite.T(), IsFile(fbm.FullKeyPath("zzz")))
}

func (suite *TestSuite) TestRemoveAll() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Write keys to FS
	err = fbm.Set("aaa", 8)
	assert.Nil(suite.T(), err)
	err = fbm.Set("bbb", 7)
	assert.Nil(suite.T(), err)
	fbm.SaveToDisk()

	// Make sure the keys are in the cache and FS
	assert.True(suite.T(), fbm.HasKey("aaa"))
	assert.True(suite.T(), fbm.HasKey("bbb"))
	assert.True(suite.T(), IsFile(fbm.FullKeyPath("aaa")))
	assert.True(suite.T(), IsFile(fbm.FullKeyPath("bbb")))

	// Remove the keys and make sure they are gone from the cache and FS
	err = fbm.RemoveAll()
	assert.Nil(suite.T(), err)
	assert.False(suite.T(), fbm.HasKey("aaa"))
	assert.False(suite.T(), fbm.HasKey("bbb"))
	assert.False(suite.T(), IsFile(fbm.FullKeyPath("aaa")))
	assert.False(suite.T(), IsFile(fbm.FullKeyPath("bbb")))
}

func (suite *TestSuite) TestDataDirRecreatedOnNew() {
	// Remove the "data" directory
	err := os.RemoveAll("data")
	assert.Nil(suite.T(), err)
	assert.False(suite.T(), IsDir("data"))

	// Make sure it recreated the "data" dir
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)
	assert.True(suite.T(), IsDir("data"))
}

func (suite *TestSuite) TestDataDirRecreatedOnWrite() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Remove the "data" dir
	err = os.RemoveAll("data")
	assert.Nil(suite.T(), err)

	// Write key "aaa" to FS
	err = fbm.Set("aaa", 8)
	assert.Nil(suite.T(), err)
	fbm.SaveToDisk()

	// Make sure the "data" dir and keys were recreated
	assert.True(suite.T(), IsDir(fbm.FullPath()))
	key_path := fbm.FullKeyPath("aaa")
	assert.True(suite.T(), IsFile(key_path))
}

func (suite *TestSuite) TestFailWithInvalidDirName() {
	fbm, err := NewFileBackedMap("", 1)
	assert.NotNil(suite.T(), err)
	assert.Nil(suite.T(), fbm)
}

func (suite *TestSuite) TestFailWithInvalidSize() {
	fbm, err := NewFileBackedMap("test", 0)
	assert.NotNil(suite.T(), err)
	assert.Nil(suite.T(), fbm)
}

func (suite *TestSuite) TestFailOnReadGarbage() {
	// Create the map
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)

	// Write "garbage" to the "zzz" key
	key_path := fbm.FullKeyPath("zzz")
	err = ioutil.WriteFile(key_path, []byte("garbage"), 0644)
	assert.Nil(suite.T(), err)

	// Try to read "garbage" from the "zzz" key
	// It should show up as no key
	value, ok := fbm.Get("zzz")
	assert.False(suite.T(), ok)
	assert.Equal(suite.T(), uint64(0), value)

	// Make sure the "zzz" key has been removed from the FS
	assert.False(suite.T(), IsFile(key_path))
}


func TestExampleTestSuite(t *testing.T) {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
    suite.Run(t, new(TestSuite))
}
