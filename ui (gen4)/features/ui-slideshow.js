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

var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/

// XXX still needs work...
var SlideshowActions = actions.Actions({
	config: {
		'ui-slideshow-looping': 'on',
		'ui-slideshow-direction': 'forward',
		'ui-slideshow-interval': '3s',

		'ui-slideshow-intervals': [
			'0.2s',
			'1s',
			'3s',
			'5s',
			'7s',
		],
	},

	// XXX make interval editable...
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
	// XXX BUG: there are still problems with focus...
	// 		to reproduce:
	// 			click on the first option with a mouse...
	// 		result:
	// 			the top dialog is not focused...
	slideshowDialog: ['Slideshow/Toggle and options',
		function(){
			var that = this

			this.suspendSlideshowTimer()

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
					null,
					[
						['Interval: ', 
							function(){ return that.config['ui-slideshow-interval'] }],
						['Direction: ', 
							function(){ return that.config['ui-slideshow-direction'] }],
						['Looping: ', 
							function(){ return that.config['ui-slideshow-looping'] }],

						'---',
						[function(){ 
							return that.toggleSlideshow('?') == 'on' ? 'Stop' : 'Start' }],
					])
					.open(function(evt, path){
						// start/stop...
						if(path == 'Start' || path == 'Stop'){
							that.toggleSlideshow()
							o.close()
							return
						}

						// interval...
						// XXX add custom interval editing...
						if(/interval/i.test(path)){
							var to_remove = []
							var oo = overlay.Overlay(that.ribbons.viewer, 
								browse.makeList( null, 
									that.config['ui-slideshow-intervals'], 
									{itemButtons: [
										// mark for removal...
										['&times;', 
											function(p){
												var e = this.filter('"'+p+'"', false)
													.toggleClass('strike-out')

												if(e.hasClass('strike-out')){
													to_remove.indexOf(p) < 0 
														&& to_remove.push(p)

												} else {
													var i = to_remove.indexOf(p)
													if(i >= 0){
														to_remove.splice(i, 1)
													}
												}
											}],
									]})
									.open(function(evt, time){
										that.config['ui-slideshow-interval'] = time

										// XXX this is ugly...
										oo.close()
										o.client.update()
										o.client.select(path.split(':')[0])
									}))
								.close(function(){
									// remove striked items...
									to_remove.forEach(function(e){
										var lst = that.config['ui-slideshow-intervals'].slice()
										lst.splice(lst.indexOf(e), 1)

										that.config['ui-slideshow-intervals'] = lst
									})

									// XXX this is ugly...
									o.focus()

									if(that.toggleSlideshow('?') == 'on'){
										o.close()
									}
								})

							oo.client.select(that.config['ui-slideshow-interval'])

							return
						}

						// direction...
						if(/direction/i.test(path)){
							that.toggleSlideshowDirection()
							o.client.update()

						// Looping...
						} else if(/looping/i.test(path)){
							that.toggleSlideshowLooping()
							o.client.update()
						}

						// XXX this is ugly...
						o.client.select(path.split(':')[0])

						// do not keep the dialog open during the slideshow...
						if(that.toggleSlideshow('?') == 'on'){
							o.close()
						}
					}))
				.close(function(){
					that.resetSlideshowTimer()
				})

			o.client.dom.addClass('metadata-view')

			o.client.select(-1)

			return o
		}],
	
	// XXX add a custom time setting...
	toggleSlideshowInterval: ['- Slideshow/Interval',
		core.makeConfigToggler('ui-slideshow-interval', 
			function(){ return this.config['ui-slideshow-intervals'] },
			function(){ this.resetSlideshowTimer() })],
	toggleSlideshowDirection: ['- Slideshow/Direction',
		core.makeConfigToggler('ui-slideshow-direction', ['forward', 'reverse'])],
	toggleSlideshowLooping: ['- Slideshow/Looping',
		core.makeConfigToggler('ui-slideshow-looping', ['on', 'off'])],

	toggleSlideshow: ['Slideshow/Quick toggle',
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
						this.__slideshouw_timer != 'suspended'
							&& clearInterval(this.__slideshouw_timer)
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
						if(that.current == cur){
							// loop...
							if(that.config['ui-slideshow-looping'] == 'on'){
								that.config['ui-slideshow-direction'] == 'forward' ?
									that.firstImage()
									: that.lastImage()

							// stop...
							} else {
								that.toggleSlideshow('off')
							}
						}
					}, Date.str2ms(this.config['ui-slideshow-interval'] || '3s'))

				// stop...
				} else {
					this.saveWorkspace('slideshow') 

					// stop timer...
					this.__slideshouw_timer
						&& clearInterval(this.__slideshouw_timer)
					delete this.__slideshouw_timer

					// XXX should this be a dedicated slideshow workspace??
					this.__pre_slideshow_workspace &&
						this.loadWorkspace(this.__pre_slideshow_workspace)
					delete this.__pre_slideshow_workspace
				}
			})],

	// NOTE: these can be used as pause and resume...
	resetSlideshowTimer: ['- Slideshow/',
		function(){
			this.__slideshouw_timer && this.toggleSlideshow('on')
		}],
	suspendSlideshowTimer: ['- Slideshow/',
		function(){
			if(this.__slideshouw_timer){
				clearInterval(this.__slideshouw_timer)
				this.__slideshouw_timer = 'suspended'
			}
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
