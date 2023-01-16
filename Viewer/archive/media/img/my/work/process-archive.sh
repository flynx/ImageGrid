#!/bin/bash
#
#######################################################################
#
# This does not care about actual topology of the archive directory 
# that is passed it, it will find all the supported raw files and 
# create the apropriate directories one level up.
#
#
#######################################################################

# CPU threads to keep free...
KEEP_FREE=2

THREADS=`cat /proc/cpuinfo | awk '/^processor/{print $3}' | wc -l`
if [ $KEEP_FREE ] && (( THREADS > KEEP_FREE )) ; then
	THREADS=$((THREADS - KEEP_FREE))
fi


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
	echo "	-c		- build a single common path at ARCHIVE_ROOT;"
	echo "			  this is a shorthand for: --common-path '.'."
	echo "	-l --low-res-previews"
	echo "			- generate low resolution previews and store"
	echo "			  original previews in \"hi-res (RAW)\"."
	echo
	echo "	--skip-archive	- skip creating archive structure (use: exiftool)."
	echo "	--skip-previews	- skip creating previews (use: vips)."
	echo "	--skip-cache	- skip creating cache (use: buildcache)."
	echo "	--skip-all	- same as setting all of the above."
	echo
	echo "NOTE: common preview path is relative to ARCHIVE_ROOT."
	echo "NOTE: if no ARCHIVE_ROOT is passed then this will process all"
	echo "	directories in cwd."
	# XXX this is how exiftool does things, need to figure out a workaround...
	echo "NOTE: this expects the RAW files to be located at least one level"
	echo "	down the ARCHIVE_ROOT to make room for the metadata and preview"
	echo "	directories."
	echo "	If any raw files are found in the ARCHIVE_ROOT directly this"
	echo "	will create the preview and metadata directly one level above"
	echo "	that."
	echo
}

# process args...
while true ; do
	case $1 in
		-h|--help)
			printhelp
			exit
			;;

		-c)
			COMMON_PREVIEWS="."
			shift
			;;
		--common-previews)
			COMMON_PREVIEWS="${2}"
			shift
			shift
			;;
		-l|--low-res-previews)
			LOW_RES_PREVIEWS=1
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


if [ $LOW_RES_PREVIEWS ] ; then
	RAW_PREVIEW_DIR="hi-res (RAW)"
else
	RAW_PREVIEW_DIR="preview (RAW)"
fi


PROCESSED_PREVIEW_DIR="preview"
METADATA_DIR="metadata"

PROCESSED_PREVIEW_NAME="%-:1d/${PROCESSED_PREVIEW_DIR}/%f.jpg"
PREVIEW_NAME="%-:1d/${RAW_PREVIEW_DIR}/%f.jpg"
JSON_NAME="%-:1d/${METADATA_DIR}/%f.json"


# TODO do a version of this using exiv2...
#	- to be more flexible...
#	- check speed...
#	- give the user more options...
# TODO use dcraw to extract/generate previews if we could not get any 
#	via exiftool
#		dcraw -e $RAW 
#			- try and extract a preview
#			- creates a file: $RAW-thumb.jpg
#		dcraw -c $RAW | pnmtojpeg -quality=90 > $JPG
#			- process raw and convert to jpeg (slow)
# TODO ignore raw images located in the ARCHIVE_ROOT directly...

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
		-execute '-FileModifyDate<DateTimeOriginal' -addtagsfromfile @ \
			-srcfile "$PREVIEW_NAME" '-all>all' '-xmp' \
			-overwrite_original \
		-execute -j -G -w "$JSON_NAME" \
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
# TODO:
#	- make this run in parallel
#	- add option --mixed-previews and check preview size once per dir
#	  if it is not set...
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

		# NOTE: bash does not do float comparisons so we cheat again ;)
		TOO_SMALL=$(echo "if($FACTOR <= 1) s = 1 else s = 0 ; s" | bc -l)

		# the input is smaller than target size, copy as-is...
		if [[ $TOO_SMALL == 1 ]] ; then
			echo "$IN: Too small, copying as-is..."

			cp "./$IN" "./$OUT"

		# shrink...
		else
			echo "($FACTOR): ${OUT}:${COMPRESSION}"

			vips im_shrink "./$IN" "./${OUT}:${COMPRESSION}" $FACTOR $FACTOR 2> /dev/null
		fi

		touch -c -r "./$IN" "./${OUT}"

	else
		echo "File already exists: ${OUT}"
	fi
}

export SIZE COMPRESSION
export -f makepreview 

cd "./${ARCHIVE_ROOT}"



# make low-res previews...
if [ -z $SKIP_PREVIEWS ] || [ $LOW_RES_PREVIEWS ] ; then
	#find . -path '*hi-res (RAW)/*.jpg' -exec bash -c 'makepreview "$SIZE" "{}"' \;
	find . -path '*hi-res (RAW)/*.jpg' -print0 \
		| xargs -0 -n 1 -P $THREADS -I {} bash -c 'makepreview "$SIZE" "{}"'
fi

# collect previews to one location...
# XXX test!!!
if ! [ -z "$COMMON_PREVIEWS" ] ; then
	if ! [ -e "./$COMMON_PREVIEWS" ] ; then
		mkdir -p "./$COMMON_PREVIEWS"
	fi
	#if [ -z $TOTAL ] ; then
	#	export TOTAL=`find . -path '*hi-res (RAW)/*.jpg' | wc -l`
	#fi
	# XXX BUG: this does not rename if target exists...
	find . -type d \
		-name 'preview (RAW)' \
		-print \
		-exec cp --backup=t -rl "{}" "./$COMMON_PREVIEWS" \; 
		#-exec rm -rf "./$d" 

	# cleanup filenames... (HACK)
	#	image.jpg	->	image_3.jpg
	#	image.jpg.~3~	->	image_2.jpg
	#	image.jpg.~2~	->	image_1.jpg
	#	image.jpg.~1~	->	image.jpg
	#
	i=0
	while true ; do
		i=$((i + 1))
		images=("$COMMON_PREVIEWS/preview (RAW)/"*.~$i~)

		# break if no matches...
		if ! [ -e "${images[0]}" ] ; then
			break
		fi

		for img in "${images[@]}" ; do
			# decrement...
			#	image.jpg.~(N)~	->	image_(N-1).jpg
			mv "$img" "${img/.jpg.~${i}~/_$((i-1)).jpg}" 

			# next image does not exist...
			#	image.jpg	->	image_(N).jpg
			#	image_0.jpg	->	image.jpg
			if ! [ -e "${img/.jpg.~${i}~/.jpg.~$((i+1))~}" ] ; then
				mv "${img/.jpg.~${i}~/.jpg}" "${img/.jpg.~${i}~/_$((i)).jpg}" 
				mv "${img/.jpg.~${i}~/_0.jpg}" "${img/.jpg.~${i}~/.jpg}" 
			fi
		done
	done
fi



# build cache...
if [ -z $SKIP_CACHE ] ; then

	# ig...
	if ! [ -z `command -v ig` ] ; then
		CACHE="ig init"
	# buildcache (legacy)...
	elif [ -z `command -v buildcache` ] ; then
		# a little tweak to make build cache work...
		export PYTHONIOENCODING=UTF-8
		CACHE=buildcache
	fi

	#if [ -z $TOTAL ] ; then
	#	export TOTAL=`find . -path '*hi-res (RAW)/*.jpg' | wc -l`
	#fi
	if ! [ -z "$COMMON_PREVIEWS" ] && [ -e "./$COMMON_PREVIEWS/preview (RAW)" ] ; then
		$CACHE "./$COMMON_PREVIEWS/preview (RAW)"
	else
		find . -type d -name 'preview (RAW)' -exec $CACHE "{}" \;
	fi
fi



# vim:set nowrap nospell :
