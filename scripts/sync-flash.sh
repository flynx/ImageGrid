#!/bin/bash

DATE=`date +%Y%m%d`
COUNT=1
TITLE=""

if ! [ -z $2 ] ; then
	TITLE=" - $2"
fi

# XXX do a real three digit count...
DIR="./- ${DATE}.00${COUNT}${TITLE}/"

while [ -e "$DIR" ] ; do
	COUNT=$((COUNT+1))
	DIR="./- ${DATE}.00${COUNT}${TITLE}/"
done


echo "Creating directory: $DIR"
mkdir "$DIR"
echo "Creating directory: done."



echo "Copying files from $1..."
cp -Rpfv /mnt/${1}/* "$DIR"
echo "Copying files: done."



echo "Building archive..."
./process-archive.sh "$DIR"
echo "Building archive: done."
