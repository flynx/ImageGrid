/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/

// XXX stub...
var SlideshowActions = actions.Actions({
	config: {
	},

	// XXX
	// 	/Slideshow/
	// 		Interval (3)/				-- not a toggler
	// 			0.2
	// 			1
	// 			3*
	// 			5
	// 			Custom...				-- click to edit
	// 		Direction (forward)/
	// 			forward*
	// 			revrse
	// 		Looping (on)/
	// 			on*
	// 			off
	// 		Start
	// XXX need to set the default value in title...
	// XXX might be a good idea to make this with an editable value...
	// 		i.e.
	// 			Interval: 3s /		-- 3s is editable...
	// 				0.2		x		-- a history of values that can be 
	// 									selected w/o closing the dialog
	// 									or can be removed...
	// 				1		x
	// 				3		x
	// 				Custom...		-- editable/placeholder... 'enter' 
	// 									selects value and adds it to 
	// 									history...
	selectSlideshowInterval: ['Slideshow/Interval/*',
		// XXX make this a custom menu rather than a lister... (???)
		function(path, make){
			make('0.2') 
			make('1') 
			make('3') 
			make('Custom...') 
		}],
	toggleSlideshowDirection: ['Slideshow/Direction',
		function(){}],
	toggleSlideshowLooping: ['Slideshow/Looping',
		function(){}],
	toggleSlideshow: ['Slideshow/Start',
		function(){}],
})


var Slideshow = 
module.Slideshow = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-slideshow',
	depends: [
		'ui',
	],

	actions: SlideshowActions,
})





/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
