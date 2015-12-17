/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/


var AppControlActions = actions.Actions({
	config: {
		'application-window': null,

		'window-title': 'ImageGrid.Viewer (${VERSION}): ${FILENAME}',

		// XXX
		'ui-scale-modes': {
			desktop: 0,
			touch: 3,
		},
	},

	// XXX revise these...
	close: ['File|Interface/Close viewer',
		function(){ window.close() }],
	storeWindowGeometry: ['- Interface/Store window state',
		function(){
			// store window parameters (size, state)...
			var gui = requirejs('nw.gui')
			var win = gui.Window.get()

			// fullscreen...
			// ...avoid overwriting size...
			if(win.isFullscreen){
				this.config.window = this.config.window || {}
				this.config.window.fullscreen = true
				this.config.window.zoom = win.zoomLevel 

			} else {
				this.config.window = {
					size: {
						width: win.width,
						height: win.height,
					},
					fullscreen: false,
					zoom: win.zoomLevel ,
				}
			}
		}],
	restoreWindowGeometry: ['- Interface/Restore window state',
		function(){
			// or global.window.nwDispatcher.requireNwGui()
			// (see: https://github.com/rogerwang/node-webkit/issues/707)
			var gui = requirejs('nw.gui') 
			var win = gui.Window.get()

			// XXX move this into .restoreWindowGeometry(..)
			// get window state from config and load it...
			var cfg = this.config.window
			if(cfg != null){
				var W = screen.width
				var H = screen.height
				var w = 800
				var h = 600
				var s = cfg.scale

				if(cfg.size){
					w = win.width = Math.min(cfg.size.width, screen.width)
					h = win.height = Math.min(cfg.size.height, screen.height)
				}

				// place on center of the screen...
				var x = win.x = (W - w)/2
				var y = win.y = (H - h)/2

				if(s){
					win.zoomLevel = s
				}

				//console.log('GEOMETRY:', w, h, x, y)

				this.centerViewer()
			}


			win.show()

			if(cfg != null && cfg.fullscreen){
				this.toggleFullScreen()
			}

			/* XXX still buggy....
			// restore interface scale...
			this.toggleInterfaceScale(
				this.config['ui-scale-mode'] 
				|| this.toggleInterfaceScale('??')[0])
			*/
		}],
	toggleFullScreen: ['Interface/Toggle full screen mode',
		function(){
			var that = this
			this.ribbons.preventTransitions()

			// hide the viewer to hide any animation crimes...
			this.ribbons.viewer[0].style.visibility = 'hidden'

			// XXX where should toggleFullscreenMode(..) be defined...
			// 		...this also toggles a fullscreen css class on body...
			toggleFullscreenMode() 
			//requirejs('nw.gui').Window.get().toggleFullscreen()

			setTimeout(function(){ 
				that
					.centerViewer()
					.focusImage()
					.ribbons
						.restoreTransitions()

				that.ribbons.viewer[0].style.visibility = ''
			}, 0)
		}],
	// XXX need to account for scale in PartialRibbons
	// XXX should this be browser API???
	toggleInterfaceScale: ['Interface/Toggle interface modes',
		base.makeConfigToggler('ui-scale-mode', 
			function(){ return Object.keys(this.config['ui-scale-modes']) },
			function(state){ 
				var gui = requirejs('nw.gui')
				var win = gui.Window.get()


				this.ribbons.preventTransitions()

				var w = this.screenwidth
				win.zoomLevel = this.config['ui-scale-modes'][state] || 0
				this.screenwidth = w
				this.centerViewer()

				this.ribbons.restoreTransitions()
			})],
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(){
			if(window.showDevTools != null){
				showDevTools() 
			}
		}],
})


// XXX this needs a better .isApplicable(..)
// XXX store/load window state...
// 		- size
// 		- state (fullscreen/normal)
var AppControl = 
module.AppControl = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'app-control',
	depends: [
		'ui',
	],

	actions: AppControlActions,

	// XXX test if in:
	// 	- chrome app
	// 	- nw
	// 	- mobile
	isApplicable: function(){ return window.nodejs != null },

	// XXX show main window...
	handlers: [
		['start',
			function(){ 
				// XXX this messes up ribbon scale...
				// 		...to close/fast?
				//this.toggleInterfaceScale('!')
				
				this.restoreWindowGeometry()

			}],
		[[
			'close.pre',
			'toggleFullScreen',
		],
			function(){ this.storeWindowGeometry() }],
		['focusImage',
			function(){
				var gui = requirejs('nw.gui') 
				var win = gui.Window.get()

				if(this.images){
					var img = this.images[this.current]
					win.title = (this.config['window-title'] 
							|| 'ImageGrid.Viewer (${VERSION}): ${FILENAME}')
						// XXX get this from the viewer...
						.replace('${VERSION}', this.version || 'gen4')
						.replace('${FILENAME}', 
							(img.name 
								|| img.path.replace(/\.[\\\/]/, '')))
						.replace('${PATH}', 
							(img.base_path || '.') 
								+'/'+ img.path.replace(/\.[\\\/]/, ''))
						/*
						.replace('${DIR}', 
							pathlib.dirname((img.base_path || '.') 
								+'/'+ img.path.replace(/\.[\\\/]/, '')))
						*/
						// XXX add ...
						
				}
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
