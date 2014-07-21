/**********************************************************************
* 
*
*
**********************************************************************/

window.isNodeWebKit = (typeof(process) === 'object' && process.features.uv) ? true : false


define(function(require){ var module = {}
console.log('>>> ui')

//var DEBUG = DEBUG != null ? DEBUG : true

var browser = require('browser')
var nw = require('nw')

var keyboard = require('lib/keyboard')
var doc = keyboard.doc



/*********************************************************************/

window.GLOBAL_KEYBOARD = {
	'Global bindings': {
		doc: 'NOTE: binding priority is the same as the order of sections '+
			'on this page.',
		pattern: '*',

		F4: {
			alt: doc('Close viewer', 
				function(){ 
					closeWindow() 
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
				reload()
				return false
			}),
		F12: doc('Show devTools', 
			function(){ 
				showDevTools() 
				return false
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
