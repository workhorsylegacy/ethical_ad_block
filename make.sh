# Copyright (c) 2015 Matthew Brennan Jones <matthew.brennan.jones@gmail.com>
# This software is licensed under GPL v3 or later


# If there are no arguments, print the correct usage and exit
if [ "$#" -ne 1 ]; then
	echo "Build and run ethical_ad_block_server.exe" >&2
	echo "Usage: make.sh port" >&2
	echo "Example: make.sh 9090" >&2
	exit 1
fi

# Make sure Go is installed
if ! type go >/dev/null 2>&1; then
	echo "Go was not found. Please install the Go programming language." >&2
	exit 1
fi

# Remove the exes
rm -f ethical_ad_block_server.exe

# Build the client exe
echo "Building ethical_ad_block_server.exe ..."
go build ethical_ad_block_server.go

# Run the client
echo "Running ethical_ad_block_server.exe ..."
ethical_ad_block_server.exe $1
