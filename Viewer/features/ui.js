/**********************************************************************
* 
* User Interface Features...
*
* Features:
* 	- ui
* 		implements basic ui actions...
*	- ui-url-hash
*		handle .location.hash
*	- ui-cursor
	- ui-unfocused-lock
*	- ui-control
*		touch/mouse control mechanics
*
* Dev Features:
*	- fail-safe-devtools
*		starts devtools if for some reason the main ui fails to start.
*
* Experimental Features:
*	- ui-ribbons-placement
*		manage different low level ribbon placement mechanics
*		XXX EXPERIMENTAL...
*	- auto-single-image
*	- auto-ribbon
*
* XXX FOCUS_EVENT BUG: for some reason focus/blur events both on window 
* 		and on ig.dom trigger only if anything in the ui is physically 
* 		focused (e.g. clicked)
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')
var keyboard = require('lib/keyboard')

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/
// Viewer (widget/interface)...
//
//
// This requires a 'ui-render' family feature to be present
//
// 	Expected render API is:
//		XXX do we actually need this or should we directly use .ribbons.scale()???
//		Get/set view scale...
//		.viewScale()
//		.viewScale('?')
//			-> scale
//		.viewScale(scale)
//			-> this
//
//		Get/set screen width (measured in image blocks)...
//		.fitImage('?')
//			-> screenwidth
//		.fitImage(count, overflow)
//			-> this
//
//		Get/set screen height (measured in image blocks)...
//		.fitRibbon('?')
//			-> screenheight
//		.fitRibbon(count, whole)
//			-> this
//
//		Center image horizontally...
//		.centerImage(target, align, offset, scale){
//			-> this
//
//		Center ribbon vertically...
//		.centerRibbon(target)
//			-> this
//
//		Get/set ribbon rotation...
//		.ribbonRotation()
//			-> angle
//		.ribbonRotation(angle)
//			-> this
//
// 	Expected render events:
//		Pre/post wrap the resize animation...
//		.resizing(unit, size, overflow)
//
// 	Optional render API:
//		Update ribbon...
//		.updateRibbon(target)
//			-> this
//
//	Base .ribbons API (see: ribbons.BaseRibbons):
//		.ribbons.getImage(..)
//			-> image
//
//		.ribbons.getImageByPosition(..)
//			-> image
//
//		.ribbons.getRibbon(..)
//			-> ribbon
//
//		.ribbons.elemGID(..)
//			-> gid
//
//	XXX do we need these???
//		.ribbons.focusImage(..)
//	XXX Avoid using methods that expose specific non-generic structure:
//		.ribbons.getRibbonSet(..) ???
//		.ribbons.getRibbonLocator(..)
//
//
// Workspaces:
// 	ui-chrome-hidden		- all features handling chrome elements 
// 								should hide all the chrome when this 
// 								workspace loads.
// 								NOTE: other workspace functionality 
// 									should be handled without change.
//
//
//
// NOTE: this uses the base feature API but does not need it imported...
//
// XXX need a way to neutrally scale images and store that scale...
// 		- fit N images/ribbons is neutral but might mean different things 
// 			depending on image and viewer proportions
// 		- .scale is a bad way to go...
// XXX need to trigger an event on the container on start/stop...
var ViewerActions = 
module.ViewerActions = actions.Actions({
	config: {
		// make the direction steps depend on screen size...
		'steps-to-change-direction': 'screenwidth',
		'steps-to-change-direction-min': 2,
		'steps-to-change-direction-max': 6,

		// The maximum screen width allowed when zooming...
		'max-screen-images': 30,

		// If true do not zoom past one image filling the screen...
		'max-zoom-to-screen': true,

		// A step (multiplier) used by .zoomIn()/.zoomOut() actions.
		// NOTE: this is rounded to the nearest whole screen width in images
		// 		and current fit-overflow added.
		'zoom-step': 1.2,

		// Added to odd number of images to fit to indicate scroll ability...
		// ...this effectively sets the closest distance an image can be from
		// the viewer edge...
		'fit-overflow': 0.2,

		// Time to wait after resize is done for transitionend event to call
		// .resizingDone(..) action.
		//
		// NOTE: this should be as short as possible but longer than the
		// 		transition.
		'resize-done-timeout': 300,

		
		// Theme to set on startup...
		'theme': null,

		// Supported themes...
		'themes': [
			'dark', 
			'gray', 
			'light',
		],

		'ribbon-theme': 'black',
		'ribbon-themes': [
			'black-ribbon',
			'gray-ribbon',
			'light-gray-ribbon',
			'transparent-ribbon',
		],

		'ribbon-image-separators': 'on',

		'ribbon-rotation-step': 10,

		// XXX BUG: for some reason this get's shadowed by base.config...
		'ribbon-focus-modes': [
			'visual',	// select image closest visually 

			'order',	// select image closest to current in order
			'first',	// select first image
			'last',		// select last image
		],
		'ribbon-focus-mode': 'visual',

		// control ribbon alignment...
		//
		// NOTE: when this is null then 'ribbon-focus-mode' will be used...
		// NOTE: this supports the same modes as 'ribbon-focus-mode'...
		'ribbon-align-modes': {
			none: null,		// use .config['ribbon-focus-mode']'s value
			visual: 'alignByOrder',
			order: 'alignByOrder',
			first: 'alignByFirst',
			//last,
			manual: null,
		},
		'ribbon-align-mode': null,

		'ribbon-align-delay': 50,


		// Change image rendering modes...
		//
		// See: 
		// 	.toggleImageRendering(..)
		// 	css/layout.css
		//
		// XXX EXPERIMENTAL: this does not seem to have an effect on chrome...
		'image-rendering': 'crisp-resize',
	},

	// Viewer dom... 
	dom: null,

	// NOTE: this expects that ribbons will maintain .parent.images...
	// NOTE: when getting rid of ribbons need to also remove the .parent
	// 		reference...
	get ribbons(){
		return this.__ribbons },
	set ribbons(ribbons){
		this.__ribbons = ribbons
		ribbons.parent = this
	},


	// Current image data...
	//
	get image(){
		return this.images && this.images[this.current] },
	set image(val){
		if(this.images){
			this.images[this.current] = val
		}
	},

	// Scaling...
	//
	// NOTE: .screenwidth / .screenheight are measured in square image blocks...
	// XXX do we actually need this or should we directly use .ribbons.scale()???
	get scale(){
		return this.viewScale() },
	set scale(s){
		this.viewScale(s) },
	get screenwidth(){
		return this.fitImage('?') },
	set screenwidth(n){
		this.fitImage(n, false) },
	get screenheight(){
		return this.fitRibbon('?') },
	set screenheight(n){
		this.fitRibbon(n, false) },

	// Screen size in image "radii" on the narrow side of the screen...
	//
	// E.g.
	//
	// 						min(screenwidth, screenheight)	
	// 		screenfit = --------------------------------------
	// 						min(image.width, image.height)
	//
	get screenfit(){
		if(!this.dom){
			return null
		}
		var viewer = this.dom
		var W = viewer.width()
		var H = viewer.height()

		return W < H ?
			this.screenwidth
			: this.screenheight
	},
	set screenfit(n){
		var viewer = this.dom
		var W = viewer.width()
		var H = viewer.height()

		if(W < H){
			this.screenwidth = n

		} else {
			this.screenheight = n
		}
	},


	// General UI stuff...
	// NOTE: this is applicable to all uses...
	toggleTheme: ['Interface/Theme/Viewer theme', 
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			function(){ return this.config.themes },
			function(state){ this.config.theme = state }) ],
	lighterTheme: ['Interface/Theme/Lighter theme',
		function(){
			var themes = this.config.themes
			var i = themes.indexOf(this.toggleTheme('?'))
			this.toggleTheme(Math.min(i+1, themes.length-1))
		}],
	darkerTheme: ['Interface/Theme/Darker theme',
		function(){
			var themes = this.config.themes
			var i = themes.indexOf(this.toggleTheme('?'))
			this.toggleTheme(Math.max(0, i-1))
		}],
	toggleRibbonTheme: ['Interface/Theme/Ribbon theme', 
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			function(){ return this.config['ribbon-themes'] },
			function(state){ this.config['ribbon-theme'] = state }) ],
	toggleRibbonImageSepators: ['Interface/Theme/Ribbon image separators', 
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			'ribbon-image-separators',
			function(state){ this.config['ribbon-image-separators'] = state }) ],

	// XXX EXPERIMENTAL: direction...
	get direction_change_steps(){
		var steps = this.config['steps-to-change-direction']
		var min = this.config['steps-to-change-direction-min'] || 3
		var max = this.config['steps-to-change-direction-max'] || 6
		return typeof(steps) == typeof(123) ?
				steps
			: Math.min(Math.max(Math.ceil(this.screenwidth / 2), min), max) },


	// Navigation...
	//
	// NOTE: these prioritize whole images, i.e. each image will at least
	// 		once be fully shown.
	prevScreen: ['Navigate/Screen width back',
		function(){
			// NOTE: the 0.2 is added to compensate for alignment/scaling
			// 		errors -- 2.99 images wide counts as 3 while 2.5 as 2.
			var w = Math.floor(this.screenwidth + 0.2)
			w += (w % 2) - 1
			this.prevImage(w)
		}],
	nextScreen: ['Navigate/Screen width forward',
		function(){
			var w = Math.floor(this.screenwidth + 0.2)
			w += (w % 2) - 1
			this.nextImage(w)
		}],


	// ribbon aligning and centering...
	centerViewer: ['- Interface/Center the viewer',
		function(target){
			this
				.centerImage(target)
				.centerRibbon(target) }],
	alignRibbons: ['Interface/Align ribbons',
		{mode: 'advancedBrowseModeAction'},
		function(target, scale, now){
			if(target == 'now'){
				now = true
				target = null
			}
			var mode = this.config['ribbon-align-mode'] || 'none'
			mode = mode == 'none' ? this.config['ribbon-focus-mode'] : mode
			var modes = this.config['ribbon-align-modes']

			if(mode in modes && mode != 'manual' && mode != 'none'){
				this[modes[mode]](target, scale, now)

			// manual...
			} else {
				this
					.centerRibbon(target)
					.centerImage(target)
			}
		}],
	toggleRibbonAlignMode : ['Interface/Ribbon align mode',
		core.makeConfigToggler('ribbon-align-mode', 
			function(){ return Object.keys(this.config['ribbon-align-modes']) })],

	// align modes...
	// XXX these should also affect up/down navigation...
	// 		...navigate by proximity (closest to center) rather than by
	// 		order...
	// XXX skip off-screen ribbons (???)
	// XXX should the timeout be configurable???
	alignByOrder: ['Interface/Align ribbons by image order',
		{mode: 'advancedBrowseModeAction'},
		function(target, scale, now){
			if(target == 'now'){
				now = true
				target = null
			}

			var data = this.data

			if(data == null){
				return
			}

			var gid = data.getImage(target)

			// align current ribbon...
			// NOTE: the ordering of calls here makes it simpler to load
			// 		data into ribbons based on target gid... i.e. first
			// 		we know the section we need then align it vertically...
			this
				.centerImage(gid)
				.centerRibbon(gid)

			var that = this
			var _align = function(){
				that.__align_timeout = null
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons... (???)

					// center...
					// XXX is there a 'last' special case here???
					var t = data.getImage(gid, r)
					if(t == null){
						var f = data.getImage('first', r)
						// nothing found -- empty ribbon?
						if(f == null){
							continue
						}
						that.centerImage(f, 'before', null, scale)
					} else {
						that.centerImage(t, 'after', null, scale)
					}
				}
			}

			if(now){
				_align()

			} else {
				// if we are going fast we might skip an update... 
				if(this.__align_timeout != null){
					clearTimeout(this.__align_timeout)
					this.__align_timeout = null
				}
				this.__align_timeout = setTimeout(_align, this.config['ribbon-align-delay'])
			}
		}],
	alignByFirst: ['Interface/Align ribbons except current to first image',
		{mode: 'advancedBrowseModeAction'},
		function(target){
			target = target == 'now' ? null : target

			var data = this.data

			if(data == null){
				return
			}

			var gid = data.getImage(target)

			// align current ribbon...
			this
				.centerImage(gid)
				.centerRibbon(gid)

			var that = this
			//setTimeout(function(){
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons...

					// XXX see if we need to do some loading...

					// center...
					var f = data.getImage('first', r)
					// nothing found -- empty ribbon?
					if(f == null){
						continue
					}
					that.centerImage(f, 'before')
				}
			//}, 0)
		}],

	// XXX FOCUS_EVENT these for some reason work only if the ui is clicked...
	//windowFocus: ['- Interface/',
	//	core.doc``,
	//	core.Event(function(){
	//		// This is the window focus event...
	//		//
	//		// Not for direct use.
	//	})],
	//windowBlur: ['- Interface/',
	//	core.doc``,
	//	core.Event(function(){
	//		// This is the window blur event...
	//		//
	//		// Not for direct use.
	//	})],

	// Viewer/window resize event...
	resizingWindow: ['- Interface/',
		core.doc`This is called by the window resize event handler...
		
		NOTE: since the centering is passive (done in CSS) we do not need
			to do anything here, but this is needed for legacy or 
			compatibility code that needs to update stuff when resizing 
			viewer...
			To see the list of handlers call:
				.getHandlerDocStr('resizingWindow')
		`,
		core.Event(function(){
			// This is the window resize event...
			//
			// Not for direct use.
		})],


	// Zoom/scale protocol...
	//
	// Events...
	// NOTE: the implementation needs to call .resizingDone(..) when all 
	// 		animations are done...
	resizing: ['- Zoom/Scale root protocol action (not for direct use)', 
		core.doc`Zooming/scaling root action...

		This is called by zoom/scale protocol compliant actions and
		intended for use as an trigger for handlers, and not as
		a user-callable action.
		
		Protocol:
			- a compliant action must be wrapped in the .resizing action
			- a compliant action must pass the sizing unit, value and 
				overflow to the wrapping action.
		
		Supported units:
			- scale
			- screenwidth
			- screenheight
		
		Example:
			actionName: ['Action doc...',
				function(value){
					this.resizing.chainCall(this, function(){
			
						// action code...
			
					}, 
					// action unit...
					'scale', 
					// action value...
					value)
				}],
		
		
		This will enable clients to attach to a single in/out point.
		
		NOTE: to account for CSS transitions use .resizingDone()
		NOTE: not intended for direct use...
		`,
		core.Event(function(unit, size, overflow){
			// This is a resizing protocol root function.
			//
			// This will never be used directly, but will wrap protocol user
			// functions.
		})],
	resizingDone: ['- Zoom/scale post-transition protocol action (not for direct use)',
		core.doc`Zooming/scaling post-transition action...
	
		This is called after zoom/scale protocol compliant actions are
		done and intended for use as an trigger for handlers, and
		not as a user-callable action.

		NOTE: this will be called at least timeout after last resize action...
		NOTE: if several resize actions are called less than timeout apart 
			this will be called only once, after the last action.
		NOTE: not intended for direct use...
		`,
		core.Event(function(){
			// This is resizing protocol post resize action.
			//
			// This will be called either when a resize CSS transition 
			// is done or after a timeout, which ever happens first.
			//
			// NOTE: if a transition is longer than the timeout this will
			// 		be called before the transition is done.
		})],

	// Zooming is done by multiplying the current scale by .config['zoom-step']
	// and rounding to nearest discrete number of images to fit on screen.
	zoomIn: ['Zoom/Zoom in',
		{mode: function(){
			return Math.min(this.screenwidth, this.screenheight) <= 1 && 'disabled' }},
		function(){ 
			var d = (this.config['zoom-step'] || 1.2)

			// limit scaling to screen dimensions...
			if(this.config['max-zoom-to-screen'] 
					&& (Math.min(this.screenwidth, this.screenheight) / d) < 1){
				this.scale /= 1 / Math.min(this.screenwidth, this.screenheight)

			} else {
				this.scale *= d
			}
		}],
	zoomOut: ['Zoom/Zoom out',
		{mode: function(){
			return this.screenwidth >= this.config['max-screen-images'] && 'disabled' }},
		function(){ 
			var max = this.config['max-screen-images']

			if(max && max < (this.screenwidth * (this.config['zoom-step'] || 1.2))){
				this.scale /= max / Math.min(this.screenwidth, this.screenheight)

			} else {
				this.scale /= (this.config['zoom-step'] || 1.2)
			}
		}],

	// Scale presets...
	fitOrig: ['Zoom/Fit to original scale',
		function(){ this.viewScale(1) }],
	fitMax: ['Zoom/Fit the maximum number of images',
		function(){ this.screenwidth = this.config['max-screen-images'] }],
	fitScreen: ['Zoom/Fit image to screen',
		function(){ this.screenfit = 1 }],


	// Ribbon rotation...
	//
	// Rotate ribbon CW/CCW...
	//
	// 	Rotate ribbon (default step)
	// 	.rotateRibbonCW()
	//
	// 	Rotate ribbon by step...
	// 	.rotateRibbonCW(5)
	//
	// NOTE: default step is set by .config['ribbon-rotation-step']
	rotateRibbonCW: ['Interface|Ribbon/Rotate ribbon clockwise', 
		function(a){ 
			this.ribbonRotation('+='+ (a || this.config['ribbon-rotation-step'] || 10)) }],
	rotateRibbonCCW: ['Interface|Ribbon/Rotate ribbon counter clockwise', 
		function(a){ 
			this.ribbonRotation('-='+ (a || this.config['ribbon-rotation-step'] || 10)) }],

	resetRibbonRotation: ['Interface|Ribbon/Reset ribbon rotation',
		{mode: function(){
			return this.ribbonRotation() == 0 && 'disabled' }},
		function(){ this.ribbonRotation(0) }],


	// XXX EXPERIMENTAL: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	// 		...should this be a crop???
	toggleRibbonList: ['Interface|Ribbon/Ribbons as images view',
		{mode: 'advancedBrowseModeAction'},
		function(){
			if(this._full_data == null){
				// XXX do a better name here...
				this._full_data = this.data

				// generate the view...
				this.data = this.data.cropRibbons()

			} else {
				var data = this._full_data
				delete this._full_data

				// restore...
				this.data = data.mergeRibbonCrop(this.data)
			}

			this.reload()
		}],


	// Renderer API...
	//
	// NOTE: these are expected to be implemented by the renderer...
	// NOTE: these are here for documentation purpose...
	//
	// XXX should these check if they are a base feature and if so err???
	viewScale: ['- Zoom/',
		function(scale){ }],
	fitImage: ['Zoom/Fit image',
		function(count, overflow){ }],
	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count, whole){ }],
	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align, offset, scale){ }],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){ }],
	ribbonRotation: ['- Interface|Ribbon/', 
		function(angle){ }],

	toggleImageRendering: ['Interface/Image rendering',
		{mode: 'advancedBrowseModeAction'},
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			['crisp-resize', 'default-resize'],
			function(state){ this.config['image-rendering'] = state }) ],
})

var Viewer =
module.Viewer = core.ImageGridFeatures.Feature({
	title: 'Graphical User Interface',

	tag: 'ui',

	depends: [
		'lifecycle',
		'base',
		'workspace',
		'introspection',
		'ui-render',
	],
	suggested: [
	],

	actions: ViewerActions,

	// check if we are running in a UI context...
	// NOTE: this will prevent loading of any features dependant on the 
	// 		UI in a non UI context...
	isApplicable: function(){ return this.runtime.browser },

	handlers: [
		// bind system events to dom...
		//
		// Events:
		// 	ig.attached
		// 		triggered when ImageGrid instance is attached to dom...
		// 	ig.start / ig.start.pre / ig.start.post
		// 	ig.ready
		// 	ig.stop / ig.stop.pre / ig.stop.post
		//
		// NOTE: ig.attached is triggered by the 'ui-render' implementation... 
		// NOTE: there is intentionally not pre/post ready events. (???
		//
		// XXX should these be imagegrid.event or ig.event??
		['start.pre',
			function(){ 
				this.dom.trigger('ig.start.pre') 
				return function(){
					this.dom.trigger('ig.start') 
					this.dom.trigger('ig.start.post') 
				}
			}],
		// XXX should we also do .pre/.post???
		['ready',
			function(){ 
				this.dom.trigger('ig.ready') }],
		['stop.pre',
			function(){ 
				this.dom.trigger('ig.stop') 
				return function(){
					this.dom.trigger('ig.stop') 
					this.dom.trigger('ig.stop.post') 
				}
			}],

		// workspaces, resizing and other events... 
		['start',
			function(){
				var that = this

				// load themes from config...
				this.config.theme 
					&& this.toggleTheme(this.config.theme)
				this.config['ribbon-theme'] 
					&& this.toggleRibbonTheme(this.config['ribbon-theme'])
				this.config['ribbon-image-separators'] 
					&& this.toggleRibbonImageSepators(this.config['ribbon-image-separators'])
				this.config['ribbon-theme'] 
					&& this.toggleImageRendering(this.config['image-rendering'])

				// XXX FOCUS_EVENT
				//// focus handling...
				//// XXX focus/blur events do not seem to trigger unless we 
				//// 		actually focus something in the window...
				//this.__window_focus_handler ??= 
				//	function(){ 
				//		that.windowFocus() }
				//this.dom[0].addEventListener('focus', this.__window_focus_handler)
				//this.__window_blur_handler ??=
				//	function(){ 
				//		that.windowBlur() }
				//this.dom.on('blur', this.__window_blur_handler)

				// center viewer on resize events...
				if(!this.__viewer_resize){
					this.__viewer_resize = function(){
						if(that.__centering_on_resize){
							return
						}
						// this will prevent centering calls from overlapping...
						that.__centering_on_resize = true

						that.resizingWindow()

						delete that.__centering_on_resize
					}

					$(window).resize(this.__viewer_resize)
				}

				// setup basic workspaces...
				if(this.workspaces['ui-chrome-hidden'] == null){
					this.workspaces['ui-chrome-hidden'] = {}
				}
			}],
		['stop', 
			function(){
				if(this.__viewer_resize){
					// XXX FOCUS_EVENT
					//$(window).off('focus', this.__window_focus_handler)
					//$(window).off('blur', this.__window_blur_handler)
					$(window).off('resize', this.__viewer_resize) 
					delete this.__viewer_resize
				}
			}],

		/*/ force browser to redraw images after resize...
		// NOTE: this fixes a bug where images are not always updated 
		// 		when off-screen...
		['resizingDone',
			function(){ this.scale = this.scale }],
		//*/

		['focusImage.post', 
			function(){ this.alignRibbons() }],

		// manage the .crop-mode css class...
		// XXX this is not the right spot for this...
		// 		...but this is a bit too small for a stand-alone feature...
		['load reload clear crop uncrop',
			function(){
				if(!this.dom){
					return
				}
				this.dom[this.cropped ? 
					'addClass' 
					: 'removeClass']('crop-mode')
			}],

		// update the alignment as soon as we switch modes...
		['toggleRibbonAlignMode',
			function(){ this.focusImage() }],
	],
})



/*********************************************************************/
// Utilities and Services...

// XXX make this work for external links in a stable manner...
// 		...a bit unpredictable when working in combination with history
// 		feature -- need to stop them from competing...
// 		...appears to be a bug in location....
var URLHash = 
module.URLHash = core.ImageGridFeatures.Feature({
	title: 'Handle URL hash',
	doc: '',

	tag: 'ui-url-hash',
	depends: ['ui'],

	//isApplicable: function(){ 
	//	return typeof(location) != 'undefined' && location.hash != null },
	isApplicable: function(){ return this.runtime.browser },

	handlers: [
		// hanlde window.onhashchange event...
		['start',
			function(){
				var that = this
				var handler = this.__hashchange_handler = function(){
					var h = location.hash
					h = h.replace(/^#/, '')
					that.current = h
				}
				$(window).on('hashchange', handler)
			}],
		['stop',
			function(){
				this.__hashchange_handler 
					&& $(window).off('hashchange', this.__hashchange_handler)
			}],
		// store/restore hash when we focus images...
		['focusImage',
			function(res, a){
				if(this.current && this.current != ''){
					location.hash = this.current
				}
			}],
		['load.pre',
			function(){
				var h = location.hash
				h = h.replace(/^#/, '')

				return function(){
					if(h != '' && this.data.getImageOrder(h) >= 0){
						this.current = h
					}
				}
			}],
	],
})



/*********************************************************************/
// Mouse...
//
// NOTE: for legacy stuff see: features/ui-legacy.js

// NOTE: removing the prop 'cursor-autohide' will stop hiding the cursor
// 		and show it on next timeout/mousemove.
// 		This will not stop watching the cursor, this setting the prop back
// 		on will re-enable autohide.
// NOTE: chrome 49 + devtools open appears to prevent the cursor from 
// 		being hidden...
var Cursor = 
module.Cursor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-cursor',
	depends: [
		'ui'
	],

	config: {
		'cursor-autohide-ignore-keys': [
			'shift', 'ctrl', 'alt', 'meta', 
			'F5',
		],

		'cursor-autohide': 'on',
		'cursor-autohide-on-timeout': 'off',
		'cursor-autohide-on-keyboard': 'on',

		'cursor-show-threshold': 10,

		'cursor-autohide-timeout': 1000,
		'cursor-keyboard-hide-timeout': 200,
	},

	actions: actions.Actions({
		toggleHiddenCursor: ['Interface/Cursor hidden',
			{mode: 'advancedBrowseModeAction'},
			toggler.CSSClassToggler(
				function(){ return this.dom }, 
				'cursor-hidden',
				function(state){
					var that = this
					var viewer = this.dom

					if(state == 'on'){
						var x, y

						// auto-show -- on mouse move greater than threshold...
						var handler 
							= this.__cursor_show_handler 
							= (this.__cursor_show_handler 
								|| function(evt){
									evt = window.event || evt
									var threshold = that.config['cursor-show-threshold'] || 0
									x = x || evt.clientX
									y = y || evt.clientY

									// show only if cursor moved outside of threshold...
									if(threshold > 0){ 
										if(Math.max(Math.abs(x - evt.clientX), 
												Math.abs(y - evt.clientY)) > threshold){
											x = y = null
											that.toggleHiddenCursor('off')
										}

									// show right away -- no threshold...
									} else {
										that.toggleHiddenCursor('off')
									}
								})

						viewer
							// hide the cursor...
							.addClass('cursor-hidden')
							// reset handler...
							.off('mousemove', handler)
							.mousemove(handler)

					// show...
					} else {
						viewer
							.removeClass('cursor-hidden')
							.off('mousemove', this.__cursor_show_handler)
					}
				})],

		// Toggle global auto-hiding the cursor...
		//
		// The cursor can hidden by the following user actions:
		//
		// 	- keyboard activity
		// 		toggled by: 
		// 			.toggleAutoHideCursorKeyboard(..)
		// 		hide delay is set by:
		// 			.config['cursor-keyboard-hide-timeout']
		// 		list of keys that will not hide the cursor is set via:
		// 			.config['cursor-autohide-ignore-keys']
		//
		// 	- mouse inactivity
		// 		toggled by:
		// 			.toggleAutoHideCursorTimeout(..)
		// 		inactivity period (timeout) is set by:
		// 			.config['cursor-autohide-timeout']
		//
		//
		// Moving the mouse will prevent it from being hidden by either
		// action.
		// The amount of movement required (threshold in pixels):
		// 	.config['cursor-show-threshold']
		//
		toggleAutoHideCursor: ['Interface/Cursor auto-hide',
			{mode: 'advancedBrowseModeAction'},
			toggler.CSSClassToggler(
				function(){ return this.dom }, 
				'cursor-autohide',
				function(state){
					var that = this

					var viewer = this.dom
					// NOTE: this is handled by the keyboard feature...
					var kb_target = this.__keyboard_event_source || $(window)

					this.config['cursor-autohide'] = state

					// setup...
					if(state == 'on'){
						var m_timer
						var timeout = 
							that.toggleAutoHideCursorTimeout('?') == 'on' ?
								(that.config['cursor-autohide-timeout'] || 1000)
								: -1

						// hide on timeout...
						var mouse_handler 
							= this.__cursor_autohide_mouse_handler 
							= (this.__cursor_autohide_mouse_handler 
								|| function(){
									m_timer && clearTimeout(m_timer)
									kb_timer && clearTimeout(kb_timer)
									kb_timer = null

									// hide on timeout...
									var timeout = 
										that.toggleAutoHideCursorTimeout('?') == 'on' ?
											(that.config['cursor-autohide-timeout'] || 1000)
											: -1
									if(timeout && timeout > 0){
										m_timer = setTimeout(function(){
											var viewer = that.dom

											// auto-hide is off -- restore...
											if(!viewer.hasClass('cursor-autohide')){
												that.toggleHiddenCursor('off') 
												return
											}

											m_timer && that.toggleHiddenCursor('on') 
										}, timeout)
									}
								})

						// hide on key...
						var kb_timer
						var key_handler 
							= this.__cursor_autohide_key_handler 
							= (this.__cursor_autohide_key_handler 
								|| function(evt){
									// prevent creating more than one timer at a time...
									if(kb_timer){
										return true
									}
									// avoid this from delaying the keyboard handler...
									kb_timer = setTimeout(function(){
										kb_timer = null
										var viewer = that.dom

										// get key...
										var key = keyboard.normalizeKey(
												keyboard.event2key(evt))
											.join('+')

										// auto-hide is off -- restore...
										if(!viewer.hasClass('cursor-autohide')){
											that.toggleHiddenCursor('off') 
											return
										}

										// hide if mode is on and non-ignored key...
										(that.config['cursor-autohide-ignore-keys'] 
												|| []).indexOf(key) < 0
											&& that.toggleAutoHideCursorKeyboard('?') == 'on'
											&& that.toggleHiddenCursor('on')
									}, that.config['cursor-keyboard-hide-timeout'] || 15)
									return true
								})

						// do the base setup...
						!viewer.prop('cursor-autohide')
							&& viewer
								// prevent multiple handlers...
								.off('mousemove', this.__cursor_autohide_mouse_handler)
								.on('mousemove', mouse_handler)
							&& kb_target 
								.on('keydown', key_handler)

						// hide the cursor right away only if timeout is set...
						timeout 
							&& timeout > 0 
							&& this.toggleHiddenCursor('on')

					// teardown...
					} else {
						this.__cursor_autohide_mouse_handler
							&& viewer
								.off('mousemove', this.__cursor_autohide_mouse_handler)
						delete this.__cursor_autohide_mouse_handler

						this.__cursor_autohide_key_handler
							&& kb_target 
								.off('keydown', this.__cursor_autohide_key_handler)
						delete this.__cursor_autohide_key_handler

						this.toggleHiddenCursor('off')
					}
				})],

		toggleAutoHideCursorTimeout: ['Interface/Hide cursor on timeout',
			{mode: 'advancedBrowseModeAction'},
			core.makeConfigToggler('cursor-autohide-on-timeout', 
				['on', 'off'],
				function(){ 
					this.toggleAutoHideCursor('!') })],
		toggleAutoHideCursorKeyboard: ['Interface/Hide cursor on keyboard',
			{mode: 'advancedBrowseModeAction'},
			core.makeConfigToggler('cursor-autohide-on-keyboard', 
				['on', 'off'],
				function(){ 
					this.toggleAutoHideCursor('!') })],
	}),

	handlers: [
		['start',
			function(){
				this.toggleAutoHideCursor(this.config['cursor-autohide'] || 'on') }],
	],
})



/*********************************************************************/
// Copy...

// XXX implement internal copy/paste...
var CopyImiage =
module.CopyImiage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-copy-image',
	depends: [
		'ui'
	],

	actions: actions.Actions({
		// XXX mark copied image(s)...
		copy: ['- Image|Edit/$Copy image',
			core.doc`Copy image

				Copy current image...
				.copy()

				Copy best matching preview of current image...
				.copy(size)

			`,
			function(size){
				// XXX
			}],
		// XXX if pasted image(s) is the one(s) marked by copy, do a shift action...
		paste: ['- Image|Edit/$Paste image',
			function(){
				// XXX
			}],
	}),
})



/*********************************************************************/
// Touch/Control...
//
//	.__control_in_progress
// 		Long interactions can set .__control_in_progress a number while 
// 		in progress and remove it when done.
// 		Each new interaction should increment this when starting and 
// 		decrement when done.
// 		This should be removed when 0
//
// 		This is to enable other events to handle the situation gracefully
//
// 		XXX how should multiple long interactions be handled??
// 		XXX revise...
//
// NOTE: modifies .ribbons -- event handlers, attrs, classes... (XXX)
// NOTE: for legacy stuff see: features/ui-legacy.js
//
// XXX add option to block click actions on focus...
// 		...this is already done in widget.overlay, but I think should be
// 		system-wide...

// XXX needs more thought.... 
var ControlActions = actions.Actions({
	config: {
		'control-mode': 'indirect',

		// This can be:
		// 	'silent'	- silently focus central image after pan
		// 	true		- focus central image after pan
		// 	null		- do nothing.
		'focus-central-image': 'silent',

		'ribbon-pan-threshold': 30,
		'control-in-progress-timeout': 100,

		'animation-frame-renderer': true,

		// if true and ribbon is panned off screen, the image will be 
		// centered, else behave just like partially off screen...
		'center-off-screen-paned-images': false,

		'mouse-wheel-scale': 0.5,

		'lock-unfocused': 'on',

		// The timeout to wait after window focus before unlocking the 
		// viewer 
		'window-focus-timeout': 200,

		// Debounce clicks/taps... 
		// 
		// All consecutive clicks within this timeout will be dropped.
		// To disable set to 0
		//
		// NOTE: this effectively disables double-clicks (by design).
		'image-click-debounce-timeout': 400,
	},

	// XXX do we need this???
	get touchSupported(){
		var t = this.__touchSupported = this.__touchSupported 
			|| (typeof(window) != 'undefined' 
				&& ('ontouchstart' in window || navigator.msMaxTouchPoints))
		return t
	},

	// Lock unfocused viewer...
	toggleUnfocusedLock: ['Interface/Lock unfocused viewer',
		core.doc`Toggle unfocused viewer locking...

		When enabled this will prevent mouse, touch and context menu events
		from reaching the viewer.

		NOTE: this defines the focus/blur handlers on the window object.`,
		{mode: 'advancedBrowseModeAction'},
		core.makeConfigToggler('lock-unfocused',
			['off', 'on'],
			function(state){
				var that = this
				var handlers = this.__focus_lock_handlers = this.__focus_lock_handlers || {}
				var unlock = handlers.unlock = handlers.unlock
					|| function(){ 
						setTimeout(function(){ 
							that.dom.find('.lock-clicks').remove() 
						}, that.config['window-focus-timeout'] || 0) }
				var lock = handlers.lock = handlers.lock
					|| function(){
						that.dom.find('.lock-clicks').length == 0
							&& that.dom
								.append($('<div>')
									.addClass('lock-clicks')
									.on('click contextmenu',function(evt){
										evt.stopPropagation()
										evt.preventDefault()
									})) }

				// we reset the handlers to avoid multiple triggers...
				$(window)
					.off('focus', unlock)
					.off('blur', lock)

				// setup...
				if(state == 'on'){
					$(window)
						.focus(unlock)
						.blur(lock)

					// setup initial state...
					document.hasFocus() ? unlock() : lock()

				// tare down...
				} else {
					unlock()
					delete this.__focus_lock_handlers
				}
			})],

	// Image click events...
	imageOuterBlockClick: ['- Interface/Image outer block click event',
		core.doc`Image outer block click event

		This is triggered on click on an image block but outside of the
		actual image.

		imageBlockClick event is triggered and run between the .pre()/.post()
		stages of this event.

		imageClick is not triggered.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],
	imageBlockClick: ['- Interface/Image block click event',
		core.doc`Image block click event

		This is triggered on any click on an image block.

		imageClick event if triggered is run between the .pre()/.post()
		stages of this event.

		The .pre(..) stage of the event is called before the clicked 
		image is focused and the .post(..) stage is called after focusing
		is done.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],
	imageClick: ['- Interface/Image click event',
		core.doc`Image click event

		This is triggered only if the click/tap is made within the actual 
		image.

		The .pre(..) stage of the event is called before the clicked 
		image is focused and the .post(..) stage is called after focusing
		is done.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],

	// Image menu events...
	//
	// NOTE: these will not focus an image...
	imageOuterBlockMenu: ['- Interface/Image outer block menu event',
		core.doc`Image outer block menu event

		This is triggered on menu on an image block but outside of the
		actual image.

		imageBlockMenu event is triggered and run between the .pre()/.post()
		stages of this event.

		imageMenu is not triggered.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],
	imageBlockMenu: ['- Interface/Image block menu event',
		core.doc`Image block menu event

		This is triggered on any click on an image block.

		imageMenu event if triggered is run between the .pre()/.post()
		stages of this event.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],
	imageMenu: ['- Interface/Image menu event',
		core.doc`Image menu event

		This is triggered only if the click/tap is made within the actual 
		image.

		NOTE: this does not account for animation.
		`,
		core.Event(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],

	// XXX need to debounce the clicks...
	// XXX do not do anything on viewer focus... (???)
	// XXX depends on .ribbons...
	// XXX uses: .focusImage(..)
	toggleImageClickHandling: ['Interface/Image click handling',
		{mode: 'advancedBrowseModeAction'},
		toggler.Toggler(null,
			function(_, new_state){ 
				return new_state ?
						// NOTE: we are not setting the state here, so
						// 		nothing to do...
						null
					: (this.ribbons 
							&& this.dom 
							//&& this.ribbons.getRibbon().data('hammer') ? 'handling-click' : 'none' },
							&& this.ribbons.getRibbon().hasClass('clickable')) ? 
						'handling-click' 
					: 'none' },
			'handling-click',
			function(state){
				var that = this

				var setup = this.__click_handler_setup = this.__click_handler_setup 
					|| function(_, target){
						var r = that.ribbons.getRibbon(target)
						if(r.length > 0 && !r.hasClass('clickable')){

							r.data('hammer') == null 
								&& r.hammer()

							r
								.addClass('clickable')
								.on('contextmenu', menuHandler)
								.on('tap', tapHandler)
								.data('hammer')
									.get('tap')
										.set({
											//interval: 1,
											time: 500,
										})
						}
					}

				var isImageClicked = function(event, img){
					var img = img || $(event.target)

					// sanity check: only handle clicks on images...
					if(!img.hasClass('image')){
						return false
					}

					// get the offset within the image...
					// NOTE: this does not account for border width, this
					// 		clicks on the top/left border will result in 
					// 		negative values...
					var x = event.offsetX
					var y = event.offsetY
					var W = img[0].offsetWidth
					var H = img[0].offsetHeight

					// get preview size...
					// NOTE: this is not normalized to image block size...
					// NOTE: we do not need to account for orientation 
					// 		because the margins will take care of it for
					// 		us...
					// 		XXX not fully sure if the reason here is
					// 			correct, but the thing works...
					// NOTE: preview-width/preview-height can be unset 
					// 		for blank image blocks or virtual images...
					var w = img.attr('preview-width') || W
					var h = img.attr('preview-height') || H

					// normalize preview size to image block size...
					var s = Math.min(W/w, H/h)
					w *= s
					h *= s

					// preview offsets within the block...
					// NOTE: this assumes the image is centered...
					var dw = (W-w)/2
					var dh = (H-h)/2

					// check if we clicked the image...
					// NOTE: this assumes the image is centered...
					return (x >= dw && x <= W-dw)
						&& (y >= dh && y <= H-dh)
				}
				var makeImageHandler = function(outerBlockEvt, blockEvt, imageEvt, focus){
					return function(evt){
						evt = window.event || evt
						var img = img || $(evt.target)
						var gid = that.ribbons.elemGID(img)
						var x = evt.offsetX
						var y = evt.offsetY

						// debounce the clicks/taps...
						if(that.config['image-click-debounce-timeout'] != 0){
							if(that.__clicked_image == gid){
								return
							}
							that.__clicked_image = gid
							setTimeout(function(){
								delete that.__clicked_image
							}, that.config['image-click-debounce-timeout'] || 400)
						}


						var clicked_image = isImageClicked(evt, img)

						var inner = function(){
							focus ?
								that[blockEvt]
									.chainCall(that, 
										function(){ 
											clicked_image ?
												// trigger this only if we clicked
												// within the image...
												that[imageEvt]
													.chainCall(that, 
														function(){ that.focusImage(gid) }, 
														gid, x, y)
												: that.focusImage(gid)
										},
										gid, x, y)
								: that[blockEvt]
									.chainCall(that, 
										function(){ 
											// trigger this only if we clicked
											// within the image...
											clicked_image
												&& that[imageEvt](gid, x, y)
										},
										gid, x, y)
						}

						!clicked_image ?
							that[outerBlockEvt].chainCall(that, inner, gid, x, y)
							: inner()

					}
				}

				// the main handlers...
				var tapHandler = setup.tapHandler = setup.tapHandler 
					|| makeImageHandler('imageOuterBlockClick', 'imageBlockClick', 'imageClick', true)
				var menuHandler = setup.menuHandler = setup.menuHandler 
					|| makeImageHandler('imageOuterBlockMenu', 'imageBlockMenu', 'imageMenu', false)

				// on...
				if(state == 'on'){
					this.off('updateRibbon', setup)
					this.on('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						setup.call(this, null, gid)
					})

				// off...
				} else {
					this.off('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						var r = that.ribbons.getRibbon(gid)

						// XXX
						//var h = r.data('hammer')
						//h && h.destroy()

						r
							.removeClass('clickable')
							// XXX this does not remove the hammer trigger
							// 		...just the jQuery handler is cleared
							.off('tap')
							.off('contextmenu', menuHandler)
							//.removeData('hammer')
					})
				}
			})],

	// XXX revise name...
	// XXX depends on .ribbons...
	makeRibbonVisible: ['- Interface/Make ribbon visible if it is off screen',
		function(target, center_off_screen){
			var r = this.ribbons.getRibbon(target)
			var rgid = this.ribbons.elemGID(r)

			var central = this.ribbons.getImageByPosition('center', r)

			var rl = r.offset().left

			if(!center_off_screen && central == null){
				var gid = this.data.getImage(rl < 0 ? -1 : 0, rgid)
				var central = this.ribbons.getImage(gid)
			}

			var cl = central && central.offset().left
			var w = central && central.outerWidth(true)
			var W = this.dom.width()
			var vmin = Math.min(
				document.body.offsetWidth, 
				document.body.offsetHeight)

			// check if central if off screen, if yes, 
			// nudge it into user-accessible area...
			//
			// we are fully off screen -- focus first/last image...
			if(central == null){
				var gid = this.data.getImage(rl < 0 ? -1 : 0, rgid)

				this.centerImage(gid)
				central = this.ribbons.getImage(gid)

			// partly out the left -- show last image...
			} else if(cl < 0){
				var s = this.scale
				r.transform({ 
					x: (parseFloat((r.transform('translate3d') || [0])[0]) 
						- ((cl / s) / vmin * 100)) + 'vmin'
				})

			// partly out the right -- show first image...
			} else if(cl + w > W){
				var s = this.scale
				r.transform({
					x: (parseFloat((r.transform('translate3d') || [0])[0]) 
						+ (((W - (cl + w)) / s) / vmin * 100)) + 'vmin'
				})
			}

			// load stuff if needed...
			this.updateRibbon(central)
		}],

	// Ribbon pan "event"...
	//
	// Protocol:
	// 	- pre phase is called when pan is started.
	//	- post phase is called when pan is finished.
	//
	// This is not intended to be called by user, instead it is 
	// internally called by the pan handler.
	//
	// NOTE: more than one ribbon can be panned at once.
	ribbonPanning: ['- Interface/',
		core.Event(function(gid){
			// This is ribbon pan event...
			//
			// Not for direct use.
		})],

	// XXX still a bit lagging behind in chrome -- can we go faster??
	// 		...appears similar to iScroll on chrome on desktop...
	// XXX this is really slow/buggy on IE... 
	// 		...found the problem, need to disable transitions for this 
	// 		to work semi smoothly...
	// XXX depends on .ribbons...
	// XXX uses: .focusImage(..)
	toggleRibbonPanHandling: ['Interface/Ribbon pan handling',
		{mode: 'advancedBrowseModeAction'},
		toggler.Toggler(null,
			function(_, new_state){ 
				return new_state ?
						// NOTE: we are not setting the state here, so there's 
						// 		nothing to do...
						null
					: (this.ribbons 
							&& this.dom 
							&& this.ribbons.getRibbon().hasClass('draggable')) ?  
						'handling-pan' 
					: 'none' },
			'handling-pan',
			function(state){
				var that = this

				// render framework...
				// XXX make this global to handle other stuff...
				// XXX does this offer any real advantages???
				var render_data = {}
				var render = function(){
					for(var rgid in render_data){
						var r = render_data[rgid]
						delete render_data[rgid]

						r.ribbon.transform({ x: r.x })
					}
					renderer = requestAnimationFrame(render)
				}
				var renderer


				var stop_scroll = this.__scroll_prevnter = this.__scroll_prevnter 
					|| function(evt){ evt.preventDefault() }
				var setup = this.__pan_handler_setup = this.__pan_handler_setup 
					|| function(_, target){
						// XXX
						var that = this

						var r = this.ribbons.getRibbon(target)
						var rgid = this.ribbons.elemGID(r)

						var data = false
						var post_handlers

						// setup dragging...
						if(r.length > 0 && !r.hasClass('draggable')){

							r.data('hammer') == null 
								&& r.hammer()

							r
								.addClass('draggable')
								.data('hammer')
									.get('pan')
										.set({
											direction: Hammer.DIRECTION_HORIZONTAL,
											threshold: this.config['ribbon-pan-threshold'],
										})

							r.on('touchmove mousemove', stop_scroll)
							r.on('pan', function(evt){
								//evt.stopPropagation()

								// XXX stop all previous animations...
								//r.velocity("stop")

								var d = that.ribbons.dom
								var g = evt.gesture
								var s = that.scale
								var vmin = Math.min(document.body.offsetWidth, document.body.offsetHeight)

								// we just started...
								if(!data){
									that.__control_in_progress = (that.__control_in_progress || 0) + 1
									post_handlers = that.ribbonPanning.pre(that, [rgid])

									// XXX prevent IE from fighting transitions...
									that.ribbons.preventTransitions(r)

									// store initial position...
									data = {
										//left: d.getOffset(this).left,
										left: parseFloat(($(this).transform('translate3d') || [0])[0])/100 * vmin,
										pointers: g.pointers.length,
									}

									// restart the renderer...
									renderer = renderer && cancelAnimationFrame(renderer)
									if(that.config['animation-frame-renderer']){
										renderer = requestAnimationFrame(render)
									}
								}


								// animation frame render...
								if(renderer){
									// queue a render...
									render_data[rgid] = {
										ribbon: r,
										x: ((data.left + (g.deltaX / s)) / vmin * 100) + 'vmin',
									}

								// inline render...
								} else {
									// do the actual move...
									r.transform({
										x: ((data.left + (g.deltaX / s)) / vmin * 100) + 'vmin',
									})

									/* XXX this seems to offer no speed advantages 
									 * 		vs. .setOffset(..) but does not play
									 * 		well with .updateRibbon(..)
									 *
									r	
										.velocity('stop')
										.velocity({ 
											translateX: data.left + (g.deltaX / s),
											translateY: 0, 
											translateZ: 0,
										}, 0)
									//*/
								}


								// update ribbon when "pulling" with two fingers...
								//
								// NOTE: this only happens when number of fingers
								// 		changes, thus no lag should be noticeable...
								if(g.pointers.length != data.pointers){
									data.pointers = g.pointers.length

									// load stuff if needed...
									that.updateRibbon(that.ribbons.getImageByPosition('center', r))
								}


								// we are done...
								if(g.isFinal){
									data = false

									// XXX is this the correct way to do this???
									requestAnimationFrame(function(){
										that.makeRibbonVisible(r, 
											that.config['center-off-screen-paned-images'])
										
										// XXX is this the right place for this???
										that.ribbons.restoreTransitions(r)

										// XXX add inertia....
										// XXX

										// see if we need to change focus...
										var current_ribbon = that.data.getRibbon()
										if(current_ribbon == rgid){
											var central = that.ribbons.getImageByPosition('center', r)
											var gid = that.ribbons.elemGID(central)
											// silently focus central image...
											if(that.config['focus-central-image'] == 'silent'){
												that.data.focusImage(gid)
												that.ribbons.focusImage(that.current)
												
											// focus central image in a normal manner...
											} else if(that.config['focus-central-image']){
												that.data.focusImage(gid)
												that.focusImage()
											}
										}

										// this is not time-critical so do it outside the animation...
										setTimeout(function(){
											that.ribbonPanning.post(that, post_handlers)
										}, 0)
									})

									setTimeout(function(){
										that.__control_in_progress -= 1
										if(that.__control_in_progress <= 0){
											delete that.__control_in_progress

											//that.ribbonPanning.post(that, post_handlers)
										}
									}, that.config['control-in-progress-timeout'] || 100)
								}
							})
						}
					}

				// on...
				if(state == 'on'){
					// NOTE: we are resetting this to avoid multiple setting
					// 		handlers...
					this.off('updateRibbon', setup)
					this.on('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						setup.call(that, null, gid)
					})

				// off...
				} else {
					this.off('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						var r = that.ribbons.getRibbon(gid)

						// XXX
						//var h = r.data('hammer')
						//h && h.destroy()

						r
							.removeClass('draggable')
							// XXX this does not remove the hammer trigger
							// 		...just the jQuery handler is cleared
							.off('pan')
							.off('touchmove mousemove', stop_scroll)
							// XXX
							//.removeData('hammer')

						// XXX can this be a spot for a race???
						renderer = renderer && cancelAnimationFrame(renderer)
					})
				}
			})],

	// Ribbon/viewer wheel...
	//
	// XXX need:
	// 		- prevent ribbon from scrolling off screen...
	// 		- handle acceleration -- stop and update just before scrolling off the edge...
	// 		- update...
	// XXX might be a good idea to use the viewer instead of ribbons as source...
	// 		...this will prevent losing control of the ribbon when it goes out
	// 		from under the cursor...
	// 		...detect via cursor within the vertical band of the ribbon...
	// XXX BUG?: acceleration seems to be increasing with time...
	// XXX add a "ribbonWheeling" ( ;) ) event a-la ribbonPanning...
	// XXX depends on .ribbons...
	// XXX uses: .focusImage(..)
	toggleMouseWheelHandling: ['Interface/Mouse wheel handling',
		{mode: 'advancedBrowseModeAction'},
		toggler.Toggler(null,
			function(_, new_state){
				return new_state ?
						// NOTE: we are not setting the state here, so there's 
						// 		nothing to do...
						null
					: (this.ribbons 
						&& this.dom 
						&& this.dom.hasClass('mouse-wheel-scroll')) ?
						'handling-mouse-wheel' 
					: 'none' },
			'handling-mouse-wheel',
			function(state){
				var that = this

				/*
				var focus_central = function(rgid){
					// see if we need to change focus...
					var current_ribbon = that.data.getRibbon()
					if(current_ribbon == rgid){
						var central = that.ribbons.getImageByPosition('center', r)
						var gid = that.ribbons.elemGID(central)
						// silently focus central image...
						if(that.config['focus-central-image'] == 'silent'){
							that.data.focusImage(gid)
							that.ribbons.focusImage(that.current)
							
						// focus central image in a normal manner...
						} else if(that.config['focus-central-image']){
							that.data.focusImage(gid)
							that.focusImage()
						}
					}
				}
				*/

				var setup = this.__wheel_handler_setup = this.__wheel_handler_setup 
					|| function(_, target){
						var that = this

						var r = this.ribbons.getRibbon(target)
						var rgid = this.ribbons.elemGID(r)

						// XXX vertical scroll...
						this.dom
							.on('wheel', function(){
							})

						// horizontal scroll...
						r.on('wheel', function(evt){
							evt = window.event || evt
							evt.preventDefault()

							var s = that.config['mouse-wheel-scale'] || 1
							var vmin = Math.min(document.body.offsetWidth, document.body.offsetHeight)
							var left = parseFloat(($(this).transform('translate3d') || [0])[0])/100 * vmin

							// XXX inertia problem -- it's too easy to scroll a ribbon off the screen...
							// 		try:
							// 			- limit speed
							// 			- limit distance 
							// 				1-2 screens -> stop for timeout before continue
							// 				...need to keep track of "scroll sessions"

							// XXX prevent scroll off screen....

							// XXX prevent scroll off loaded edge...
							
							// XXX focus_central(rgid) when scroll slows down...
							// 		(small deltaX or longer time between triggerings)...

							// XXX do we need to do requestAnimationFrame(..) render...
							// 		...see toggleRibbonPanHandling(..) for an implementation...

							// do the actual move...
							r.transform({
								x: ((left - (evt.deltaX * s)) / vmin * 100) + 'vmin',
							})
						})

					}

				// on...
				if(state == 'on'){
					this.dom.addClass('mouse-wheel-scroll')
					// NOTE: we are resetting this to avoid multiple setting
					// 		handlers...
					this.off('updateRibbon', setup)
					this.on('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						setup.call(that, null, gid) })

				// off...
				} else {
					this.dom.removeClass('mouse-wheel-scroll')
					this.off('updateRibbon', setup)

					this.data.ribbon_order.forEach(function(gid){
						that.ribbons.getRibbon(gid).off('wheel') })
				}
			})],
	
	togglePinchHandling: ['Interface/Pinch zoom handling',
		{mode: 'advancedBrowseModeAction'},
		function(){
			// XXX
		}],


	// XXX make the enable handling check a bit more general...
	// 		...allow ui features to control this...
	// XXX depends on .ribbons...
	toggleSwipeHandling: ['Interface/Swipe handling',
		//{mode: 'advancedBrowseModeAction'},
		toggler.Toggler(null,
			function(_, state){ 
				return state ?
						null
					: (this.ribbons 
							&& this.dom 
							&& this.dom.data('hammer')) ? 
						'handling-swipes' 
					: 'none' },
			'handling-swipes',
			function(state){
				var viewer = this.dom

				// on...
				if(state == 'on'){
					var that = this

					// prevent multiple handlers...
					if(viewer.data('hammer') != null){
						return
					}

					viewer.hammer()

					viewer.data('hammer')
						.get('swipe')
							.set({
								direction: Hammer.DIRECTION_ALL,
								// do not handle swipes when a modal 
								// dialog is open...
								// XXX make this more general...
								enable: function(){ return !that.modal },
							})

					if(!viewer.hasClass('swipable')){
						viewer
							.addClass('swipable')
							.on('swipeleft', function(){ 
								that.__control_in_progress || that.nextImage() })
							.on('swiperight', function(){ 
								that.__control_in_progress || that.prevImage() })
							.on('swipeup', function(){ 
								that.__control_in_progress || that.shiftImageUp() })
							.on('swipedown', function(){ 
								that.__control_in_progress || that.shiftImageDown() })
					}

				// off...
				} else {
					var h = viewer.data('hammer')
					h && h.destroy()

					viewer
						.removeClass('swipable')
						.off('swipeleft')
						.off('swiperight')
						.off('swipeup')
						.off('swipedown')
						.removeData('hammer') } })],


	/*// XXX we are not using this....
	__control_mode_handlers__: {
		indirect: 
			function(state){
				this.toggleSwipeHandling(state)
			},
		direct:
			function(state){
			},
	},
	toggleControlMode: ['- Interface/',
		toggler.Toggler(null,
			function(_, state){ return state == null ? null : this.config['control-mode'] },
			function(){ return Object.keys(this.__control_mode_handlers__ || [])
				.concat(Object.keys(ControlActions.__control_mode_handlers__ || []))
				.concat(['none'])
				.unique() },
			function(state){ 
				var that = this

				var _getHandler = function(name){
					return (that.__control_mode_handlers__ || {})[name]
						|| (ControlActions.__control_mode_handlers__ || {})[name]
				}

				// clear previous state...
				var prev_state =this.toggleControlMode('?')
				prev_state != 'none' && _getHandler(prev_state).call(this, 'off')

				// set next state...
				if(state != 'none'){
					_getHandler(state).call(this, 'on')
				}

				this.config['control-mode'] = state
			})],
	//*/
})


var Control = 
module.Control = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-control',
	//exclusive: ['ui-control'],
	depends: [
		'ui'
	],
	actions: ControlActions,

	handlers: [
		['start',
			function(){
				this.toggleUnfocusedLock('!') 
			}],
		['load',
			function(){
				this.toggleImageClickHandling('on')
				this.toggleSwipeHandling('on')
				this.toggleRibbonPanHandling('on')
			}],
		['stop',
			function(){
				this.toggleImageClickHandling('off')
				this.toggleSwipeHandling('off')
				this.toggleRibbonPanHandling('off')
			}],

		['toggleSingleImage',
			function(){
				this.toggleRibbonPanHandling(
					this.toggleSingleImage('?') == 'off' ? 'on' : 'off')
			}],
			
		// if panned image is off screen, center it...
		['viewScale',
			function(){
				var that = this
				Object.keys(this.data.ribbons).forEach(function(r){
					//that.makeRibbonVisible(r)
				})
			}],
	],
})



/*********************************************************************/

var FailsafeDevTools = 
module.FailsafeDevTools = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fail-safe-devtools',

	priority: 'low',
	depends: [
		'ui',
	],

	handlers: [
		['start',
			function(){
				// NOTE: this is set in index.html
				window.__devtools_failsafe 
					&& clearTimeout(window.__devtools_failsafe) }],
	],
})



/*********************************************************************/

// NOTE: this updates the current image block CSS...
var PreviewFilters
module.PreviewFilters = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-preview-filters',
	depends: [ 
		'ui',
		'ui-status-bar',
	],

	config: {
		'preview-filters': {
			// exposure aids...
			'Show clipping': 'image-shadows-and-highlights',
			'Show shadows': 'image-gamma-shadows',

			// sharpness aids...
			'Black and white': 'image-bw',
			'Edge detect': 'image-edge-detect',

			'No filters': 'none',
		},
	},

	actions: actions.Actions({
		togglePreviewFilter: ['Image/Preview filter',
			core.doc`Toggle image preview filter

			This is different to normal togglers in that toggling an explicit
			state repeatedly will toggle between that state and 'No filters'
			effectively toggling the filter on and off...

				// toggle through all the filters...
				.togglePreviewFilter()
					-> state

				// toggle 'Show shadows' on/off...
				.togglePreviewFilter('Show shadows')
					-> state

				// togglue current filter off if applied... 
				.togglePreviewFilter('!')
					-> state

			`,
			toggler.Toggler(null,
				function(_, state){ 
					var filters = this.config['preview-filters']
					var img = this.ribbons.getImage()

					// get state...
					if(state == null){
						for(var s in filters){
							if(img.hasClass(filters[s])){
								return s
							}
						}
						return 'No filters'
					}

					// clear filters...
					var cls = filters[state]
					var classes = Object.values(filters)
						.filter(function(c){ return c != cls })
					this.dom
						.find('.filter-applied')
							.removeClass(classes.join(' ') +' filter-applied')

					// toggle filter...
					if(cls != 'none' && state in filters){
						// NOTE: we are not using .toggleClass(..) here 
						// 		because we need to ensure *both* the cls 
						// 		and '.filter-applied' classes are set to
						// 		the same state...
						if(img.hasClass(cls)){
							img.removeClass(cls +' filter-applied')

						} else {
							img.addClass(cls +' filter-applied')
							return state
						}
					}

					// XXX not sure if this is needed...
					//return (cls != 'none' && img.hasClass(cls)) ? 
					//	state 
					//	: 'No filters'
					return 'No filters'
				},
				function(){ 
					return Object.keys(this.config['preview-filters']) })],
	}),

	handlers: [
		['focusImage',
			function(){ this.togglePreviewFilter('No filters') }],
		['togglePreviewFilter',
			function(res){
				res != 'No filters' ?
					this.showStatusBarInfo(res, 1000) 
					: this.showStatusBarInfo() }],
	],
})



/*********************************************************************/
// XXX EXPERIMENTAL...

// 		...not sure if this is the right way to go...
// XXX need to get the minimal size and not the width as results will 
// 		depend on viewer format...
var AutoSingleImage = 
module.AutoSingleImage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'auto-single-image',

	// NOTE: this feature has no actions defined but needs the config...
	config: {
		'auto-single-image-in': 2,
		'auto-single-image-out': 7,
	},

	handlers: [
		['resizing.pre',
			function(count){
				count = count || 1

				if(this.toggleSingleImage('?') == 'off' 
						&& count < this.config['auto-single-image-in']
						&& count < this.screenwidth){
					this.toggleSingleImage()

				} else if(this.toggleSingleImage('?') == 'on' 
						&& count >= this.config['auto-single-image-out']
						&& count > this.screenwidth){
					this.toggleSingleImage()
				}
			}],
	],
})

var AutoRibbon = 
module.AutoRibbon = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'auto-ribbon',

	handlers: [
		['nextRibbon prevRibbon',
			function(){
				this.toggleSingleImage('?') == 'on' 
					&& this.toggleSingleImage('off') }],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
