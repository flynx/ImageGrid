#!/bin/bash

# TODO make this runnable from anywhere...
#	- prepend paths with './' only if local/relative

BASE_PATH=.


ARCH_BZIP2='bzip2 -v {}'
ARCH_GZIP='gzip -v {}'
# XXX should we cygpath -w all the inputs???
ARCH_NTFS='compact /c /exe:lzx {}'


# default...
ARCH=$ARCH_NTFS


EXT=ARW

# HACK: this is here to avoid using windows find...
PATH=/bin:$PATH



printhelp(){
	echo "Usage: `basename $0` [ARGUMENTS] [PATH]"
	echo
	echo "Arguments:"
	echo "	-h --help	- print this help and exit."
	echo
	echo "	-bz -bzip2	- use bzip2 to compress`[[ $ARCH == $ARCH_BZIP2 ]] && echo " (default)" || echo ""`."
	echo "	-gz -gzip	- use gzip to compress`[[ $ARCH == $ARCH_GZIP ]] && echo " (default)" || echo ""`."
	echo "	-c -compact	- use ntfs compression`[[ $ARCH == $ARCH_NTFS ]] && echo " (default)" || echo ""`."
	echo
	echo "	-ext EXT	- set file extension to compress (default: ${EXT})"
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
		-bz|--bzip2)
			ARCH=$ARCH_BZIP2
			shift
			;;
		-gz|--gzip)
			ARCH=$ARCH_GZIP
			shift
			;;
		-c|--compact)
			ARCH=$ARCH_NTFS
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
if [ "$1" ] ; then
	BASE_PATH=$1
fi



# do the work...
find "$BASE_PATH" -name \*.${EXT} -exec ${ARCH} \;



echo done.



# vim:set nowrap nospell :
