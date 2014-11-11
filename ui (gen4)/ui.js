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



/*********************************************************************/

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
		},

		// XXX testing...

		Enter: 'toggleSingleImage',
		B: 'toggleTheme',

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
		},
		PgUp: 'prevScreen',
		PgDown: 'nextScreen',
		Right: {
			default: 'nextImage',
			alt: 'shiftImageRight!',
			ctrl: 'nextScreen',
		},
		'(': 'prevImageInOrder',
		')': 'nextImageInOrder',
		Up: {
			default: 'prevRibbon',
			shift: 'shiftImageUp',
			'ctrl+shift': 'shiftImageUpNewRibbon',
		},
		Down: {
			default: 'nextRibbon',
			shift: 'shiftImageDown',
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
		},
		Esc: {
			default: 'uncrop',
			ctrl: 'uncropAll',
		},
		
	},
}	




/*********************************************************************/

$(function(){

	// XXX
	window.a = testing.setupActions()

	viewer.Features.setup(a, [
		// XXX I do not fully understand it yet, but PartialRibbons must be 
		// 		setup BEFORE AlignRibbonsTo*, otherwise the later will break
		// 		on shifting an image to a new ribbon...
		// 			To reproduce:
		// 				- setupe RibbonAlignToFirst first
		// 				- go to top ribbon
		// 				- shift image up
		'ui-partial-ribbons',
		'ui-ribbon-align-to-order',
		'ui-single-image-view',
		'ui-animation',
		'ui-bounds-indicators',
		'ui-current-image-indicator',
	])

	// this publishes all the actions...
	//module.GLOBAL_KEYBOARD.__proto__ = a


	// load some testing data...
	a.load({
		data: data.Data(testing.mock_data),
		viewer: $('.viewer'),
		images: testing.makeTestImages(),
	})


	// setup base keyboard for devel, in case something breaks...
	$(document)
		.keydown(
			keyboard.makeKeyboardHandler(
				module.GLOBAL_KEYBOARD,
				function(k){
					window.DEBUG && console.log(k)
				}, 
				a))
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
