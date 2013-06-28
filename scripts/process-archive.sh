#!/bin/bash

ARCHIVE_ROOT="./20130501Y.001 - can be sfely deleted (2)"


METADATA_DIR="metadata"
RAW_PREVIEW_DIR="hi-res (RAW)"
PROCESSED_PREVIEW_DIR="preview"

PROCESSED_PREVIEW_NAME="%-:1d/${PROCESSED_PREVIEW_DIR}/%f.jpg"
PREVIEW_NAME="%-:1d/${RAW_PREVIEW_DIR}/%f.jpg"
JSON_NAME="%-:1d/${METADATA_DIR}/%f.json"



# XXX need to also copy jpg originals to the preview dir (things that 
#	were shot in jpeg in-camera)...
# XXX do we need to rotate the images using exif data here???
# XXX need to prevent overwriting of unchanged exif data...
#	when file exists??
# XXX add PSD metadata extraction...
# XXX keep file dates...

exiftool -if '$jpgfromraw' -b -jpgfromraw -w "$PREVIEW_NAME" \
	-execute -if '$previewimage' -b -previewimage -w "$PREVIEW_NAME" \
	-execute '-FileModifyDate<DateTimeOriginal' -tagsfromfile @ -srcfile "$PREVIEW_NAME" -overwrite_original \
	-execute '-FileModifyDate<DateTimeOriginal' -tagsfromfile @ -srcfile "$PROCESSED_PREVIEW_NAME" -overwrite_original \
	-execute -j -w "$JSON_NAME" \
	-common_args --ext jpg -r "$ARCHIVE_ROOT" -progress


SIZE=900

COMPRESSION=90

PATH=$PATH:`pwd`/vips-dev-7.32.0/bin/

# makepreview SIZE IN OUT
makepreview(){

	SIZE="$1"
	IN="$2"
	OUT="$3"

	# create preview dir if it does not already exist...
	DIR="`dirname \"${OUT}\"`"
	if ! [ -e "$DIR" ] ; then
		mkdir -p "$DIR"
	fi

	# create previews...
	if ! [ -e "${OUT}" ] ; then

		# get source size...
		W=$(vips im_header_int width "$IN")
		H=$(vips im_header_int height "$IN")

		# NOTE: vips appends nasty unprintable \r's to values, so we need to clean them out...
		W=${W//[![:digit:]]/}
		H=${H//[![:digit:]]/}

		# calculate the factor...
		FACTOR=$(echo "scale = 4; if($H > $W) s = $H else s = $W ; s / $SIZE" | bc -l)

		echo "($FACTOR): ${OUT}:${COMPRESSION}"

		vips im_shrink "$IN" "${OUT}:${COMPRESSION}" $FACTOR $FACTOR 2> /dev/null
	fi
}


# XXX use find...
for FROM in "${ARCHIVE_ROOT}"/DCIM/hi-res\ \(RAW\)/*jpg ; do
	TO="${FROM/hi-res\ /preview }"

	# XXX do different-sized previews...
	makepreview "$SIZE" "$FROM" "$TO"
done

