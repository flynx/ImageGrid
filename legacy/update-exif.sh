#!/bin/bash

DIR=`pwd`


exifup(){
	PREVIEW_DIR=$1
	if [ -e "$PREVIEW_DIR" ] ; then
		echo doing: `pwd`
		exiv2 ex *.psd
		mv *.exv "$PREVIEW_DIR"
		cd "$PREVIEW_DIR"
		exiv2 -k in *.jpg
		rm -f *.exv
		cd ..
	fi
	true
}

if [[ $1 != "" ]] ; then
	if ! [ -d "$1" ] ; then
		echo "\"$1\": is not a directory."
		exit 1
	fi
	cd "$1/DCIM/"
	exifup ./preview/
	exifup ./hi-res/
	cd "$DIR"
else
	for d in */DCIM/ ; do
		cd "$d"
		exifup ./preview/
		exifup ./hi-res/
		cd "$DIR"
	done
fi
