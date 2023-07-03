#!/bin/bash

TREE=`date +"%Y%m%d-%H%M"`


if ! [ -d ./.tree ] ; then
	echo creating .tree directory...
	mkdir .tree
	attrib +H .tree
fi

echo building current tree...
tree -a -s --sort name -I '.tree*' > ./.tree/$TREE

echo setting LAST/CURRENT states...
[ -e ./.tree/CURRENT ] && cp ./.tree/CURRENT ./.tree/LAST
cp ./.tree/$TREE ./.tree/CURRENT

if [ -e ./.tree/LAST ] ; then
	echo diff...
	# XXX
	diff ./.tree/LAST ./.tree/CURRENT
fi


