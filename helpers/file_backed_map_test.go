// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers


import (
	"os"
	"path/filepath"
	"io/ioutil"
//	"fmt"
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

func (suite *TestSuite) TestCreateEmptyMap() {
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)
	assert.Equal(suite.T(), "test", fbm.DataName())
	assert.Equal(suite.T(), 0, fbm.Len())
	assert.Equal(suite.T(), 1, fbm.MaxLen())
}

func (suite *TestSuite) TestDataDirRecreateOnNew() {
	// Remove the "data" directory
	err := os.RemoveAll("data")
	assert.Nil(suite.T(), err)
	assert.False(suite.T(), IsDir("data"))

	// Make sure it recreated the "data" dir
	fbm, err := NewFileBackedMap("test", 1)
	assert.Nil(suite.T(), err)
	assert.NotNil(suite.T(), fbm)
	full_path, _ := filepath.Abs(filepath.Join("data", "test"))
	assert.Equal(suite.T(), full_path, fbm.FullPath())
}

func (suite *TestSuite) TestDataDirRecreateOnWrite() {
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
	err = fbm.Set("bbb", 7)
	assert.Nil(suite.T(), err)

	// Make sure the "data" dir and keys were recreated
	assert.True(suite.T(), IsDir(fbm.FullPath()))
	key_path := filepath.Join(fbm.FullPath(), "aaa")
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
	key_path := filepath.Join(fbm.FullPath(), "zzz")
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
    suite.Run(t, new(TestSuite))
}
