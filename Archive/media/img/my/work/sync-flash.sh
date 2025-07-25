#!/usr/bin/env bash

# TODO add option to continue last sync...
# 	- need to store parsable log
# 		- settings
# 		- started/completed operations
# 	- all operations should be resumable

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

# NOTE: jdupes reports progress to stderr and output to stdout...
# XXX need to test if this exists...
VERIFY=jdupes
VERIFYFLAGS="-r -u -I"
DO_VERIFY=


COMPRESS=./compress-archive.sh
DO_COMPRESS=1

SNAPSHOT=../../../../snapshot.sh 


# Config file to contain all the default settings...
# XXX not sure if this is a good idea...
#	...should we also check file sec?
##CONFIG=.sync-flash.rc
##if ! [ -z $CONFIG ] && [ -e ~/$CONFIG ] ; then
##	# XXX executing an external file...
##	source ~/$CONFIG
##fi


# base mount dir...
BASES=(
	/Volumes
	/cygdrive
	/run/media/$USER
	/mnt
	~/mnt
)
i=0
for d in "${BASES[@]}"; do
	# normalize...
	BASES[$i]="${d%/}/"
	# remove non-existant bases...
	if ! [ -d "$d" ] ; then
		unset BASES[$i]
	elif [ -z $BASE ] ; then
		BASE=$d
	fi
	i=$(( i + 1 ))
done


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
			if ! [ -z $VERIFY ] ; then
				echo "	--verify	toggle copy verification"
				echo "			default: `[[ $DO_VERIFY ]] && echo "on" || echo "off"`"
			fi
			if ! [ -z $COMPRESS ] ; then
				echo "	--compress	toggle archive compression"
				echo "			default: `[[ $DO_COMPRESS ]] && echo "on" || echo "off"`"
			fi
			# notes...
			echo
			if ! [ -z $COMPRESS ] ; then
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
		-verify|--verify)
			DO_VERIFY=`[[ $DO_VERIFY ]] && echo "" || echo 1`
			shift
			break
			;;
		-compress|--compress)
			DO_COMPRESS=`[[ $DO_COMPRESS ]] && echo "" || echo 1`
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

BASE=${BASE%/}/
DRIVE=${1}

__BASE=$BASE
while true ; do
	BASE=$__BASE
	if [[ $INTERACTIVE || ! $DRIVE ]] ; then
		INTERACTIVE=1
		echo
		echo "Select/toggle an option:"
		if [ -z $MULTI_STARTED ] ; then
			if [[ $MULTI ]] ; then
				echo "0) Multiple flash cards"
			else
				echo "0) Single flash card"
			fi
		else
			echo "0) Build after this flash card: `[[ $LAST ]] && echo "yes" || echo "no"`"
		fi
		echo "1) Directoy description is: \"$TITLE\""
		echo "a-z|name) Type a drive letter, mount name in $BASE or path and start"
		echo "          (paths must start with \"/\", \"./\" or \"[A-Z]:\")"
		if [[ $DRIVE ]] ; then
			echo "Enter) Copy drive ${DRIVE}"
		fi
		echo "2) Build"

		# dynamic options...
		i=3
		OPTION_VERIFICATION=
		if ! [ -z $VERIFY ] ; then
			echo "$i) Verification is `[[ $DO_VERIFY ]] && echo "on" || echo "off"`"
			OPTION_VERIFICATION=$i
			i=$(( i + 1 ))
		fi

		OPTION_COMPRESSION=
		if ! [ -z $COMPRESS ] ; then
			echo "$i) Compresion is `[[ $DO_COMPRESS ]] && echo "on" || echo "off"`"
			OPTION_COMPRESSION=$i
			i=$(( i + 1 ))
		fi

		echo "$i) Quit"
		OPTION_QUIT=$i
		read -ep ": " RES
	
		# NOTE: we can't use letters here as they will shadow 
		# 	with drive letters...
		case $RES in
			# toggle multi mode...
			0)
				if [ -z $MULTI_STARTED ] ; then
					MULTI=`[[ ! $MULTI ]] && echo 1 || echo ""`
				else
					LAST=`[[ ! $LAST ]] && echo 1 || echo ""`
				fi
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

			# dynamic option handlers...
			"$OPTION_VERIFICATION")
				DO_VERIFY=`[[ ! $DO_VERIFY ]] && echo 1 || echo ""`
				continue
				;;
			"$OPTION_COMPRESSION")
				DO_COMPRESS=`[[ ! $DO_COMPRESS ]] && echo 1 || echo ""`
				continue
				;;
			"$OPTION_QUIT")
				exit
				;;

			# new drive letter...
			*)
				DRIVE=$RES
				;;
		esac
		echo
	fi

	# explicit path given...
	if [[ "${DRIVE::1}" == "/" ]] \
			|| [[ "${DRIVE::2}" == "./" ]] \
			|| [[ "${DRIVE::2}" =~ [a-zA-Z]: ]] \
			&& [ -e "$DRIVE" ] ; then
		BASE=
	fi

	# check path...
	notfound=()
	if ! [ -z $BASE ] ; then
		for d in "${BASES[@]}"; do
			if [ -e "${d}${DRIVE}" ] ; then
				BASE=$d
				break
			else
				notfound+=("${d}${DRIVE}")
			fi
			i=$(( i + 1 ))
		done
	fi
	if ! [ -e "${BASE}${DRIVE}" ] ; then
		if [ ${#notfound[@]} == 0 ] ; then
			notfound=(${BASE}${DRIVE})
		fi
		echo
		echo "ERR: Not found:"
		for d in "${notfound[@]}" ; do
			echo "ERR:	${d}" 
		done
		echo "ERR: Nothing to copy."
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
		# get next dir index...
		while [ -e *"$DIR"* ] ; do
			COUNT=$((COUNT+1))
			SCOUNT=`printf "%03d" $COUNT`
			DIR="${BASE_DIR}/${DATE}.${SCOUNT}"
		done
	fi

	MULTI_STARTED=1

	# normalize paths...
	BASE_DIR="./- ${BASE_DIR}/"
	DIR="./- $DIR/"

	mkdir -vp "$DIR"

	while true ; do
		echo "Copying files from ${BASE}${DRIVE} (~`du -hs "${BASE}${DRIVE}" | cut -f 1`)..."
		#echo "# $COPY $COPYFLAGS ${BASE}${DRIVE}/* "$DIR""
		#echo "#	2> >(tee "${DIR}"/copy-err.log)"
		$COPY $COPYFLAGS ${BASE}${DRIVE}/* "$DIR" \
			2> >(tee "${DIR}"/copy-err.log)
		# no errors -> remove log...
		if ! [ -s "${DIR}/copy-err.log" ] ; then
			rm -f "${DIR}"/copy-err.log
		fi
		echo "Copying files: done."

		# verify copy...
		# XXX make this more generic...
		if [ $DO_VERIFY ] && ! [ -z $VERIFY ] ; then
			echo "Verifying copied files..."
			$VERIFY $VERIFYFLAGS ${BASE}${DRIVE}/* "$DIR" \
				> >(tee "${DIR}"/verification-err.log)
			if ! [ -s "${DIR}/verification-err.log" ] ; then
				rm -f "${DIR}"/verification-err.log
			else
				echo
				echo "WARNING: found mismatching files"
				echo "	(see: "${DIR}"/verification-err.log)"
				echo
				while true; do
					read -ep "[R]etry, [c]ontinue, or Ctrl-C to cancel: " ACTION
					ACTION=`echo ${ACTION,,} | xargs`
					if [[ $ACTION =~ [rc] ]] \
							|| [ -z  $ACTION ] ; then
						break
					fi
					echo "Unknown input: \"$ACTION\""
				done
				if [[ $ACTION == "c" ]] ; then
					break
				else
					continue
				fi
			fi
			echo "Verifification: done."
			break
		# no verification defined...
		else
			break
		fi
	done

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

if [[ $DO_COMPRESS ]] ; then
	echo "Compressing archive..."
	${COMPRESS} "$BASE_DIR"
	echo "Compressing archive: done."
fi

if ! [ -z "$SNAPSHOT" ] \
		&& [ -e "$SNAPSHOT" ] ; then
	"$SNAPSHOT"
fi

# XXX add report...
# XXX

echo "`basename "$0"`: done."

# vim:set nowrap :
