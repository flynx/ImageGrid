/**********************************************************************
* 
* Image Sorting API
*
*
**********************************************************************/

// Used in sortImagesByFileNameSeqWithOverflow
var PROXIMITY = 30
var CHECK_1ST_PROXIMITY = false
var OVERFLOW_GAP = PROXIMITY * 5



/********************************************************* Sorting ***/

function reverseImageOrder(){
	DATA.order.reverse()
	updateRibbonOrder()
}


// NOTE: using imageOrderCmp as a cmp function here will yield odd 
// 		results -- in-place sorting a list based on relative element 
// 		positions within itself is fun ;)
function sortImages(cmp, reverse){
	cmp = cmp == null ? imageDateCmp : cmp
	DATA.order.sort(cmp)
	if(reverse){
		DATA.order.reverse()
	}
	updateRibbonOrder()
}


// shorthands...
function sortImagesByDate(reverse){
	return sortImages(reverse)
}
function sortImagesByFileName(reverse){
	return sortImages(imageNameCmp, reverse)
}
function sortImagesByFileSeqOrName(reverse){
	return sortImages(imageSeqOrNameCmp, reverse)
}
function sortImagesByFileNameXPStyle(reverse){
	return sortImages(imageXPStyleFileNameCmp, reverse)
}


// Sort images by name while taking into account sequence overflows
//
// A name sequence overflow is when file name sequence overflows over
// *9999 and then resets to *0001...
//
// For this to be applicable:
// 	- ALL filenames must contain a sequence number
// 		XXX do we need to make this more strict?
// 			...for example make name.split(<seq>) equal for all files
// 	- the total number of files in sequence is < 10K
// 		XXX a simplification...
// 			there could be more than 10K images but then we will need to
// 			either take dates or folder names into account...
// 	- the lowest filename in set must be near seq 0001
// 	- the highest filename in set must be near seq 9999
//		 XXX alternatively check the difference between first and 
// 			last elements, if it is far greater than the number 
// 			of elements then it's likely that we need to split...
// 	- there must be a gap somewhere in the set
// 		this gap size is roughly close to 10K - N where N is the total 
// 		number of files in set
// 		XXX a simplification...
//
// The gap size must be above overflow_gap, and if it is set to false 
// then no limit is used (default: OVERFLOW_GAP).
// If check_1st is false then also check the lowest sequence number
// for proximity to 0001 (default: CHECK_1ST_PROXIMITY).
//
// NOTE: if any of the above conditions is not applicable this will
// 		essentially revert to sortImagesByFileSeqOrName(...)
// NOTE: this will cut at the largest gap between sequence numbers.
//
// XXX it would be a good idea to account for folder name sequencing...
// XXX it's also a good idea to write an image serial number sort...
// XXX is this overcomplicated???
//
// NOTE: I like this piece if code, if it works correctly no one will 
// 		ever know it's here, if we replace it with the thee line dumb
// 		sortImagesByFileName(...) then things get "annoying" every 10K 
// 		images :)
function sortImagesByFileNameSeqWithOverflow(reverse, proximity, overflow_gap, check_1st){
	proximity = proximity == null ? PROXIMITY : proximity
	overflow_gap = overflow_gap == null ? OVERFLOW_GAP : overflow_gap
	check_1st = check_1st == null ? CHECK_1ST_PROXIMITY : check_1st

	// prepare to sort and check names...
	// NOTE: we do not usually have a filename seq 0000...
	if(DATA.order.length < 9999){
		var need_to_fix = true

		function cmp(a, b){
			if(need_to_fix){
				if(typeof(getImageNameSeq(a)) == typeof('str') 
						|| typeof(getImageNameSeq(b)) == typeof('str')){
					need_to_fix = false
				}
			}
			return imageSeqOrNameCmp(a, b)
		}

	// revert to normal sort my name...
	} else {
		// XXX make this more cleaver -- split the set into 10K chunks and
		// 		sort the chunks too...
		return sortImagesByFileName(reverse)
	}

	DATA.order.sort(cmp)

	// find and fix the gap...
	if(need_to_fix 
			// check if first and last are close to 0001 and 9999 resp.
			// XXX alternatively check the difference between first and 
			// 		last elements, if it is far greater than the number 
			// 		of elements then it's likely that we need to split...
			&& (!check_1st || getImageNameSeq(DATA.order[0]) <= proximity)
			&& getImageNameSeq(DATA.order[DATA.order.length-1]) >= 9999-proximity){
		// find the largest gap position...
		var pos = null
		var gap = 0
		for(var i=1; i<DATA.order.length; i++){
			var n_gap = Math.max(getImageNameSeq(DATA.order[i])-getImageNameSeq(DATA.order[i-1]), gap)
			if(n_gap != gap){
				pos = i
				gap = n_gap
			}
		}
		// split and rearrange the order chunks...
		if(overflow_gap === false || gap > overflow_gap){
			DATA.order = DATA.order.splice(pos).concat(DATA.order)
		}
	}
	if(reverse){
		DATA.order.reverse()
	}

	updateRibbonOrder()
}



/************************************************** Manual sorting ***/

// Ordering images...
// NOTE: this a bit more complicated than simply shifting an image 
// 		left/right the DATA.order, we have to put it before or after
// 		the prev/next image...
function horizontalShiftImage(image, direction){
	image = image == null ? getImage() : $(image)
	var gid = getImageGID(image)
	var r = getRibbonIndex(image)
	var ri = DATA.ribbons[r].indexOf(gid)

	// the image we are going to move relative to...
	var target = DATA.ribbons[r][ri + (direction == 'next' ? 1 : -1)]

	// we can hit the end or start of the ribbon...
	if(target == null){
		return image
	}

	// update the order...
	// NOTE: this is a critical section and must be done as fast as possible,
	// 		this is why we are using the memory to first do the work and 
	// 		then push it in...
	// NOTE: in a race condition this may still overwrite the order someone
	// 		else is working on, the data will be consistent...
	var order = DATA.order.slice()
	order.splice(order.indexOf(gid), 1)
	order.splice(order.indexOf(target) + (direction == 'next'? 1 : 0), 0, gid)
	// do the dirty work...
	DATA.order.splice.apply(DATA.order, [0, DATA.order.length].concat(order))

	// just update the ribbons, no reloading needed...
	updateRibbonOrder(true)

	// shift the images...
	getImage(target)[direction == 'prev' ? 'before' : 'after'](image)

	// update stuff that changed, mainly order...
	updateImages()

	return image
}
function shiftImageLeft(image){
	return horizontalShiftImage(image, 'prev')
}
function shiftImageRight(image){
	return horizontalShiftImage(image, 'next')
}






/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
