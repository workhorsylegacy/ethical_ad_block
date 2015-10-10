// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers


import (
	"os"
	"path/filepath"
//	"fmt"
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

// Changing the program path after creating the FBM will fail when trying to write to disk
// Setting key fails when dir does not exist
// Setting key fails when file to write to is locked
// Getting key fails when file to read is locked

type TestSuite struct {
    suite.Suite
    VariableThatShouldStartAtFive int
}

func (suite *TestSuite) SetupTest() {
    suite.VariableThatShouldStartAtFive = 5
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

func (suite *TestSuite) TestRecreateDataDir() {
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

func TestExampleTestSuite(t *testing.T) {
    suite.Run(t, new(TestSuite))
}
