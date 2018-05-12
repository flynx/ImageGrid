#!/bin/bash

# TODO make this runnable from anywhere...
#	- prepend paths with './' only if local/relative

BASE_PATH=.

ARCH="bzip2 -v {}"

EXT=ARW

# HACK: this is here to avoid using windows find...
PATH=/bin:$PATH



printhelp(){
	echo "Usage: `basename $0` [ARGUMENTS] [PATH]"
	echo
	echo "Arguments:"
	echo "	-h --help	- print this help and exit."
	echo
	echo "	-bzip2		- use bzip2 to compress (default)."
	echo "	-gzip		- use gzip to compress."
	echo
	echo "	-ext EXT	- set file extension to compress (default: ARW)"
	echo "			  NOTE: only one -ext is supported now".
	echo
}

# process args...
while true ; do
	case $1 in
		-h|--help)
			printhelp
			exit
			;;

		# archivers...
		-bzip2)
			ARCH=bzip2 -v \{}
			shift
			;;
		-gzip)
			ARCH=gzip -v \{}
			shift
			;;

		# extension to compress...
		--ext)
			EXT=$2
			shift
			shift
			;;

		*)
			break
			;;
	esac
done

# get path...
if [ $1 ] ; then
	BASE_PATH="$1"
fi



# do the work...
find $BASE_PATH -name \*.${EXT} -exec ${ARCH} \;



# vim:set nowrap nospell :
