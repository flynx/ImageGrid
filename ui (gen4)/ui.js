/**********************************************************************
* 
*
*
**********************************************************************/

window.isNodeWebKit = (typeof(process) === 'object' && process.features.uv) ? true : false


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



/*********************************************************************/

window.GLOBAL_KEYBOARD = {
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
	},
}	



/*********************************************************************/

$(function(){
	// setup base keyboard for devel, in case something breaks...
	$(document)
		.keydown(
			keyboard.makeKeyboardHandler(
				GLOBAL_KEYBOARD,
				function(k){
					window.DEBUG && console.log(k)
				}))
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
