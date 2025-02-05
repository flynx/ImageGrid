#!/usr/bin/bash

# XXX need:
# 	- protocol (command) to create archive root
# 		manually:
# 			- copy tree
# 			- run snapshot.sh
# 		script:
# 			XXX
# 	- protocol to create snapshots
# 		- sync-flash.sh ???
# 	- protocol to restore stuff -- simply copy???
# 	- protocol to fully delete something -- i.e. delete snapshots???
# 	- a way to list deleted files
# 	- a way to list available file versions
# 	- a way to restore specicifc file(s)
# 	- a way to maintain a set number of snapshots...
#

# handle args...
for arg in "$@" ; do
	case $arg in
		-h|--help)
			# XXX
			exit
			;;
	esac
done


SNAPSHOT_DIR=.snapshots
SUBVOLUME_DIR=media
SNAPSHOT_COUNT=5


# run in script dir (not cwd)...
DIR=`dirname "$0"`
if ! [ -z "$DIR" ] ; then
	cd "$DIR"
fi

# check if on btrfs filesystem...
# XXX also check if btrfs command is available...
if ! btrfs filesystem usage . > /dev/null 2>&1 ; then
	exit
fi



# create ./media...
# XXX check if not a directory...
if ! [ -e "$SUBVOLUME_DIR" ] ; then
	btrfs subvolume create "$SUBVOLUME_DIR"
	# XXX build tree -- ImageGrid

# convert ./media to a subvolume...
elif ! [ "$(stat --format=%i "$SUBVOLUME_DIR")" == 256 ] ; then
	mkdir bak
	mv "$SUBVOLUME_DIR" bak/
	btrfs subvolume create "$SUBVOLUME_DIR"
	cp --archive --one-file-system --reflink=always \
		./bak/"$SUBVOLUME_DIR"/{,.}* \
		"$SUBVOLUME_DIR"/
fi
mkdir -p "$SNAPSHOT_DIR"


# XXX should this be more human readable???
# 	...a date + number maybe???
SNAPSHOT=$(( 
	$( ls "$SNAPSHOT_DIR/" \
		| sort -n \
		| tail -n 1 ) \
	+ 1 ))

#btrfs subvolume snapshot -r "$SUBVOLUME_DIR" "${SNAPSHOT_DIR}/${SNAPSHOT}"
btrfs subvolume snapshot "$SUBVOLUME_DIR" "${SNAPSHOT_DIR}/${SNAPSHOT}"


if [[ $SNAPSHOT_COUNT =~ [0-9]* ]] \
		&& [ "$SNAPSHOT_COUNT" != 0 ] ; then
	SNAPSHOTS=($(\
		ls "$SNAPSHOT_DIR/" \
			| sort -n ))
	remove=$(( ${#SNAPSHOTS[@]} - $SNAPSHOT_COUNT - 1 ))
	while (( $remove >= 0 )) ; do
		# XXX can we avoid sudo here???
		# XXX is 'btrfs subvolume delete ...' the same as 'rm -rf ..'
		#sudo btrfs subvolume delete -c ${SNAPSHOT_DIR}/${SNAPSHOTS[$remove]}
		echo Removing snapshot: ${SNAPSHOT_DIR}/${SNAPSHOTS[$remove]}
		rm -rf ${SNAPSHOT_DIR}/${SNAPSHOTS[$remove]}
		remove=$(( $remove - 1 ))
	done
fi



# vim:set nowrap nospell :
