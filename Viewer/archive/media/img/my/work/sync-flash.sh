#!/bin/bash

VERSION=1.0

DATE=`date +%Y%m%d`
COUNT=1
TITLE=""

RSYNC=rsync
#RSYNCFLAGS="-arptgoA --info=progress2,flist --human-readable"
RSYNCFLAGS="-arpt --info=progress2,flist --human-readable"

CP=cp
CPFLAGS=-Rpfv

# override default...
COPY=$RSYNC
COPYFLAGS=$RSYNCFLAGS

COMPRESSOR=./compress-archive.sh
COMPRESS=1


# Config file to contain all the default settings...
# XXX not sure if this is a good idea...
#	...should we also check file sec?
##CONFIG=.sync-flash.rc
##if ! [ -z $CONFIG ] && [ -e ~/$CONFIG ] ; then
##	# XXX executing an external file...
##	source ~/$CONFIG
##fi


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
			echo "	-b|-base BASE	the base dir to look for drives in"
			echo "			default: $BASE"
			echo "	--rsync		use rsync (default)"
			echo "	--cp		use cp"
			if ! [ -z $COMPRESSOR ] ; then
				echo "	--compress	toggle archive compression"
				echo "			default: `[[ $COMPRESS ]] && echo "on" || echo "off"`"
			fi
			# notes...
			echo
			if ! [ -z $COMPRESSOR ] ; then
				echo "NOTE: the index is fully usable during the compression stage"
			fi
			echo "NOTE: cp under Cygwin may messup permissions, use rsync."
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
			BASE=$2
			shift 2
			;;
		-cp|--cp)
			COPY=cp
			COPYFLAGS=-Rpfv
			shift
			break
			;;
		-rsync|--rsync)
			COPY=$RSYNC
			COPYFLAGS=$RSYNCFLAGS
			shift
			break
			;;
		-compress|--compress)
			COMPRESS=`[[ $COMPRESS ]] && echo "" || echo 1`
			shift
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

__BASE=$BASE
while true ; do
	BASE=$__BASE
	if [[ $INTERACTIVE || ! $DRIVE ]] ; then
		INTERACTIVE=1
		echo "Select/toggle an option:"
		echo "0) Multi flash card mode is `[[ $MULTI ]] && echo "on" || echo "off"`"
		echo "1) Directoy description is: \"$TITLE\"."
		if [[ ! $DRIVE ]] ; then
			echo "a-z|name) Type a drive letter, mount name in $BASE or path and start."
			echo "          (paths must start with \"/\", \"./\" or \"[A-Z]:\")"
		else
			echo "a-z|name) Type a drive letter, mount name in $BASE or path and start."
			echo "          (paths must start with \"/\", \"./\" or \"[A-Z]:\")"
			echo "Enter) Copy drive ${DRIVE}"
		fi
		echo "2) Build."
		if ! [ -z $COMPRESSOR ] ; then
			echo "3) Compresion is `[[ $COMPRESS ]] && echo "on" || echo "off"`"
			echo "4) Quit."
		else
			echo "3) Quit."
		fi
		read -ep ": " RES
	
		# NOTE: we can't use letters here as they will shadow 
		# 	with drive letters...
		case $RES in
			# toggle multi mode...
			0)
				MULTI=`[[ ! $MULTI ]] && echo 1 || echo ""`
				continue
				;;
			1)
				read -i "${TITLE# - }" -ep "new description: " TITLE
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
				if ! [ -z $COMPRESSOR ] ; then
					COMPRESS=`[[ ! $COMPRESS ]] && echo 1 || echo ""`
				else
					exit
				fi
				continue
				;;
			4)
				exit
				;;

			# new drive letter...
			*)
				# explicit path given...
				if [[ "${RES::1}" == "/" ]] \
						|| [[ "${RES::2}" == "./" ]] \
						|| [[ "${RES::2}" =~ [a-zA-Z]: ]] \
						&& [ -e "$RES" ] ; then
					BASE=
				fi
				DRIVE=$RES
				;;
		esac
	fi

	# sanity check...
	if ! [ -e "${BASE}/${DRIVE}" ] ; then
		echo
		echo "ERR: ${BASE}/${DRIVE}: does not exist, nothing to copy."
		echo
		if [[ $INTERACTIVE || ! $DRIVE ]] ; then
			continue
		fi
		exit
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

	echo "Copying files from ${BASE}/${DRIVE} (~`du -hs "${BASE}/${DRIVE}" | cut -f 1`)..."
	$COPY $COPYFLAGS ${BASE}/${DRIVE}/* "$DIR" \
		2> >(tee "${DIR}"/copy-err.log)
	# no errors -> remove log...
	if ! [ -s "${DIR}/copy-err.log" ] ; then
		rm -f "${DIR}"/copy-err.log
	fi
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

if [[ $COMPRESS ]] ; then
	echo "Compressing archive..."
	${COMPRESSOR} "$BASE_DIR"
	echo "Compressing archive: done."
fi


echo "`basename "$0"`: done."

# vim:set nowrap :
