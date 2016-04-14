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
var keyboard = require('lib/keyboard')

var core = require('features/core')
var base = require('features/base')

var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/

var _cmpTimes = function(a, b){
	return Date.str2ms(a) - Date.str2ms(b)
}



/*********************************************************************/

// NOTE: this uses ui-chrome-hidden workspace to set the initial state
// 		of the slideshow workspace.
//
// XXX would be a good idea to add provision for a timer to indicate 
// 		slideshow progress/status... 
var SlideshowActions = actions.Actions({
	config: {
		'slideshow-looping': 'on',
		'slideshow-direction': 'forward',
		'slideshow-interval': '3s',

		'slideshow-intervals': [
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
	slideshowDialog: ['Slideshow/Slideshow settings and start',
		function(){
			var that = this

			this.suspendSlideshowTimer()

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
					null,
					[
						// XXX make this editable...
						['Interval: ', 
							function(){ return that.config['slideshow-interval'] }],
						['Direction: ', 
							function(){ return that.config['slideshow-direction'] }],
						['Looping: ', 
							function(){ return that.config['slideshow-looping'] }],

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

						var _makeEditable = function(elem){
							$(elem).find('.text')
								.prop('contenteditable', true)
								.text('')
								.selectText()
								.keydown(function(){ 
									event.stopPropagation() 

									var n = keyboard.toKeyName(event.keyCode)

									// reset to original value...
									if(n == 'Esc'){
										oo.client.update()

									// save value...
									} else if(n == 'Enter'){
										event.preventDefault()
										var txt = $(this).text()

										// invalid format...
										if(!Date.str2ms(txt)){
											oo.client.update()
											return
										}

										// add new value and sort list...
										that.config['slideshow-intervals']
											.push(txt)
										that.config['slideshow-intervals']
											.sort(function(a, b){
												return Date.str2ms(a) - Date.str2ms(b)
											})

										// update the list data...
										oo.client.options.data 
											= that.config['slideshow-intervals']
												.concat([
													'---', 
													'New...'
												])

										// update list and select new value...
										oo.client.update()
											.done(function(){
												oo.client.select('"'+txt+'"')
											})
									}
								})
							return $(elem)
						}

						// interval...
						// XXX add custom interval editing...
						if(/interval/i.test(path)){
							var to_remove = []
							var oo = overlay.Overlay(that.ribbons.viewer, 
								browse.makeList( null, 
									that.config['slideshow-intervals']
										.concat([
											// XXX do we add a new item here???
											'---', 
											//$('<input type="text" pattern="[0-9]+|[0-9]*\\.[0-9]+" placeholder="New...">')
											'New...',
										]), 
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
									// select 'New...' item...
									.on('select', function(evt, elem){
										if(/new/i.test($(elem).text())){
											_makeEditable(elem)
										}
									})
									.open(function(evt, time){
										if(!Date.str2ms(time)){
											oo.client.select('New...')
											// XXX place the cursor...
											// XXX

										} else {
											that.config['slideshow-interval'] = time

											// XXX this is ugly...
											oo.close()
											o.client.update()
											o.client.select(path.split(':')[0])
										}
									}))
								.close(function(){
									// remove striked items...
									to_remove.forEach(function(e){
										var lst = that.config['slideshow-intervals'].slice()
										lst.splice(lst.indexOf(e), 1)

										that.config['slideshow-intervals'] = lst
									})

									// XXX add new items...
									// XXX

									// sort the times...
									that.config['slideshow-intervals'] =
										that.config['slideshow-intervals']
											.sort(function(a, b){
												return Date.str2ms(a) - Date.str2ms(b)
											})


									// XXX this is ugly...
									o.focus()

									if(that.toggleSlideshow('?') == 'on'){
										o.close()
									}
								})

							oo.client.select(that.config['slideshow-interval'])

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
	toggleSlideshowInterval: ['- Slideshow/Slideshow interval',
		core.makeConfigToggler('slideshow-interval', 
			function(){ return this.config['slideshow-intervals'] },
			function(){ this.resetSlideshowTimer() })],
	toggleSlideshowDirection: ['- Slideshow/Slideshow direction',
		core.makeConfigToggler('slideshow-direction', ['forward', 'reverse'])],
	toggleSlideshowLooping: ['- Slideshow/Slideshow looping',
		core.makeConfigToggler('slideshow-looping', ['on', 'off'])],

	toggleSlideshow: ['Slideshow/Slideshow quick toggle',
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

						// construct the slideshow workspace if it does
						// not exist...
						//
						// NOTE: this is partially redundant with the 
						// 		loadWorkspace.pre handler in the feature...
						if(this.workspaces['slideshow'] == null){
							this.loadWorkspace('ui-chrome-hidden') 
							this.saveWorkspace('slideshow') 
						}

						// load the slideshow workspace...
						this.loadWorkspace('slideshow')
				
						// single image mode...
						this.toggleSingleImage('on')
					}

					// start the timer... 
					this.__slideshouw_timer = setInterval(function(){
						var cur = that.current

						// next step...
						that.config['slideshow-direction'] == 'forward' ?
							that.nextImage()
							: that.prevImage()

						// we have reached the end...
						if(that.current == cur){
							// loop...
							if(that.config['slideshow-looping'] == 'on'){
								that.config['slideshow-direction'] == 'forward' ?
									that.firstImage()
									: that.lastImage()

							// stop...
							} else {
								that.toggleSlideshow('off')
							}
						}
					}, Date.str2ms(this.config['slideshow-interval'] || '3s'))

				// stop...
				} else {
					this.saveWorkspace('slideshow') 

					// stop timer...
					this.__slideshouw_timer
						&& clearInterval(this.__slideshouw_timer)
					delete this.__slideshouw_timer

					// restore the original workspace...
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
		'ui',
		'ui-single-image-view',
	],

	actions: SlideshowActions,

	handlers: [
		// add a placeholder for slideshow workspace, this is to make the
		// workspace toggler show it as one of the options...
		//
		// NOTE: the slideshow workspace will get populated either on 
		// 		loading it for the first time or on first running a 
		// 		slideshow...
		['start',
			function(){ 
				if(this.workspaces['slideshow'] == null){
					this.workspaces['slideshow'] = null
				} 
			}],

		// build the slideshow workspace for the first time if it's not
		// present yet (is null)...
		['loadWorkspace.pre',
			function(workspace){
				if(workspace == 'slideshow' && this.workspaces['slideshow'] == null){
					return function(){
						this.loadWorkspace('ui-chrome-hidden') 
						this.saveWorkspace('slideshow') 
					}
				}
			}],

		// do not leave the viewer in slideshow mode...
		['stop',
			function(){ this.toggleSlideshow('off') }]
	],
})





/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
