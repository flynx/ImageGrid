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
//
// Contexts:
// 				Browser		node		node-webkit		PhoneGap
// 	UI			o			x			o				o
// 	navigation	o			o			o				o
// 	edit		o, x		o			o, x			o, x
//
//
// The basic inheritance tree should be something like this:
//
//							.
//					   Data . UI
//							.
//		MetaActions			.
//			^				.
//			|				.
//			|				.
// 		BaseActions			.
// 			^	^			.
// 			|	+------------------ UIActions
//			|				.			^
//			|				.			|	   -+
// 		BaseMarks			.			|		|
// 				^			.			|		| Plugin
// 				+ - - - - -???- - - UIMarks		|
//							.				   -+
//							.
//
//
// XXX Need a way to combine a set of features into a view, preferably
// 		in runtime...
// 			- turn feature on/off at load
// 			- turn feature on/off in runtime
//
// XXX without multiple inheritance we'll need to either:
//
// 		- build inheritance chains per task -- i.e. connect blocks in 
// 		  a custom way depending on use
// 		  ...this makes it really hard to have two systems configured 
// 		  differently in the same runtime...
//
// 		- build a multiple inheritance system
// 		  ...without the ability to hook into attribute access this is
// 		  not trivial... (feasibility unknown)
//
// 		- make the UI versions by copying methods from the base and UI 
// 		  into a single object, effectively creating two separate chains
// 		  ...auto-creating proxy methods is another way to implement this
// 		  	+ solves the problem
// 		  	- not dynamic -- changes have to be applied to both chains 
// 		  	  rather than to a single relevant object.
//
// 		- encapsulate and proxy?
//
// 		- static mixin...
//
//
// XXX actions should be split by feature
//	 		- basic navigation
// 			- basic editing
// 			- cropping
// 			- marking
// 			- bookmarking
// 			- tagging
// 			- image editing
// 			- url loading
// 			- url saving
// 			- fs loading
// 			- fs saving
// 		Features can be organized into contexts:
// 			- browser viewer
// 			- browser editor
// 			- app viewer
// 			- app editor
//
// XXX each plugin must be split into:
// 		- UI view -- display only
// 		- UI controls -- edit
// 		- base actions -- usable without UI
//
// XXX think about life-cycle...
//
//
/*********************************************************************/

var BaseActions =
module.BaseActions = actions.Actions({
	// state props...
	get current(){
		// XXX should this return a gid or a jQuery-like object for 
		// 		image-oriented operations???
		return this.data.current
	},
	set current(val){
		return this.focusImage(val)
	},

	// life-cycle / state...
	// XXX

	// actions...
	focusImage: '',
	focusRibbon: '',

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
})



/*********************************************************************/

var UIActions =
module.UIActions = {

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
