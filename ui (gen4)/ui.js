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
			alt: doc('Close viewer', 
				function(){ 
					window.close() 
					return false
				}),
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
		F12: doc('Show devTools', 
			function(){ 
				if(window.showDevTools != null){
					showDevTools() 
					return false

				// if no showDevTools defined pass the button further...
				} else {
					return true
				}
			}),
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		R: {
			/*
			'ctrl+alt': doc('Reload viewer', 
				function(){ 
					reloadViewer() 
					return false
				}),
			*/
			'ctrl+shift': 'F5',
		},
		P: {
			'ctrl+shift': 'F12',
		},

		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: doc('Toggle full screen view', function(){ 
				toggleFullscreenMode() 
				return false
			}),
		F: {
			ctrl: 'F11',
		},

		// XXX testing...
		Home: doc('', function(){ a.firstImage() }),
		End: doc('', function(){ a.lastImage() }),
		Left: doc('', function(){ a.prevImage() }),
		Right: doc('', function(){ a.nextImage() }),
		Up: {
			default: doc('', function(){ a.prevRibbon() }),
			shift: doc('', function(){ a.shiftImageUp() }),
		},
		Down: {
			default: doc('', function(){ a.nextRibbon() }),
			shift: doc('', function(){ a.shiftImageDown() }),
		}

	},
}	



/*********************************************************************/

$(function(){
	// setup base keyboard for devel, in case something breaks...
	$(document)
		.keydown(
			keyboard.makeKeyboardHandler(
				module.GLOBAL_KEYBOARD,
				function(k){
					window.DEBUG && console.log(k)
				}))

	window.a = testing.setupActions()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
