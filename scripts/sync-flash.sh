#!/bin/bash

DATE=`date +%Y%m%d`
COUNT=1
TITLE=""

while true ; do
	case "$1" in
		-h|-help|--help)
			echo "usage: `basename $0` FLAGS DRIVE [TITLE]"
			echo
			echo "	-h|-help	print this message and exit."
			echo "	-m|-multi	single base, multiple sub dirs"
			echo "			for multiple flash cards in a"
			echo "			single shoot."
			echo "	-l|-last	last flash card in set, run"
			echo "			process-archive.sh after copying."
			echo
			exit
			;;
		-m|-multi|--multi)
			MULTI=1
			shift
			;;
		-l|-last|--last)
			LAST=1
			COMMON_FLAG=-c
			shift
			;;
		*)
			break
			;;
	esac
done


if ! [ -z "$2" ] ; then
	TITLE=" - $2"
fi

# XXX do a real three digit count...
# single flash card...
if [ -z $MULTI ] ; then
	DIR="./- ${DATE}.00${COUNT}${TITLE}/"
	while [ -e "$DIR" ] ; do
		COUNT=$((COUNT+1))
		DIR="./- ${DATE}.00${COUNT}${TITLE}/"
	done
	BASE_DIR=$DIR

# multiple flash cards shoot...
else
	BASE_DIR="./- ${DATE}${TITLE}/"
	DIR="${BASE_DIR}/${DATE}.00${COUNT}/"
	while [ -e "$DIR" ] ; do
		COUNT=$((COUNT+1))
		DIR="${BASE_DIR}/${DATE}.00${COUNT}/"
	done
fi


mkdir -vp "$DIR"


echo "Copying files from $1..."
cp -Rpfv /mnt/${1}/* "$DIR"
echo "Copying files: done."


if [[ ! $MULTI || $LAST ]] ; then
	echo "Building archive..."
	./process-archive.sh $COMMON_FLAG "$BASE_DIR"
	echo "Building archive: done."
fi
