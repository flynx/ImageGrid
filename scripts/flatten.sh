#!/bin/bash

shopt -s extglob

SCRIPT_DIR="`dirname $0`"

# we operate only on the dir the script is in...
cd $SCRIPT_DIR

if ! [ -e "ALL" ] ; then
	mkdir "ALL"
fi

find . -path ./ALL -prune -o -iregex ".*\(jpg\|png\|gif\)" -printf ./%P\\0 | while read -d '' f ; do
	echo "$f"
	to=${f//.\//}
	mv "$f" "./ALL/${to//\// - }"

	# cleanup...
	while [[ $f != "." ]] ; do
		f=`dirname ./"$f"`
		f=${f//.\//}

		if ! [ "`ls -A ./\"$f\"`" ] ; then
			echo "removing empty: $f"
			rmdir ./"$f"
		fi
	done
done

