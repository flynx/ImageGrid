#!/usr/bin/bash

# XXX need:
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


# create ./media...
if ! [ -e ./media ] ; then
	btrfs subvolume create ./media
	# XXX build tree -- ImageGrid

# convert ./media to a subvolume...
elif [ "$(stat --format=%i ./media)" == 256 ] ; then
	btrfs subvolume create ./media_subvolume
	#mv ./media/{,.}* ./media_subvolume/
	cp --archive --one-file-system --reflink=always \
		./media/{,.}* \
		./media_subvolume/
	mv ./media{,.bak}
	mv ./media{_subvolume,}
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

