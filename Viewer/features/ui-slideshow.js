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
		'slideshow-intervals': [
			'0.2s',
			'1s',
			'3s',
			'5s',
			'7s',
		],
		'slideshow-interval-max-count': 7,

		'slideshow-pause-on-blur': true,

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
			var spec
			return browse.makeLister(null, 
				function(path, make){
					// fields...
					that.showEditor(make, 
						spec = spec 
							|| [
								{ title: '$Interval: ', 
									type: 'configToggle',
									key: 'slideshow-interval',
									values_key: 'slideshow-intervals',
									nonstrict: true,
									list: function(cur, set){
										this.slideshowIntervalDialog()
											.close(function(){ set() }) }, },
								{ title: '$Direction: ',
									type: 'toggler',
									toggler: 'toggleSlideshowDirection', 
									live_update: true, },
								{ title: '$Looping: ',
									type: 'toggler',
									toggler: 'toggleSlideshowLooping', 
									live_update: true, }, ])
					// Start/stop...
					make([function(){ 
							return that.toggleSlideshow('?') == 'on' ? '$Stop' : '$Start' }], 
						{ open: function(){
								that.toggleSlideshow()
								make.dialog.close() } })
				},{
					path: that.toggleSlideshow('?') == 'on' ? 'Stop' : 'Start',
					cls: 'table-view tail-action',
				}) })],
	slideshowButtonAction: ['- Slideshow/',
		core.doc`Slideshow button action

		This differs from .toggleSlideshow() in that it also handles the paused
		timer/slideshow state according to the following FSM:

			off <--> on <--- paused

		i.e. if the slideshow is paused it will resume it otherwise stop/start.

		NOTE: this is not a toggler.
		`,
		function(){
			return this.toggleSlideshowTimer('?') == 'paused' ?
				(this.toggleSlideshowTimer() && 'on')
				: this.toggleSlideshow() }],
	
	// settings...
	// NOTE: these are disabled as they are repeated in the slideshow dialog...
	slideshowIntervalDialog: ['- Slideshow/Slideshow $interval...',
		widgets.makeUIDialog(function(){
			var that = this
			return widgets.makeConfigListEditor(
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
				}) })],
	toggleSlideshowDirection: ['- Slideshow/Slideshow $direction',
		core.makeConfigToggler('slideshow-direction', ['forward', 'reverse'])],
	toggleSlideshowLooping: ['- Slideshow/Slideshow $looping',
		core.makeConfigToggler('slideshow-looping', ['on', 'off'])],

	toggleSlideshowPauseOnBlur: ['Interface|Slideshow/Slideshow pause on app blur',
		core.makeConfigToggler('slideshow-pause-on-blur', ['on', 'off'])],

	resetSlideshowTimer: ['- Slideshow/Reset slideshow timer',
		function(){
			this.__slideshow_timer 
				&& this.toggleSlideshowTimer('?') != 'paused'
				&& this.toggleSlideshow('on') }],
	suspendSlideshowTimer: ['- Slideshow/Suspend slideshow timer',
		function(){
			if(this.__slideshow_timer){
				clearInterval(this.__slideshow_timer)
				this.__slideshow_timer = 'suspended' } }],

	toggleSlideshowTimer: ['Slideshow/Pause or resume running slideshow',
		core.doc`

		NOTE: this will have no effect if the slideshow is not running...
		`,
		{mode: function(){ return this.toggleSlideshow('?') == 'off' && 'disabled' }},
		toggler.Toggler(null, 
			function(_, state){ 
				if(state == null){
					return this.__slideshow_timer == 'suspended' ? 
							'paused' 
						: !!this.__slideshow_timer ? 
							'running'
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
					this.toggleSlideshow('on') 
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
		'ui-editor',
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

		// slideshow pause on click or blur...
		['toggleSlideshow',
			function(){
				var that = this

				if(!this.dom){
					return
				}

				var running = this.toggleSlideshow('?') == 'on' 
				var toggle_debounce = false

				// toggle on click...
				var toggle = this.__slideshow_toggle_handler
					= this.__slideshow_toggle_handler
						|| function(){
							if(!toggle_debounce){
								that.toggleSlideshowTimer() 
								toggle_debounce = true
								setTimeout(function(){ 
									toggle_debounce = false 
								}, that.config['image-click-debounce-timeout'] || 100) } }
				running ?
					this.dom.on('click', toggle)
					: this.dom.off('click', toggle)

				// toggle on blur/focus...
				if(this.config['slideshow-pause-on-blur'] !== false){
					var user_paused = false
					var focus_debounce = false
					var blur = this.__slideshow_blur_handler
						= this.__slideshow_blur_handler
							|| function(){
								if(!focus_debounce){
									user_paused = that.toggleSlideshowTimer('?') == 'paused' 
									that.toggleSlideshowTimer('paused') 
									focus_debounce = true } }
					var focus = this.__slideshow_focus_handler
						= this.__slideshow_focus_handler
							|| function(){
								focus_debounce = false
								user_paused 
									|| that.toggleSlideshowTimer('running') }
					running ?
						this.dom
							.on('blur', blur)
							.on('focus', focus)
						: this.dom
							.off('blur', blur)
							.off('focus', focus)
				}
			}],

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
