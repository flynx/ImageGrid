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
	})
}



define(function(require){ var module = {}
console.log('>>> ui')

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('lib/keyboard')
var doc = keyboard.doc

// compatibility...
var browser = require('browser')
var nw = require('nw')

// XXX load only the actualy used here modules...
var actions = require('actions')
var data = require('data')
var ribbons = require('ribbons')


// XXX 
var testing = require('testing')


var client = require('client')

var viewer = require('viewer')

//var promise = require('promise')


// widgets...
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/

// XXX move this to config...
// NOTE: setting this here (and only here) to -1 or null will desable 
// 		key dropping...
// NOTE: keeping this disabled is recommended for development...
module.MAX_KEY_REPEAT_RATE = 0 //100

// XXX add this to the global doc...
module.GLOBAL_KEYBOARD = {
	'Global bindings': {
		doc: 'NOTE: binding priority is the same as the order of sections '+
			'on this page.',
		pattern: '*',

		F4: {
			alt: 'close',
			/*
			alt: doc('Close viewer', 
				function(){ 
					window.close() 
					return false
				}),
			*/
		},
		Q: {
			meta: 'close',
		},
		F5: doc('Full reload viewer', 
			function(){ 
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
		H: 'flipHorizontal',
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
			ctrl: 'toggleMark!: "ribbon" "on"',
		},
		D: {
			ctrl: 'toggleMark!: "ribbon" "off"',
		},
		I: {
			ctrl: 'toggleMark!: "ribbon"',

			'meta+alt': 'showDevTools',
		},
		
		B: {
			default: 'toggleBookmark',
			ctrl: 'toggleTheme!',
			alt: 'browseActions: "/Bookmark/"',
		},
	},
}	



/*********************************************************************/

$(function(){

	// XXX
	window.a = testing.setupActions()
		.load({
			viewer: $('.viewer')
		})

	// used switch experimental actions on (set to true) or off (unset or false)...
	//a.experimental = true

	// XXX for some reason this is not visible when loading...
	a.setEmptyMsg('Loading...')

	viewer.ImageGridFeatures.setup(a, [
		'viewer-testing',

		// XXX this is not for production...
		'experiments',
	])
	
	// this publishes all the actions...
	//module.GLOBAL_KEYBOARD.__proto__ = a

	// load some testing data...
	// NOTE: we can load this in parts...
	a
		.load({
			//viewer: $('.viewer'),
			data: data.Data(testing.mock_data),
			images: testing.makeTestImages(),
		})
		// this is needed when loading legacy sources that do not have tags
		// synced...
		// do not do for actual data...
		//.syncTags()


	a.setEmptyMsg(
		'Nothing loaded...',
		'Press \'O\' to load, \'F1\' for help or \'?\' for keyboard mappings.')


	// setup base keyboard for devel, in case something breaks...
	if(module.MAX_KEY_REPEAT_RATE < 0 || module.MAX_KEY_REPEAT_RATE == null){
		$(document)
			.keydown(
				keyboard.makeKeyboardHandler(
					module.GLOBAL_KEYBOARD,
					function(k){
						window.DEBUG && console.log(k)
					}, 
					a))

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
						// XXX get this from config...
						return module.MAX_KEY_REPEAT_RATE
					}))
	}
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
