/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> actions')

var actions = require('lib/actions')



/*********************************************************************/
//
// Action variables:
//
// 	SCREEN_IMAGES		
// 		- screen width in images
// 		- resolves to number
// 		
// 	CURRENT				
// 		- current image
// 		- resolves to gid
// 		- support basic math: +/-
// 			e.g. CURRENT + 1	~ next image
//
// 	RIBBON				
// 		- current ribbon
// 		- resolves to gid
// 		- support basic math: +/-
//
// 	BASE				
// 		- base ribbon
// 		- resolves to gid
// 		- support basic math: +/-
//
//
// XXX add action variables!!!
var SCREEN_IMAGES = null




/*********************************************************************/

// XXX need a way to define compound actions...
// 		- compound action is like a normal action with a set of other 
// 			actions chanined to it's main event.
// 		- actions should accept arguments, both optional and required
var BASE_ACTIONS =
module.BASE_ACTIONS = {
	// basic editing...
	shiftImageUp: 
		'Shift image to the ribbon above current, creating one if '
		+'it does not exist',
	shiftImageDown:
		'Shift image to the ribbon below current, creating one if '
		+'it does not exist',
	shiftImageUpNewRibbon: 
		'Create an empty ribbon above and shift the image into it',
	shiftImageDownNewRibbon:
		'Create an empty ribbon below and shift the image into it',
	shiftImageLeft: 'Shift image to the left',
	shiftImageRight: 'Shift image to the right',

	shiftRibbonUp: 'Move current ribbon one position up',
	shiftRibbonDown: 'Move current ribbon one position down',

	// XXX
	sortImages: '',
	reverseImages: '',
	setAsBaseRibbon: '',

	// image adjustments...
	rotateCW: '',
	rotateCCW: '',
	flipVertical: '',
	flipHorizontal: '',

	// external editors/viewers...
	systemOpen: '',
	openWith: '',

	// crop...
	// XXX should this be here on in a crop pligin...
	cropRibbon: '',
	cropCurrentRibbonAndAbove: '',
	uncropView: 'Uncrop to previous crop',
	uncropAll: 'Uncrop to base',
	uncropViewAndKeepOrder: 
		'Uncrop view to previous crop, keeping current image order',
	uncropAllAndKeepOrder: 'Uncrop to base, keeping current image order',

	openURL: '',
	//openHistory: '',

	saveOrder: '',
	saveState: '',
	exportImages: '',

	exit: '',
}



/*********************************************************************/

var UI_ACTIONS =
module.UI_ACTIONS = {
	focusImage: '',
	focusRibbon: '',

	// basic navigation...
	nextImage: ['Focus next image in current ribbon', { focusImage: 'next' }],
	nextRibbon: ['Focus next ribbon (down)', { focusRibbon: 'next' }],
	// XXX actions vars...
	nextScreen: ['Show next screen width of images', { focusImage: SCREEN_IMAGES }],

	prevImage: ['Focus previous image in current ribbon', { focusImage: 'prev' }],
	prevRibbon: ['Focus previous ribbon (up)', { focusRibbon: 'prev' }],
	// XXX actions vars...
	prevScreen: ['Show previous screen width of images', { focusImage: -SCREEN_IMAGES }],

	firstImage: 'Focus first image in ribbon',
	lastImage: 'Focus last image in ribbon',

	// zooming...
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',

	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	fitImage: 'Fit image',

	// XXX should these be relative to screen rather than actual image counts?
	fitTwo: ['Fit two images', { fitImage: 2, }],
	fitThree: ['Fit three images', { fitImage: 3, }],
	fitFour: ['Fit four images', { fitImage: 4, }],
	fitFive: ['Fit five images', { fitImage: 5, }],
	fitSix: ['Fit six images', { fitImage: 6, }],
	fitSeven: ['Fit seven images', { fitImage: 7, }],
	fitEight: ['Fit eight images', { fitImage: 8, }],
	fitNine: ['Fit nine images', { fitImage: 9, }],

	fitMax: 'Fit the maximum number of images',

	fitSmall: 'Show small image',
	fitNormal: 'Show normal image',
	fitScreen: 'Fit image to screen',

	// modes...
	singleImageMode: 'Show single image',
	ribbonMode: 'Show ribbon',

	toggleTheme: 'Toggle themes',

	// dialogs...
	// XXX move to specific blocks...
	openDialog: 'Show open diaolg',
	historyDialog: 'Show history dialog',
	cropDialog: 'Show crop dialog',

	// panels...
	togglePanels: '',
	showInfoPanel: '',
	showTagsPanel: '',
	showSearchPanel: '',
	showQuickEditPanel: '',
	showStatesPanel: '',
	showHistoryPanel: '',
	showDirBrowserPanel: '',
	showConsolePanel: '',

	// developer actions...
	showConsole: 'Show application console',
	showDevTools: 'Show development tools',
}


/*********************************************************************/

// Marks actions...
// XXX move to marks.js
var MARKS_ACTIONS =
module.MARKS_ACTIONS = {
	toggleMark: '',
	toggleMarkBlock: '',

	nextMarked: '',
	prevMarked: '',
	nextMarkedInRibbon: '',
	prevMarkedInRibbon: '',

	markRibbon: '',
	unmarkRibbon: '',
	markAll: '',
	unmarkAll: '',
	invertMarkedRibbon: '',
	invertMarkedAll: '',

	// placing...
	placeMarkedAfter: 'Place marked images after current',
	placeMarkedBefore: 'Place marked images before current',

	shiftMarkedUp: '',
	shiftMarkedDown: '',
	shiftMarkedLeft: '',
	shiftMarkedRight: '',
	shiftMarkedUpNewRibbon: '',
	shiftMarkedDownNewRibbon: '',

	cropMarkedImages: '',
	cropMarkedImagesToSingleRibbon: '',

	markDialog: 'Show mark dialog',
	placeMarkedDialog: '',
}



/*********************************************************************/

// Bookmarks actions...
// XXX move to bookmarks.js
var BOOKMARKS_ACTIONS =
module.BOOKMARKS_ACTIONS = {
	toggleBookmark: 'Toggle image bookmark',

	nextBookmarked: '',
	prevBookmarked: '',
	nextBookmarkedInRibbon: '',
	prevBookmarkedInRibbon: '',

	bookmarkMarked: 'Bookmark marked images',
	unbookmarkMarked: 'Remove bookmarks from marked images',
	toggleBookmarkMarked: 'Toggle bookmarks on marked images',

	clearRibbonBookmarks: 'Remove bookmarks in ribbon',
	clearAllBookmarks: 'Clear all bookmarks',

	cropBookmarkedImages: '',
	cropBookmarkedImagesToSingleRibbon: '',
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
