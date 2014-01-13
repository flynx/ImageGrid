/**********************************************************************
* 
*
*
**********************************************************************/

// list of bookmarked gids...
//
// NOTE: this must be sorted in the same order as DATA.order
var BOOKMARKS = [] 

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

var getBookmarked = makeMarkedLister(function(){ return BOOKMARKS })
var getUnbookmarked = makeUnmarkedLister(function(){ return BOOKMARKS }) 

var getBookmarkedGIDBefore = makeGIDBeforeGetterFromList(
		function(){ 
			return BOOKMARKS 
		})



/*********************************************************************/

function cropBookmarkedImages(cmp, keep_ribbons, keep_unloaded_gids){
	cropDataTo(BOOKMARKS.slice(), keep_ribbons, keep_unloaded_gids)

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
		'togglingBookmark',
		function(gid, action){
			// add a bookmark...
			if(action == 'on'){
				if(BOOKMARKS.indexOf(gid) == -1){
					insertGIDToPosition(gid, BOOKMARKS)
				}

			// remove a bookmark...
			} else {
				BOOKMARKS.splice(BOOKMARKS.indexOf(gid), 1)
			}

			bookmarksUpdated()
		})


// focus next/prev bookmark...
//
var nextBookmark = makeNextFromListAction(
		getBookmarkedGIDBefore, 
		function(){ return BOOKMARKS })
var prevBookmark = makePrevFromListAction(
		getBookmarkedGIDBefore, 
		function(){ return BOOKMARKS })



/**********************************************************************
* Files...
*/

var loadFileBookmarks = makeFileLoader(
		'Bookmarks', 
		BOOKMARKS_FILE_DEFAULT, 
		BOOKMARKS_FILE_PATTERN, 
		[[], {}],
		function(data){ 
			BOOKMARKS = data[0]
			BOOKMARKS_DATA = data[1]
		})


var saveFileBookmarks = makeFileSaver(
		'Bookmarks',
		BOOKMARKS_FILE_DEFAULT, 
		function(){ 
			return [
				BOOKMARKS, 
				BOOKMARKS_DATA
			] 
		})


function bookmarksUpdated(){
	fileUpdated('Bookmarks')
	$('.viewer').trigger('bookmarksUpdated')
}



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
			'Bookmarked (ctrl-B)')
		.click(function(){ toggleBookmark() })

	return viewer
		.on('sortedImages', function(){
			BOOKMARKS = fastSortGIDsByOrder(BOOKMARKS)
		})
}
SETUP_BINDINGS.push(setupBookmarks)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
