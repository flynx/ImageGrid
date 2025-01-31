#!/usr/bin/bash

# XXX this should run in script dir (not cwd)...

# XXX need:
# 	- protocol (command) to create archive root
# 	- protocol to create snapshots
# 		- sync-flash.sh ???
# 	- protocol to restore stuff -- simply copy???
# 	- protocol to fully delete something -- i.e. delete snapshots???
# 	- a way to list deleted files
# 	- a way to list available file versions
# 	- a way to restore specicifc file(s)
# 	- a way to maintain a set number of snapshots...
#

# check if on btrfs filesystem...
# XXX also check if btrfs command is available...
if ! btrfs filesystem usage . > /dev/null ; then
	exit
fi


#SNAPSHOT_COUNT=


# create ./media...
# XXX check if not a directory...
if ! [ -e ./media ] ; then
	btrfs subvolume create ./media
	# XXX build tree -- ImageGrid

# convert ./media to a subvolume...
elif [ "$(stat --format=%i ./media)" == 256 ] ; then
	mkdir bak
	mv media bak/
	btrfs subvolume create ./media
	cp --archive --one-file-system --reflink=always \
		./bak/media/{,.}* \
		./media/
fi
mkdir -p ./.snapshots


# XXX should this be more human readable???
# 	...a date + number maybe???
SNAPSHOT=$(( 
	$( ls .snapshots \
		| sort -n \
		| tail -n 1 ) \
	+ 1 ))

btrfs subvolume snapshot -r ./media .snapshots/${SNAPSHOT}

