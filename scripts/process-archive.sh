#!/bin/bash

# TODO make this runnable from anywhere...
#	- prepend paths with './' only if local/relative

# HACK: this is here to avoid using windows find...
PATH=/bin:$PATH

printhelp(){
	echo "Usage: `basename $0` [ARGUMENTS] [ARCHIVE_ROOT]"
	echo
	echo "Arguments:"
	echo "	-h --help	- print this help and exit."
	echo "	--common-previews PATH"
	echo "			- build a single preview set at PATH."
	echo
	echo "	--skip-archive	- skip creating archive structure (use: exiftool)."
	echo "	--skip-previews	- skip creating previews (use: vips)."
	echo "	--skip-cache	- skip creating cache (use: buildcache)."
	echo "	--skip-all	- same as setting all of the above."
	echo
	echo "NOTE: common preview path is relative to ARCHIVE_ROOT."
	echo "NOTE: if no arguments are passed then this will process all directories"
	echo "	in current location."
	echo
}

# process args...
while true ; do
	case $1 in
		-h|--help)
			printhelp
			exit
			;;

		--common-previews)
			COMMON_PREVIEWS="${2}/preview (RAW)"
			shift
			shift
			;;

		--skip-archive)
			SKIP_ARCHIVE=yes
			echo skipping making archive...
			shift
			;;
		--skip-previews)
			SKIP_PREVIEWS=yes
			echo skipping making previews...
			shift
			;;
		--skip-cache)
			SKIP_CACHE=yes
			echo skipping making cache...
			shift
			;;
		--skip-all)
			SKIP_ARCHIVE=yes
			echo skipping making archive...
			SKIP_PREVIEWS=yes
			echo skipping making previews...
			SKIP_CACHE=yes
			echo skipping making cache...
			shift
			;;
		*)
			break
			;;
	esac
done

if [ -z "$1" ] ; then
	ARCHIVE_ROOT="."
else
	ARCHIVE_ROOT="$1"
fi

echo "Doing: \"$ARCHIVE_ROOT\""


METADATA_DIR="metadata"
RAW_PREVIEW_DIR="hi-res (RAW)"
PROCESSED_PREVIEW_DIR="preview"

PROCESSED_PREVIEW_NAME="%-:1d/${PROCESSED_PREVIEW_DIR}/%f.jpg"
PREVIEW_NAME="%-:1d/${RAW_PREVIEW_DIR}/%f.jpg"
JSON_NAME="%-:1d/${METADATA_DIR}/%f.json"


# TODO do a version of this using exiv2...
#	- to be more flexible...
#	- check speed...
#	- give the user more options...
#

# XXX need to also copy jpg originals to the preview dir (things that 
#	were shot in jpeg in-camera)...
# XXX need to prevent overwriting of unchanged exif data...
#	when file exists??
# XXX add PSD metadata extraction...
#	-execute '-FileModifyDate<DateTimeOriginal' -tagsfromfile @ \
#		-srcfile "$PROCESSED_PREVIEW_NAME" -overwrite_original \
# XXX keep file dates...

if [ -z $SKIP_ARCHIVE ] ; then
	exiftool -if '$jpgfromraw' -b -jpgfromraw -w "$PREVIEW_NAME" \
		-execute -if '$previewimage' -b -previewimage -w "$PREVIEW_NAME" \
		-execute '-FileModifyDate<DateTimeOriginal' -tagsfromfile @ \
			-srcfile "$PREVIEW_NAME" -overwrite_original \
		-execute -j -w "$JSON_NAME" \
		-common_args --ext jpg -r "./$ARCHIVE_ROOT" -progress
fi


SIZE=900

COMPRESSION=90

# XXX remove this in production...
PATH=$PATH:/mnt/d/Program\ Files/vips/bin/



# makepreview SIZE IN [OUT [SIZE [COMPRESSION]]]
# 
# NOTE: SIZE and COMPRESSION will be set as follows (in order of priority):
#	- explicit argument
#	- global env var, if set
#	- hardcoded default value
#
# XXX cahnge global var names to be less generic...
makepreview(){

	# arguments...
	SIZE="$1"
	IN="$2"
	# output dir...
	if [ -z $OUT ] ; then
		# default...
		# XXX is this correct??? (not generic enough...)
		OUT="${IN/hi-res\ /preview }"
	else
		OUT="$3"
	fi
	# size...
	if [ -z $4 ] ; then
		if [ -z $SIZE ] ; then
			# default...
			SIZE=900
		fi
	else
		SIZE=$4
	fi
	# compression...
	if [ -z $5 ] ; then
		if [ -z $COMPRESSION ] ; then
			# default...
			COMPRESSION=90
		fi
	else
		COMPRESSION=$5
	fi


	# create preview dir if it does not already exist...
	DIR="`dirname \"./${OUT}\"`"
	if ! [ -e "./$DIR" ] ; then
		mkdir -p "./$DIR"
	fi

	# create previews...
	if ! [ -e "./${OUT}" ] ; then

		# get source size...
		W=$(vips im_header_int width "$IN")
		H=$(vips im_header_int height "$IN")

		# NOTE: vips appends nasty unprintable \r's to values, so we need to clean them out...
		W=${W//[![:digit:]]/}
		H=${H//[![:digit:]]/}

		# calculate the factor...
		FACTOR=$(echo "scale = 4; if($H > $W) s = $H else s = $W ; s / $SIZE" | bc -l)

		echo "($FACTOR): ${OUT}:${COMPRESSION}"

		vips im_shrink "./$IN" "./${OUT}:${COMPRESSION}" $FACTOR $FACTOR 2> /dev/null

		touch -c -r "./$IN" "./${OUT}"

	else
		echo "File already exists: ${OUT}"
	fi
}

export SIZE COMPRESSION
export -f makepreview 

cd "./${ARCHIVE_ROOT}"



# make previews...
if [ -z $SKIP_PREVIEWS ] ; then

	#export TOTAL=$(find . -type d -name 'hi-res (RAW)' -exec ls "{}" \; | wc -l)
	# XXX do not know how to pass and modify a var...
	#export CUR=1

	find . -path '*hi-res (RAW)/*.jpg' -exec bash -c 'makepreview "$SIZE" "{}"' \;
fi



# collect previews to one location...
# XXX test!!!
if ! [ -z $COMMON_PREVIEWS ] ; then
	if ! [ -e "./$COMMON_PREVIEWS" ] ; then
		mkdir -p "./$COMMON_PREVIEWS"
	fi
	find . -type d -name 'preview (RAW)' -exec mv "{}" "./$COMMON_PREVIEWS" \;
fi



# build cache...
if [ -z $SKIP_CACHE ] ; then
	find . -type d -name 'preview (RAW)' -exec buildcache "{}" \;
fi



# vim:set nowrap nospell :
