#!/bin/bash

ARCHIVE_ROOT="./20130501Y.001 - can be sfely deleted (2)"


METADATA_DIR="metadata"
RAW_PREVIEW_DIR="hi-res (RAW)"

PREVIEW_NAME="%-:1d/${RAW_PREVIEW_DIR}/%f.jpg"
JSON_NAME="%-:1d/${METADATA_DIR}/%f.json"

# XXX need to also copy jpg originals to the preview dir...
# XXX do we need to rotate the images using exif data here???
# XXX need to prevent overwriting of unchanged exif data...
#	when file exists??

exiftool -if '$jpgfromraw' -b -jpgfromraw -w "$PREVIEW_NAME" \
	-execute -if '$previewimage' -b -previewimage -w "$PREVIEW_NAME" \
	-execute -tagsfromfile @ -srcfile "$PREVIEW_NAME" -overwrite_original \
	-execute -j -w "$JSON_NAME" \
	-common_args --ext jpg -r "$ARCHIVE_ROOT" -progress


SIZE=900

ALGORITHM=bicubic

COMPRESSION=90

PATH=$PATH:`pwd`/vips-dev-7.32.0/bin/

# XXX use find...
for f in "${ARCHIVE_ROOT}"/DCIM/hi-res\ \(RAW\)/*jpg ; do
	# create preview dir if it does not already exist...
	D="`dirname \"${f/hi-res\ /preview }\"`"
	if ! [ -e "$D" ] ; then
		mkdir -p "$D"
	fi

	# create previews...
	if ! [ -e "${f/hi-res\ /preview }" ] ; then

		# get source size...
		W=$(vips im_header_int width "$f")
		H=$(vips im_header_int height "$f")

		# NOTE: vips appends nasty unprintable \r's to values, so we need to clean them out...
		W=${W//[![:digit:]]/}
		H=${H//[![:digit:]]/}

		# calculate the factor...
		FACTOR=$(echo "scale = 4; if($H > $W) s = $H else s = $W ; s / $SIZE" | bc -l)

		echo "($FACTOR): ${f/hi-res\ /preview }:${COMPRESSION}"

		vips im_shrink "$f" "${f/hi-res\ /preview }:${COMPRESSION}" $FACTOR $FACTOR 2> /dev/null
	fi
done

