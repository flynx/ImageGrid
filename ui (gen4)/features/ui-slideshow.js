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
		'ui-slideshow-looping': 'on',
		'ui-slideshow-direction': 'forward',
		'ui-slideshow-interval': '3s',

		'ui-slideshow-saved-intervals': [
			'0.2s',
			'3s',
			'5s',
			'7s',
		],
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
	// XXX add a custom setting...
	// XXX STUB
	selectSlideshowInterval: ['Slideshow/Interval',
		core.makeConfigToggler('ui-slideshow-interval', 
			function(){ return this.config['ui-slideshow-saved-intervals'] })],

	toggleSlideshowDirection: ['Slideshow/Direction',
		core.makeConfigToggler('ui-slideshow-direction', ['forward', 'reverse'])],
	toggleSlideshowLooping: ['Slideshow/Looping',
		core.makeConfigToggler('ui-slideshow-looping', ['on', 'off'])],

	// XXX should this save/load a tmp workspace or a dedicated slideshow workspace???
	toggleSlideshow: ['Slideshow/Start',
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			'slideshow-running',
			function(state){
				// start...
				if(state == 'on'){
					var that = this

					// reset the timer...
					// NOTE: this means we were in a slideshow mode so we do not
					// 		need to prepare...
					if(this.__slideshouw_timer){
						clearTimeout(this.__slideshouw_timer)
						delete this.__slideshouw_timer

					// prepare for the slideshow...
					} else {
						// save current workspace...
						this.__pre_slideshow_workspace = this.workspace
						this.saveWorkspace() 

						// construct the slideshow workspace if it does not exist...
						if(this.workspaces['slideshow'] == null){
							this.toggleChrome('off')
							this.saveWorkspace('slideshow') 

						// load the slideshow workspace...
						} else {
							this.loadWorkspace('slideshow')
						}
				
						// single image mode...
						this.toggleSingleImage('on')
					}

					// start the timer... 
					// XXX might be a good idea to add a pause button for either
					// 		"toggle" or "hold to pause" mode...
					this.__slideshouw_timer = setInterval(function(){
						var cur = that.current

						// next step...
						that.config['ui-slideshow-direction'] == 'forward' ?
							that.nextImage()
							: that.prevImage()

						// we have reached the end...
						if(that.current == cur && that.config['ui-slideshow-looping'] == 'on'){
							that.config['ui-slideshow-direction'] == 'forward' ?
								that.firstImage()
								: that.lastImage()
						}
					}, Date.str2ms(this.config['ui-slideshow-interval'] || '3s'))

				// stop...
				} else {
					// stop timer...
					this.__slideshouw_timer
						&& clearTimeout(this.__slideshouw_timer)
					delete this.__slideshouw_timer

					// XXX should this be a dedicated slideshow workspace??
					this.__pre_slideshow_workspace &&
						this.loadWorkspace(this.__pre_slideshow_workspace)
					delete this.__pre_slideshow_workspace
				}
			})],
	resetSlideshowTimer: ['- Slideshow/Restart slideshow timer',
		function(){
			this.__slideshouw_timer && this.toggleSlideshow('on')
		}],
})


var Slideshow = 
module.Slideshow = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-slideshow',
	depends: [
		'workspace',
		'ui',
		'ui-single-image-view',
	],

	actions: SlideshowActions,

	handlers: [
		['stop',
			function(){ this.toggleSlideshow('off') }]
	],
})





/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
