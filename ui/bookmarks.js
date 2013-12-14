/**********************************************************************
* 
*
*
**********************************************************************/

// list of bookmarked gids...
var BOOKMARKS= [] 

// bookmark data
//
// NOTE: elements are added here only when some data is set, use 
// 		BOOKMARKS, as the main structure.
var BOOKMARKS_DATA = {}

var BOOKMARKS_FILE_DEFAULT = 'bookmarked.json'
var BOOKMARKS_FILE_PATTERN = /^[0-9]*-bookmarked.json$/



/**********************************************************************
* Helpers
*/

// This is the same as getGIDBefore(..) but will return the currently 
// loaded and bookmarked image before current.
//
// for exact protocol see: getGIDBefore(..)
//
// XXX argument processing...
function getBookmarkedGIDBefore(gid){
	if(BOOKMARKS.length == 0){
		return null
	}
	gid = gid == null ? getImageGID() : gid
	var prev

	// need to account for cropping here...
	do {
		prev = getGIDBefore(gid, BOOKMARKS)
		gid = getGIDBefore(prev)
	} while(prev != gid && prev != null)

	// no bookmarks before current image...
	if(prev == null){
		return prev
	}

	return prev
}



/*********************************************************************/

function cropBookmarkedImages(cmp, keep_ribbons, no_cleanout_marks){
	cropDataTo(BOOKMARKS.slice(), keep_ribbons, no_cleanout_marks)

	return DATA
}


// update image bookmark state...
var updateBookmarkedImageMark = makeMarkUpdater(
		'bookmarked',
		'bookmark', 
		function(gid){ 
			return BOOKMARKS.indexOf(gid) > -1 
		})



/*********************************************************************/
// XXX not sure that these should be modes...

var toggleBookmarkedOnlyView = makeCropModeToggler(
		'bookmarked-only-view',
		cropBookmarkedImages)


var toggleBookmarkedOnlyWithRibbonsView = makeCropModeToggler(
		'bookmarked-only-view',
		function(){
			cropBookmarkedImages(null, true)
		})



/**********************************************************************
* Actions
*/

// NOTE: this can be called without arguments (affects current image) or
// 		passed either an image object or a gid...
var toggleBookmark = makeMarkToggler(
		'bookmarked', 
		'bookmark', 
		'togglingBookmark')


// focus previous bookmark...
//
function nextBookmark(){
	if(BOOKMARKS.length == 0){
		flashIndicator('end')
		return getImage()
	}
	var cur = getImageGID()
	var next = getBookmarkedGIDBefore(cur)
	var i = BOOKMARKS.indexOf(next)+1

	// we are before the first loaded bookmark, find the first...
	while((next == cur || next == null) && i < BOOKMARKS.length){
		next = BOOKMARKS[i]
		next = getBookmarkedGIDBefore(next)
		i++
	}

	// did not find any loaded bookmarks after...
	if(i >= BOOKMARKS.length && (next == null || next == cur)){
		flashIndicator('end')
		return getImage(cur)
	}

	return showImage(next)
}


// focus previous bookmark...
//
function prevBookmark(){
	if(BOOKMARKS.length == 0){
		flashIndicator('start')
		return getImage(cur)
	}
	var cur = getImageGID()
	var prev = getBookmarkedGIDBefore(cur)

	// nothing bookmarked before us...
	if(prev == null){
		flashIndicator('start')
		return getImage(cur)
	}

	// current image is bookmarked, get the bookmark before it...
	if(prev == cur){
		prev = BOOKMARKS[BOOKMARKS.indexOf(prev)-1]
		prev = prev != null ? getBookmarkedGIDBefore(prev) : prev
		// no loaded (crop mode?) bookmark before us...
		if(prev == null){
			flashIndicator('start')
			return getImage(cur)
		}
	}

	return showImage(prev)
}



/**********************************************************************
* Files...
*/

var loadFileBookmarks = makeFileLoader(
		'Bookmarks', 
		BOOKMARKS_FILE_DEFAULT, 
		BOOKMARKS_FILE_PATTERN, 
		function(data){ 
			BOOKMARKS = data[0] == null ? [] : data[0]
			BOOKMARKS_DATA = data[1] == null ? {} : data[1]
		})


var saveFileBookmarks = makeFileSaver(
		BOOKMARKS_FILE_DEFAULT, 
		function(){ 
			return [
				BOOKMARKS, 
				BOOKMARKS_DATA
			] 
		})



/**********************************************************************
* Setup...
*/

// setup event handlers for the bookmark framework...
//
function setupBookmarks(viewer){
	console.log('Bookmarks: setup...')

	// XXX make this viewer specific...
	makeContextIndicatorUpdater('bookmarked')

	// XXX make this viewer specific...
	showContextIndicator(
			'current-image-bookmarked', 
			'Image is bookmarked (ctrl-B)')
		.click(function(){ toggleBookmark() })

	return viewer
		.on('togglingBookmark', function(evt, gid, action){
			// add a bookmark...
			if(action == 'on'){
				if(BOOKMARKS.indexOf(gid) == -1){
					BOOKMARKS.push(gid)
					// XXX is this too expensive???
					// 		...a way to avoid sorting is to:
					// 			BOOKMARKS.splice(
					// 				getGIDBefore(gid, BOOKMARKS)+1, 0, gid)
					BOOKMARKS.sort(imageOrderCmp)
				}

			// remove a bookmark...
			} else {
				BOOKMARKS.splice(BOOKMARKS.indexOf(gid), 1)
			}
		})
		.on('sortedImages', function(){
			BOOKMARKS.sort(imageOrderCmp)
		})
}
SETUP_BINDINGS.push(setupBookmarks)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
