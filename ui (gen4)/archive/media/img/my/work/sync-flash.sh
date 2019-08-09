#!/bin/bash

DATE=`date +%Y%m%d`
COUNT=1
TITLE=""

RSYNC=rsync
RSYNCFLAGS="-arptgoA --info=progress2,flist --human-readable"

CP=cp
CPFLAGS=-Rpfv

# override default...
COPY=$RSYNC
COPYFLAGS=$RSYNCFLAGS

# base mount dir...
# systems with /mnt
if [ -d /mnt ] ; then
	BASE=/mnt

# raw Cygwin
elif [ -d /cygdrive ] ; then
	BASE=/cygdrive

# OSX
elif [ -d /Volumes ] ; then
	BASE=/Volumes
fi


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
			echo "	-b|-base	the base dir to look for drives in"
			echo "			default: $BASE"
			echo "	--rsync		use rsync (default)"
			echo "	--cp		use cp"
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
		-b|-base|--base)
			BASE=1
			shift
			;;
		-cp|--cp)
			COPY=cp
			COPYFLAGS=-Rpfv
			break
			;;
		-rsync|--rsync)
			COPY=$RSYNC
			COPYFLAGS=$RSYNCFLAGS
			break
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
			echo "a-z|name) type a drive letter or mount name in $BASE and start."
		else
			echo "a-z|name) type a drive letter or mount name in $BASE and start."
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
	SCOUNT=`printf "%03d" $COUNT`
	if [ -z $MULTI ] ; then
		DIR="${DATE}.${SCOUNT}${TITLE}"
		while [ -e *"$DIR"* ] ; do
			COUNT=$((COUNT+1))
			SCOUNT=`printf "%03d" $COUNT`
			DIR="${DATE}.${SCOUNT}${TITLE}"
		done
		BASE_DIR=$DIR

	# multiple flash cards shoot...
	else
		BASE_DIR="${DATE}${TITLE}/"
		DIR="${BASE_DIR}/${DATE}.${SCOUNT}"
		while [ -e *"$DIR"* ] ; do
			COUNT=$((COUNT+1))
			SCOUNT=`printf "%03d" $COUNT`
			DIR="${BASE_DIR}/${DATE}.${SCOUNT}"
		done
	fi
	# normalize paths...
	BASE_DIR="./- ${BASE_DIR}/"
	DIR="./- $DIR/"

	mkdir -vp "$DIR"

	echo "Copying files from ${BASE}/${DRIVE}..."
	$COPY $COPYFLAGS ${BASE}/${DRIVE}/* "$DIR"
	echo "Copying files: done."


	# exit interactive mode...
	if [[ ! $MULTI || ! $INTERACTIVE || $LAST ]] ; then
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


