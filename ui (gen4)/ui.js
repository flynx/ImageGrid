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
			default: 'reverseImages!',
			ctrl: 'reload!',
			'ctrl+shift': 'F5',
		},
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
		Home: {
			default: 'firstImage',
			ctrl: 'firstRibbon',
		},
		End: {
			default: 'lastImage',
			ctrl: 'lastRibbon',
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
			ctrl: 'fitOrig!',
		},
		'#2': 'fitTwo',
		'#3': 'fitThree',
		'#4': 'fitFour',
		'#5': 'fitFive',
		'#6': 'fitSix',
		'#7': 'fitSeven',
		'#8': 'fitEight',
		'#9': 'fitNine',
		
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

	window.a = testing.setupActions()

	viewer.RibbonAlignToOrder.setup(a)
	//viewer.RibbonAlignToFirst.setup(a)
	viewer.ShiftAnimation.setup(a)
	viewer.BoundsIndicators.setup(a)

	// this publishes all the actions...
	//module.GLOBAL_KEYBOARD.__proto__ = a


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
