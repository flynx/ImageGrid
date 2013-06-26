#!/bin/bash

SCALE=0.21
FACTOR=4.76
ALGORITHM=bicubic

COMPRESSION=90

PATH=$PATH:`pwd`/vips-dev-7.32.0/bin/

for f in */DCIM/hi-res\ \(RAW\)/*jpg ; do
	# this yields images with EXTREAM aliasing artifacts, with all supported algorithms
	# NOTE: vips appears not to support lanczos scaling...
	##vips im_affinei_all "$f" "${f/hi-res\ /preview }:${COMPRESSION}" $ALGORITHM $SCALE 0 0 $SCALE 0 0

	# NOTE: -n (no sharpening) gives a bit too blurry results...
	# NOTE: this also renames the files...
	##vipsthumbnail -s 900 "$f"

	# this gives lots of warnings but appears to be OK... but not too fast.
	# so far, this is the best result...
	# NOTE: this, being "not too fast" actually is the fastest when comparing to I_View or PIL...
	#	- I_View ~2-3 minutes
	#	- PIL ~6 minutes
	#	- im_shrink <2 minutes
	vips im_shrink "$f" "${f/hi-res\ /preview }:${COMPRESSION}" $FACTOR $FACTOR

	# this is different in that it uses a shrink factor while opening the image, thus
	# a different scale factor...
	# - ALLOT faster
	# - blurry in comparison
	##vips im_shrink "$f:4" "${f/hi-res\ /preview }:${COMPRESSION}" 1.19 1.19

	# apply different amounts of read scaling...
	# still quite extreme aliasing...
	# IDEA: it's so extream, might be a good idea to first blur the image some and then scale...
	##vips im_affinei_all "$f:2" "${f/hi-res\ /preview }:${COMPRESSION}" $ALGORITHM 0.42 0 0 0.42 0 0
	# artifacts, better than all previous attempts at im_affinei_all, but worse than plain im_shrink...
	##vips im_affinei_all "$f:4" "${f/hi-res\ /preview }:${COMPRESSION}" $ALGORITHM 0.84 0 0 0.84 0 0
done

