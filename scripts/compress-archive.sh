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
	echo "	-bz -bzip2	- use bzip2 to compress (default)."
	echo "	-gz -gzip	- use gzip to compress."
	echo "	-c -compact	- use ntfs compression."
	echo
	echo "	-ext EXT	- set file extension to compress (default: ARW)"
	echo "			  NOTE: only one -ext is supported now".
	echo
	echo "NOTE: not yet sure if to use ntfs compression or bzip2 as default"
	echo "	they both have advantages and disadvantages:"
	echo "		ntfs compression:"
	echo "		  + transparent to all apps -- no extra steps needed"
	echo "		  - might complicate low level data recovery"
	echo "		  - transfers may not be transparent -- actual size vs. disk size"
	echo "		bzip2/gzip/...:"
	echo "		  + transparent to file operations and recovery"
	echo "		  - requires manual decompression"
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
		-bz|--bzip2)
			ARCH=bzip2 -v \{}
			shift
			;;
		-gz|--gzip)
			ARCH=gzip -v \{}
			shift
			;;
		-c|--compact)
			# XXX should we cygpath -w all the inputs???
			ARCH='compact /c /exe:lzx {}'
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
