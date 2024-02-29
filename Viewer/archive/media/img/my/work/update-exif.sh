#!/bin/bash





DIR=`pwd`

printhelp(){
	echo "Usage: `basename $0` [ARGUMENTS] [PATH]"
	echo
	echo "Arguments:"
	echo "	-h --help	- print this help and exit."
	echo
}

while true ; do
	case $1 in
		-h|--help)
			printhelp
			exit
			;;
		*)
			break
			;;
	esac
done



# XXX add support for getting exif from raw...
#	...this can lead to multiple hits, need a way to decide which 
#	one to use...
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
