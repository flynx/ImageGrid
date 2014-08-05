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

		-i|--interactive)
			INTERACTIVE=1
			shift
			;;
		-m|-multi|--multi)
			MULTI=1
			shift
			;;
		-l|-last|--last)
			LAST=1
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

DRIVE=${1}

while true ; do
	if [[ $INTERACTIVE || ! $DRIVE ]] ; then
		INTERACTIVE=1
		echo "Select/toggle an option:"
		echo "0) Multi flash card mode is `[[ $MULTI ]] && echo "on" || echo "off"`"
		echo "1) Directoy description is: \"$TITLE\"."
		if [[ ! $DRIVE ]] ; then
			echo "a-z) type a drive letter."
		else
			echo "a-z) type a new drive letter."
			echo "Enter) copy drive ${DRIVE}"
		fi
		echo "2) build."
		echo "3) quit."
		read -p ": " RES
	
		case $RES in
			# toggle multi mode...
			0)
				MULTI=`[[ ! $MULTI ]] && echo 1 || echo ""`
				continue
				;;
			1)
				read -p "new description: " TITLE
				TITLE=" - $TITLE"
				continue
				;;
			# continue with same drive or ask again...
			"")
				if [[ ! $DRIVE ]] ; then
					echo "ERR: need a drive to copy from, no defaults."
					echo
					continue
				fi
				DRIVE=$DRIVE
				;;
			2)
				LAST=1
				break
				;;

			3)
				exit
				;;

			# new drive letter...
			*)
				DRIVE=$RES
				;;
		esac
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
	cp -Rpfv /mnt/${DRIVE}/* "$DIR"
	echo "Copying files: done."


	# exit interactive mode...
	if [[ ! $INTERACTIVE || $LAST ]] ; then
		break
	fi
done

if [[ $LAST ]] ; then
	COMMON_FLAG=-c
fi

if [[ ! $MULTI || $LAST ]] ; then
	echo "Building archive..."
	./process-archive.sh $COMMON_FLAG "$BASE_DIR"
	echo "Building archive: done."
fi


