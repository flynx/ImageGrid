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
	if [ -e "$1/DCIM/preview/" ] ; then
		cd "$1/DCIM/"
	else
		cd "$1"
	fi
	exifup ./preview/
	exifup ./hi-res/
	cd "$DIR"
else
	for d in */DCIM/ ; do
		if [ -e "$1/DCIM/preview/" ] ; then
			cd "$d"
		else
			cd "$d/../"
		fi
		exifup ./preview/
		exifup ./hi-res/
		cd "$DIR"
	done
fi
