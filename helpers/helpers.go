// Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
// This software is licensed under GPL v3 or later


package helpers

import (
	"os"
)

// This function is ugly
func IsAlphaNumeric(value string) bool {
	for _, n := range value {
		if n >= '0' && n <= '9' || n >= 'a' && n <= 'z' || n >= 'A' && n <= 'Z' {
			
		} else {
			return false
		}
	}

	return true
}

func Larger(numbers... uint64) uint64 {
	var retval uint64
	for _, n := range numbers {
		if n > retval {
			retval = n
		}
	}

	return retval
}

func IsFile(file_name string) (bool) {
	// Get the file info
	finfo, err := os.Stat(file_name)

	// Return false if failed to get the file info
	if err != nil {
		return false
	}

	// Return false if it is a directory
	if finfo.IsDir() {
		return false
	}

	// Return true if it has a name
	if len(finfo.Name()) > 0 {
		return true
	}

	// Return false otherwise
	return false
}

func IsDir(dir_name string) (bool) {
	// Get the dir info
	finfo, err := os.Stat(dir_name)

	// Return false if failed to get the dir info
	if err != nil {
		return false
	}

	// Return true if it is a directory
	if finfo.IsDir() {
		return true
	}

	// Return false otherwise
	return false
}


