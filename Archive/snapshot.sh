#!/usr/bin/bash

if ! [ -e ./media ] ; then
	btrfs subvolume create ./media
	# XXX build tree -- ImageGrid
fi
if ! [ -e ./.snapshots ] ; then
	mkdir ./.snapshots
fi

#DATE=`date +%Y%m%d-%H%M%S`

SNAPSHOT=$(( 
	$( ls .snapshots \
		| sort -n \
		| tail -n 1 ) \
	+ 1 ))


btrfs subvolume snapshot -r ./media .snapshots/${SNAPSHOT}

