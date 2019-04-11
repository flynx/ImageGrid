/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')
var base = require('features/base')

var widgets = require('features/ui-widgets')

var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')



/*********************************************************************/

// NOTE: this uses ui-chrome-hidden workspace to set the initial state
// 		of the slideshow workspace.
//
// XXX would be a good idea to add provision for a timer to indicate 
// 		slideshow progress/status... 
// 			- make this a separate feature with a toggler
// XXX might be a good idea to add "slideshow hold", for example while 
// 		mouse down...
var SlideshowActions = actions.Actions({
	config: {
		'slideshow-looping': 'on',
		'slideshow-direction': 'forward',
		'slideshow-interval': '3s',
		'slideshow-interval-max-count': 7,
		'slideshow-hold': 'on',

		'slideshow-intervals': [
			'0.2s',
			'1s',
			'3s',
			'5s',
			'7s',
		],
	},

	toggleSlideshow: ['Slideshow/$Slideshow quick toggle',
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			'slideshow-running',
			function(state){
				// start...
				if(state == 'on'){
					var that = this

					// reset the timer...
					// NOTE: this means we were in a slideshow mode so we do not
					// 		need to prepare...
					if(this.__slideshow_timer){
						this.__slideshow_timer != 'suspended'
							&& clearInterval(this.__slideshow_timer)
						delete this.__slideshow_timer

					// prepare for the slideshow...
					} else {
						// single image mode...
						this.toggleSingleImage('on')

						// save current workspace...
						this.pushWorkspace()

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
					}

					// disable getting in/out of single image mode via clicks... 
					if(this.config['single-image-toggle-on-click']){
						this.config['single-image-toggle-on-click'] = false
					}

					// start the timer... 
					this.__slideshow_timer = setInterval(function(){
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
					// stop timer...
					this.__slideshow_timer
						&& clearInterval(this.__slideshow_timer)
					delete this.__slideshow_timer

					// restore the original workspace...
					this.popWorkspace()
				}
			})],

	// XXX should this reflect slideshow state???? (ready, running, paused???)
	slideshowDialog: ['Slideshow/Slideshow...',
		widgets.makeUIDialog(function(){
			var that = this

			// suspend the timer if it's not suspended outside...
			var suspended_timer = this.__slideshow_timer == 'suspended'
			suspended_timer || this.suspendSlideshowTimer()

			// XXX might be a good idea to make this generic...
			var _makeToggleHandler = function(toggler){
				return function(){
					var txt = $(this).find('.text').first().text()
					that[toggler]()
					o.update()
						.then(function(){ o.select(txt) })
					that.toggleSlideshow('?') == 'on' 
						&& o.close()
				}
			}

			var o = browse.makeLister(null, function(path, make){
					make(['$Interval: ', 
							function(){ return that.config['slideshow-interval'] }])
						.on('open', function(){
							that.slideshowIntervalDialog(make.dialog) })

					make(['$Direction: ', 
							function(){ return that.config['slideshow-direction'] }])
						.on('open', _makeToggleHandler('toggleSlideshowDirection'))
					make(['$Looping: ', 
							function(){ return that.config['slideshow-looping'] }])
						.on('open', _makeToggleHandler('toggleSlideshowLooping'))

					// Start/stop...
					make([function(){ 
							return that.toggleSlideshow('?') == 'on' ? '$Stop' : '$Start' }])
						.on('open', function(){
							that.toggleSlideshow()
							o.close()
						})
				},
				{
					path: that.toggleSlideshow('?') == 'on' ? 'Stop' : 'Start',
					cls: 'table-view tail-action',
				})
				.on('close', function(){
					// reset the timer if it was not suspended outside...
					suspended_timer 
						|| that.resetSlideshowTimer()
				})

			return o
		})],
	
	// settings...
	// NOTE: these are disabled as they are repeated in the slideshow dialog...
	// XXX do we need both these and the dialog???
	slideshowIntervalDialog: ['- Slideshow/Slideshow $interval...',
		widgets.makeUIDialog(function(parent){
			var that = this
			var dialog = widgets.makeConfigListEditor(
				that, 
				'slideshow-intervals',
				'slideshow-interval', 
				{
					length_limit: that.config['slideshow-interval-max-count'],
					check: Date.str2ms,
					unique: Date.str2ms,
					normalize: function(e){ return e.trim() },
					sort: function(a, b){
						return Date.str2ms(a) - Date.str2ms(b) },
				})
				.on('start', function(){
					// suspend the timer if it's not suspended outside...
					this.__slideshow_timer == 'suspended'
						|| this.suspendSlideshowTimer()
				})
				.on('close', function(){
					// reset the timer if it was not suspended outside...
					this.__slideshow_timer == 'suspended'
						|| that.resetSlideshowTimer()

					if(parent){
						var txt = parent.select('!').find('.text').first().text()

						parent.update()
							.then(function(){ 
								txt != ''
									&& parent.select(txt)
							})
					}
				})
			return dialog
		})],
	toggleSlideshowDirection: ['- Slideshow/Slideshow $direction',
		core.makeConfigToggler('slideshow-direction', ['forward', 'reverse'])],
	toggleSlideshowLooping: ['- Slideshow/Slideshow $looping',
		core.makeConfigToggler('slideshow-looping', ['on', 'off'])],

	toggleSlideshowHold: ['Interface|Slideshow/Slideshow $hold',
		core.makeConfigToggler('slideshow-hold', ['on', 'off'])],

	resetSlideshowTimer: ['- Slideshow/Reset slideshow timer',
		function(){
			this.__slideshow_timer && this.toggleSlideshow('on') }],
	suspendSlideshowTimer: ['- Slideshow/Suspend slideshow timer',
		function(){
			if(this.__slideshow_timer){
				clearInterval(this.__slideshow_timer)
				this.__slideshow_timer = 'suspended'
			}
		}],
	toggleSlideshowTimer:['Slideshow/Pause or resume running slideshow',
		core.doc`

		NOTE: this will have no effect if the slideshow is not running...
		`,
		{browseMode: function(){ return this.toggleSlideshow('?') == 'off' && 'disabled' }},
		toggler.Toggler(null, 
			function(_, state){ 
				if(state == null){
					return this.__slideshow_timer == 'suspended' ? 'paused' 
						: !!this.__slideshow_timer ? 'running'
						: 'off'
				}

				if(this.toggleSlideshow('?') != 'on'){
					return
				}

				// handle state changing...
				if(state == 'paused' || state == 'off'){
					this.suspendSlideshowTimer()
					return 'paused'

				} else {
					this.resetSlideshowTimer() 
					return 'running'
				}
			}, 
			// XXX should we return different sets of states when 
			// 		slideshow is running and when not?
			// 		...the problem is what to return when slideshow is 
			// 		not running???
			['paused', 'running', 'off'])],

	resetSlideshowWorkspace: ['Slideshow/Reset workspace',
		function(){ delete this.workspaces['slideshow'] }],
})


var Slideshow = 
module.Slideshow = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-slideshow',
	depends: [
		'ui',
		'ui-control',
		'ui-single-image',
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

		['load',
			function(){ this.toggleSlideshow('off') }],

		// - build the slideshow workspace for the first time if it's not
		// 		present yet (is null)...
		// - restore .config['single-image-toggle-on-click']
		['loadWorkspace.pre',
			function(workspace){
				// going out of slideshow -> restore settings...
				var data = this.workspaces[workspace] || {} 
				if(this.workspace == 'slideshow'){
					if(!('single-image-toggle-on-click' in data)){
						delete this.config['single-image-toggle-on-click']

					} else {
						this.config['single-image-toggle-on-click'] = 
							data['single-image-toggle-on-click']
					}
				}

				// going into slideshow for first time -> setup...
				if(workspace == 'slideshow' && this.workspaces['slideshow'] == null){
					return function(){
						this.loadWorkspace('ui-chrome-hidden') 
						this.saveWorkspace('slideshow') 
					}
				}
			}],

		// do not leave the viewer in slideshow mode...
		['stop',
			function(){ this.toggleSlideshow('off') }],

		// slideshow hold...
		//
		// Holding down a key or mouse button will suspend the slideshow 
		// and resume it when the key/button is released...
		//
		// XXX experimental, needs more testing...
		['toggleSlideshow',
			function(){
				var that = this

				if(!this.dom){
					return
				}

				var toggle_debounce = false

				var hold = this.__slideshow_hold_handler 
					= this.__slideshow_hold_handler 
						|| function(evt){
							!toggle_debounce 
								&& that.toggleSlideshowTimer('?') == 'running'
								&& that.suspendSlideshowTimer() }
				var release = this.__slideshow_release_handler 
					= this.__slideshow_release_handler 
						|| function(evt){
							!toggle_debounce 
								&& that.toggleSlideshowTimer('?') != 'running'
								&& that.resetSlideshowTimer() }
				var toggle = this.__slideshow_toggle_handler
					= this.__slideshow_toggle_handler
						|| function(){
							if(!toggle_debounce){
								that.toggleSlideshowTimer() 
								toggle_debounce = true
								setTimeout(function(){ 
									toggle_debounce = false 
								}, that.config['image-click-debounce-timeout'] || 100)
							}
						}

				if(this.toggleSlideshow('?') == 'on'){
					this.dom.on('mousedown', hold)
					this.dom.on('mouseup', release)
					this.dom.on('tap', toggle)

				} else {
					this.dom.off('mousedown', hold)
					this.dom.off('mouseup', release)
					this.dom.off('touchend', toggle)
				}
			}],
		//*/

		// pause/resume slideshow on modal stuff...
		['firstModalOpen',
			function(){ 
				if(this.toggleSlideshow('?') == 'on' 
						&& this.toggleSlideshowTimer('?') == 'running'){
					this.toggleSlideshowTimer('paused') 
					this.one('lastModalClose', function(){
						this.toggleSlideshowTimer('running') })
				}
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
