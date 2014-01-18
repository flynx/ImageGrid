/**********************************************************************
* 
*
*
**********************************************************************/

// list of bookmarked gids...
//
// NOTE: this is a sparse list, see marks.js MARKED for more info and
// 		motivation...
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
var getUnbookmarked = makeUnmarkedSparseLister(function(){ return BOOKMARKS }) 

var getBookmarkedGIDBefore = makeGIDBeforeGetterFromList(
		function(){ 
			return compactSparceList(BOOKMARKS)
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
					BOOKMARKS[DATA.order.indexOf(gid)] = gid
				}

			// remove a bookmark...
			} else {
				delete BOOKMARKS[BOOKMARKS.indexOf(gid)]
			}

			bookmarksUpdated()
		})


// focus next/prev bookmark...
//
var nextBookmark = makeNextFromListAction(
		getBookmarkedGIDBefore, 
		function(){ return compactSparceList(BOOKMARKS) })
var prevBookmark = makePrevFromListAction(
		getBookmarkedGIDBefore, 
		function(){ return compactSparceList(BOOKMARKS) })



/**********************************************************************
* Files...
*/

var loadFileBookmarks = makeFileLoader(
		'Bookmarks', 
		BOOKMARKS_FILE_DEFAULT, 
		BOOKMARKS_FILE_PATTERN, 
		[[], {}],
		function(data){ 
			BOOKMARKS = populateSparceGIDList(data[0])
			BOOKMARKS_DATA = data[1]
		})


var saveFileBookmarks = makeFileSaver(
		'Bookmarks',
		BOOKMARKS_FILE_DEFAULT, 
		function(){ 
			return [
				compactSparceList(BOOKMARKS), 
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
			BOOKMARKS = populateSparceGIDList(BOOKMARKS)
			bookmarksUpdated()
		})
		.on('horizontalShiftedImage', function(evt, gid, direction){
			if(shiftGIDInSparseList(gid, BOOKMARKS)){
				bookmarksUpdated()
			}
		})
}
SETUP_BINDINGS.push(setupBookmarks)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
