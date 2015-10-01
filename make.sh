# Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
# This software is licensed under GPL v3 or later


# Have this script stop on any error
set -e

# If there are no arguments, print the correct usage and exit
if [ "$#" -ne 1 ]; then
	echo "Build and run ethical_ad_block_server.exe" >&2
	echo "Usage: ./make.sh port" >&2
	echo "Example: ./make.sh 9000" >&2
	exit 1
fi

# Make sure Go is installed
if ! type go >/dev/null 2>&1; then
	echo "Go was not found. Please install the Go programming language." >&2
	exit 1
fi

# FIXME: Make sure we are using at least go version 1.5

# Remove the exes
rm -f ethical_ad_block_server.exe

# Build the server exe
echo "Building ethical_ad_block_server.exe ..."
go build ethical_ad_block_server.go

# Run the server
echo "Running ethical_ad_block_server.exe at http://127.0.0.1:$1 ..."
./ethical_ad_block_server.exe $1 &

# Run chrome
echo "Starting Chrome with --allow-running-insecure-content ..."
start chrome --allow-running-insecure-content

# Run the example
echo "Running examples at http://127.0.0.1:8000 ..."
python -m http.server 8000
