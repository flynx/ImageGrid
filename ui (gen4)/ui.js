/**********************************************************************
* 
*
*
**********************************************************************/

window.nodejs = (typeof(process) === 'object' && process.features.uv) 
	? {
		require: window.require,
	} 
	: null


// XXX for some reason requirejs does not fall back to node's require...
if(nodejs){
	var requirejs = require('requirejs')

	requirejs.config({
		nodeRequire: require,
		//baseUrl: __dirname,

		// XXX this does not work on direct filesystem access...
		//urlArgs: 'bust='+Date.now(),
	})
}



define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('lib/keyboard')
var doc = keyboard.doc

// compatibility...
var browser = require('browser')
var nw = require('nw')

// XXX load only the actualy used here modules...
var actions = require('lib/actions')
var data = require('data')
var ribbons = require('ribbons')


// XXX 
var testing = require('testing')

var viewer = require('viewer')

//var promise = require('promise')



/*********************************************************************/

// XXX move this to config...
// NOTE: setting this here (and only here) to -1 or null will desable 
// 		key dropping...
// NOTE: keeping this disabled is recommended for development...
// NOTE: setting this to 0 will only allow a single keypress per 
// 		execution frame...
// 		XXX yes there should be only one execution frame per event 
// 			triggered but this actually improves things, thus the issue 
// 			needs more investigation...
module.MAX_KEY_REPEAT_RATE = 0

// XXX add this to the global doc...
module.GLOBAL_KEYBOARD = {
	'Slideshow': {
		pattern: '.slideshow-running',
		ignore: [
			'Up', 'Down', 'Enter',
			'R', 'L',
		],

		Esc: 'toggleSlideshow: "off"',
		Enter: 'slideshowDialog',

		Left: 'resetSlideshowTimer',
		Right: 'resetSlideshowTimer',
		Home: 'resetSlideshowTimer',
		End: 'resetSlideshowTimer',

		R: 'toggleSlideshowDirection',
		L: 'toggleSlideshowLooping',
	},

	'Global': {
		doc: 'NOTE: binding priority is the same as the order of sections '+
			'on this page.',
		pattern: '*',

		F4: {
			alt: 'close',
		},
		Q: {
			meta: 'close',
		},
		F5: doc('Full reload viewer', 
			function(){ 
				//a.stop()
				/*
				killAllWorkers()
					.done(function(){
						reload() 
					})
				*/
				location.reload()
				return false
			}),
		F12: 'showDevTools',
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		R: {
			default: 'rotateCW',
			shift: 'reverseImages',
			ctrl: 'reload!',
			'ctrl+shift': 'F5',
		},
		L: 'rotateCCW',
		H: {
			default: 'flipHorizontal',
			ctrl: 'listURLHistory',
			alt: 'browseActions: "/History/"',
		},
		V: 'flipVertical',
		P: {
			'ctrl+shift': 'F12',
		},

		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: 'toggleFullScreen', 
		F: {
			ctrl: 'F11',
			meta: 'F11',
		},

		// XXX testing...

		Enter: 'toggleSingleImage',

		Home: {
			default: 'firstImage',
			ctrl: 'firstGlobalImage',
			shift: 'firstRibbon',
		},
		End: {
			default: 'lastImage',
			ctrl: 'lastGlobalImage',
			shift: 'lastRibbon',
		},
		Left: {
			default: 'prevImage',
			alt: 'shiftImageLeft!',
			ctrl: 'prevScreen',
			// XXX need to prevent default on mac + browser...
			meta: 'prevScreen',
		},
		PgUp: 'prevScreen',
		PgDown: 'nextScreen',
		Right: {
			default: 'nextImage',
			alt: 'shiftImageRight!',
			ctrl: 'nextScreen',
			// XXX need to prevent default on mac + browser...
			meta: 'nextScreen',
		},
		'(': 'prevImageInOrder',
		')': 'nextImageInOrder',
		',': 'prevMarked',
		'.': 'nextMarked',
		'[': 'prevBookmarked',
		']': 'nextBookmarked',
		Up: {
			default: 'prevRibbon',
			shift: 'shiftImageUp',
			'alt+shift': 'travelImageUp',
			'ctrl+shift': 'shiftImageUpNewRibbon',
		},
		Down: {
			default: 'nextRibbon',
			shift: 'shiftImageDown',
			'alt+shift': 'travelImageDown',
			'ctrl+shift': 'shiftImageDownNewRibbon',
		},

		'#0': 'fitMax',
		'#1': {
			default: 'fitImage',
			shift: 'fitRibbon',
			ctrl: 'fitOrig!',
		},
		'#2': 'fitImage: 2',
		'#3': {
			default: 'fitImage: 3',
			shift: 'fitRibbon: 3.5',
		},
		'#4': 'fitImage: 4',
		'#5': {
			default: 'fitImage: 5',
			shift: 'fitRibbon: 5.5',
		},
		'#6': 'fitImage: 6',
		'#7': 'fitImage: 7',
		'#8':'fitImage: 8',
		'#9': 'fitImage: 9',
		
		'+': 'zoomIn',
		'=': '+',
		'-': 'zoomOut',

		F2: {
			default: 'cropRibbon',
			shift: 'cropRibbonAndAbove',
			ctrl: 'cropMarked',
			alt: 'cropBookmarked',
		},
		Esc: {
			default: 'uncrop',
			ctrl: 'uncropAll',
		},

		// marking...
		M: {
			default: 'toggleMark',
			alt: 'browseActions: "/Mark/"',
		},
		A: {
			alt: 'browseActions',
			'alt+shift': 'listActions',

			ctrl: 'toggleMark!: "ribbon" "on"',
		},
		D: {
			ctrl: 'toggleMark!: "ribbon" "off"',
		},
		I: {
			default: 'showMetadata',
			shift: 'toggleStatusBar',

			ctrl: 'toggleMark!: "ribbon"',
			'ctrl+shift': 'showMetadata: "current" "full"',

			'meta+alt': 'showDevTools',
		},
		
		B: {
			default: 'toggleBookmark',
			ctrl: 'toggleTheme!',
			alt: 'browseActions: "/Bookmark/"',
		},
		E: {
			default: 'openInExtenalEditor',
			shift: 'openInExtenalEditor: 1',
			alt: 'listExtenalEditors',
		},
		C: 'browseActions: "/Crop/"',
		O: 'browsePath',
		S: {
			//default: 'browseActions: "/Slideshow/"',
			default: 'slideshowDialog',
			// XXX need to make this save to base_path if it exists and
			// 		ask the user if it does not... now it always asks.
			ctrl: 'saveIndexHere',
			'ctrl+shift': 'browseSaveIndex',
		},

		// XXX still experimental...
		U: {
			default: 'undoLast',
			shift: 'redoLast',
		},
		Z: {
			ctrl: 'undoLast',
			'ctrl+shift': 'redoLast',
		},

		G: {
			default: 'editStatusBarIndex!',
			shift: 'toggleStatusBarIndexMode!',

			// XXX for debug...
			ctrl: function(){ $('.viewer').toggleClass('visible-gid') },
		},
	},
}	



/*********************************************************************/

$(function(){

	// list all loaded modules...
	var m = requirejs.s.contexts._.defined
	m = Object.keys(m).filter(function(e){ return m[e] != null })
	console.log('Modules (%d):', m.length, m)


	// setup actions...
	window.a = viewer.ImageGridFeatures
		.setup([
			'viewer-testing',

			// XXX this is not for production...
			'experiments',
		])


	// used switch experimental actions on (set to true) or off (unset or false)...
	//a.experimental = true


	// report stuff...
	// XXX we also have .conflicts and .missing
	a.features.excluded.length > 0 
		&& console.warn('Features excluded (%d):',
			a.features.excluded.length, 
			a.features.excluded)
	console.log('Features not applicable (%d):', 
		a.features.unapplicable.length, 
		a.features.unapplicable)
	console.log('Features loaded (%d):',
		a.features.features.length, 
		a.features.features)

	a.logger = a.logger || {emit: function(e, v){ console.log('    ', e, v) }}


	// setup the viewer...
	a
		.load({ viewer: $('.viewer') })
		.setEmptyMsg('Loading...')
		.start()


	// load some testing data if nothing else loaded...
	if(!a.url_history || Object.keys(a.url_history).length == 0){
		// NOTE: we can (and do) load this in parts...
		a
			.load({
				data: data.Data(testing.mock_data),
				images: testing.makeTestImages(),
			})
			// this is needed when loading legacy sources that do not have tags
			// synced...
			// do not do for actual data...
			//.syncTags()
	}


	a.setEmptyMsg(
		'Nothing loaded...',
		'Press \'O\' to load, \'F1\' for help or \'?\' for keyboard mappings.')



	// setup base keyboard for devel, in case something breaks...
	// This branch does not drop keys...
	if(a.config['max-key-repeat-rate'] < 0 || a.config['max-key-repeat-rate'] == null){
		$(document)
			.keydown(
				keyboard.makeKeyboardHandler(
					module.GLOBAL_KEYBOARD,
					function(k){
						window.DEBUG && console.log(k)
					}, 
					a))

	// drop keys if repeating to fast...
	// NOTE: this is done for smoother animations...
	} else {
		$(document)
			.keydown(
				keyboard.dropRepeatingkeys(
					keyboard.makeKeyboardHandler(
						module.GLOBAL_KEYBOARD,
						function(k){
							window.DEBUG && console.log(k)
						},
						a), 
					function(){ 
						return a.config['max-key-repeat-rate']
					}))
	}
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
