/**********************************************************************
* 
* User Interface Features...
*
* Features:
* 	- ui
* 		implements basic ui actions...
*	- config-local-storage
*		maintain configuration state in local storage
*	- ui-url-hash
*		handle .location.hash
*	- ui-cursor
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
var ViewerActions = 
module.ViewerActions = actions.Actions({
	config: {
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

		// The timeout to wait after window focus before setting .focused 
		// to true.
		'window-focus-timeout': 200,

		
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

	// Focus...
	//
	// This is true when window is focused and false when not + 200ms 
	// after focusing.
	// This enables the used to ignore events that lead to window focus.
	get focused(){
		return !!this.__focus_lock.state },

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
		function(target, scale, now){
			if(target == 'now'){
				now = true
				target = null
			}
			var mode = this.config['ribbon-align-mode'] 
				|| this.config['ribbon-focus-mode']
			var modes = this.config['ribbon-align-modes']

			if(mode in modes && mode != 'manual'){
				this[modes[mode]](target, scale, now)

			// manual...
			// XXX is this correct???
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
				this.__align_timeout = null
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
		core.notUserCallable(function(){
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
		core.notUserCallable(function(unit, size, overflow){
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
		core.notUserCallable(function(){
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
		{browseMode: function(){
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
		{browseMode: function(){
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
	rotateRibbonCCW: ['Interface|Ribbon/Rotate ribbon coounter clockwise', 
		function(a){ 
			this.ribbonRotation('-='+ (a || this.config['ribbon-rotation-step'] || 10)) }],

	resetRibbonRotation: ['Interface|Ribbon/Reset ribbon rotation',
		{browseMode: function(){
			return this.ribbonRotation() == 0 && 'disabled' }},
		function(){ this.ribbonRotation(0) }],


	// XXX EXPERIMENTAL: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	// 		...should this be a crop???
	toggleRibbonList: ['Interface|Ribbon/Ribbons as images view',
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
	isApplicable: function(){ return typeof(window) == typeof({}) },

	handlers: [
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
					$(window).off('resize', this.__viewer_resize) 
					delete this.__viewer_resize
				}
			}],

		// focus-lock...
		['start',
			function(){
				var that = this
				var focus_lock = this.__focus_lock = this.__focus_lock || {}
				var focused = focus_lock.state = focus_lock.state || document.hasFocus()
				var unlock = focus_lock.unlock = focus_lock.unlock 
					|| function(){ setTimeout(
							function(){ focus_lock.state = true },
							that.config['window-focus-timeout'] || 0) }
				var lock = focus_lock.lock = focus_lock.lock 
					|| function(){ focus_lock.state = false }

				$(window)
					.focus(unlock)
					.blur(lock)
			}],
		['stop',
			function(){
				var focus_lock = this.__focus_lock = this.__focus_lock || {}
				var unlock = focus_lock.unlock 
				var lock = focus_lock.lock

				unlock 
					&& $(window).off('focus', unlock)
				lock 
					&& $(window).off('blur', lock)
			}],

		/*/ force browser to redraw images after resize...
		// NOTE: this fixes a bug where images are not always updated 
		// 		when off-screen...
		['resizingDone',
			function(){ this.scale = this.scale }],
		//*/

		['focusImage.post', 
			function(){ this.alignRibbons() }],
	],
})



/*********************************************************************/
// Utilities and Services...

var ConfigLocalStorageActions = actions.Actions({
	config: {
		'config-local-storage-key': 'config',
		
		// NOTE: this is in seconds...
		// NOTE: if this is null or 0 the timer will not start...
		'config-auto-save-local-storage-interval': 3*60,

		// XXX not sure what should be the default...
		'config-local-storage-save-diff': true,
	},

	// XXX should we store this in something like .default_config and
	// 		clone it???
	// 		...do not think so, as the __base_config should always be set
	// 		to the values set in code... (check this!)
	__base_config: null,
	__config_loaded: null,
	__auto_save_config_timer: null,

	// Disable localStorage in child, preventing two viewers from messing
	// things up in one store...
	clone: [function(){
		return function(res){
			res.config['config-local-storage-key'] = null
		}
	}],

	storeConfig: ['File/Store configuration',
		function(key){
			var key = key || this.config['config-local-storage-key']

			if(key != null){
				// build a diff...
				if(this.config['config-local-storage-save-diff']){
					var base = this.__base_config || {}
					var cur = this.config
					var config = {}
					Object.keys(cur)
						.forEach(function(e){
							if(cur.hasOwnProperty(e) 
									&& base[e] != cur[e] 
									// NOTE: this may go wrong for objects
									// 		if key order is different...
									// 		...this is no big deal as false
									// 		positives are not lost data...
									|| JSON.stringify(base[e]) != JSON.stringify(cur[e])){
								config[e] = cur[e]
							}
						})

				// full save...
				} else {
					var config = this.config
				}

				// store...
				localStorage[key] = JSON.stringify(config) 
			}
		}],
	loadStoredConfig: ['File/Load stored configuration',
		function(key){
			key = key || this.config['config-local-storage-key']

			if(key && localStorage[key]){
				// get the original (default) config and keep it for 
				// reference...
				// NOTE: this is here so as to avoid creating 'endless'
				// 		config inheritance chains...
				base = this.__base_config = this.__base_config || this.config

				var loaded = JSON.parse(localStorage[key])
				loaded.__proto__ = base

				this.config = loaded 
			}
		}],
	// XXX need to load the reset config, and not just set it...
	resetConfig: ['File/Reset settings',
		function(){
			this.config = this.__base_config || this.config
		}],

	toggleAutoStoreConfig: ['File/Store configuration',
		toggler.Toggler(null, 
			function(_, state){ 
				if(state == null){
					return this.__auto_save_config_timer || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-local-storage-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// this cleans up before 'on' and fully handles 'off' action...
					if(this.__auto_save_config_timer != null){
						clearTimeout(this.__auto_save_config_timer)
						delete this.__auto_save_config_timer
					}

					if(state == 'running' 
							&& interval 
							&& this.__auto_save_config_timer == null){

						var runner = function(){
							clearTimeout(that.__auto_save_config_timer)

							//that.logger && that.logger.emit('config', 'saving to local storage...')
							that.storeConfig()

							var interval = that.config['config-auto-save-local-storage-interval']
							if(!interval){
								delete that.__auto_save_config_timer
								return
							}
							interval *= 1000

							that.__auto_save_config_timer = setTimeout(runner, interval)
						}

						runner()
					}
				}
			},
			'running')],
})

var ConfigLocalStorage = 
module.ConfigLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'config-local-storage',
	depends: [
		'ui',
	],
	priority: 80,

	isApplicable: function(){ 
		return typeof(localStorage) != 'undefined' 
			&& localStorage != null },

	actions: ConfigLocalStorageActions,

	handlers: [
		// NOTE: considering that allot depends on this it must be 
		// 		first to run...
		['start.pre',
			function(){ 
				this.logger && this.logger
					.push('Startup')
						.emit('loaded', 'config')
				this
					.loadStoredConfig() 
					.toggleAutoStoreConfig('on')
			}],
		['stop.pre',
			function(){ 
				this.logger && this.logger
					.push('Shutdown')
						.emit('stored', 'config')
				this
					.storeConfig() 
					.toggleAutoStoreConfig('off')
			}],
	],
})



//---------------------------------------------------------------------

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
	isApplicable: function(){ return this.runtime == 'browser' },

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
					&& $(window).on('hashchange', this.__hashchange_handler)
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
								|| function(){
									var threshold = that.config['cursor-show-threshold'] || 0
									x = x || event.clientX
									y = y || event.clientY

									// show only if cursor moved outside of threshold...
									if(threshold > 0){ 
										if(Math.max(Math.abs(x - event.clientX), 
												Math.abs(y - event.clientY)) > threshold){
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
			core.makeConfigToggler('cursor-autohide-on-timeout', 
				['on', 'off'],
				function(){ this.toggleAutoHideCursor('!') })],
		toggleAutoHideCursorKeyboard: ['Interface/Hide cursor on keyboard',
			core.makeConfigToggler('cursor-autohide-on-keyboard', 
				['on', 'off'],
				function(){ this.toggleAutoHideCursor('!') })],
	}),

	handlers: [
		['start',
			function(){
				this.toggleAutoHideCursor(this.config['cursor-autohide'] || 'on') }],
	],
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

// XXX STUB: needs more thought.... 
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
	},

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
		core.notUserCallable(function(gid, x, y){
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
		core.notUserCallable(function(gid, x, y){
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
		core.notUserCallable(function(gid, x, y){
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
		core.notUserCallable(function(gid, x, y){
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
		core.notUserCallable(function(gid, x, y){
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
		core.notUserCallable(function(gid, x, y){
			// This is image clicked event...
			//
			// Not for direct use.
		})],

	// XXX do not do anything on viewer focus... (???)
	// XXX depends on .ribbons...
	// XXX uses: .focusImage(..)
	toggleImageClickHandling: ['Interface/Image click handling',
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
					var w = img.attr('preview-width')
					var h = img.attr('preview-height')

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
					return function(){
						var img = img || $(event.target)
						var gid = that.ribbons.elemGID(img)
						var x = event.offsetX
						var y = event.offsetY

						var clicked_image = isImageClicked(event, img)

						// ignore clicks when focusing window...
						if(!that.focused){
							return
						}

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
		core.notUserCallable(function(gid){
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
						r.on('wheel', function(){
							event.preventDefault()

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
								x: ((left - (event.deltaX * s)) / vmin * 100) + 'vmin',
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
		function(){
			// XXX
		}],


	// XXX make the enable handling check a bit more general...
	// 		...allow ui features to control this...
	// XXX depends on .ribbons...
	toggleSwipeHandling: ['Interface/Swipe handling',
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
						.removeData('hammer')
				}
			})],


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
		'ui' 
	],

	config: {
		'preview-filters': {
			'Black and white': 'image-bw',
			'Show shadows': 'image-show-shadows',
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
						.find('.'+ classes.join(', .'))
							.removeClass(classes.join(' '))

					// toggle filter...
					if(state in filters){
						img.toggleClass(cls)
					}

					return img.hasClass(cls) ? state : 'No filters'
				},
				function(){ 
					return Object.keys(this.config['preview-filters']) })],
	}),

	handlers: [
		['focusImage',
			function(){ this.togglePreviewFilter('No filters') }],
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
