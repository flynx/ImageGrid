/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/

var AppControlActions = actions.Actions({
	config: {
		'window-title': 'ImageGrid.Viewer (${VERSION}): ${FILENAME}',

		'window-delay-initial-display': 200,
	},

	// XXX revise these...
	close: ['File|Interface/Close viewer',
		function(){ window.close() }],
	storeWindowGeometry: ['- Interface/Store window state',
		function(){
			// store window parameters (size, state)...
			var win = nw.Window.get()

			// fullscreen...
			// ...avoid overwriting size...
			if(this.toggleFullScreen('?') == 'on'){
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
			var win = nw.Window.get()

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

			/* XXX still buggy....
			// restore interface scale...
			this.toggleInterfaceScale(
				this.config['ui-scale-mode'] 
				|| this.toggleInterfaceScale('??')[0])
			*/

			// NOTE: we delay this to enable the browser time to render
			// 		things before we show them to the user...
			setTimeout(function(){
				win.show()

				// XXX check if we are full screen...
				if(cfg != null && cfg.fullscreen && !win.isFullscreen){
					this.toggleFullScreen('on')
				}
			}, this.config['window-delay-initial-display'] || 0)
		}],
	
	minimize: ['Interface/Minimize',
		function(){
			nw.Window.get().minimize()
		}],
	toggleFullScreen: ['Interface/Toggle full screen mode',
		toggler.CSSClassToggler(
			function(){ return document.body }, 
			'.full-screen-mode',
			function(action){
				var that = this
				var w = nw.Window.get()

				// change the state only if the target state is not the same
				// as the current state...
				if((w.isFullscreen ? 'on' : 'off') != action){
					this.ribbons.preventTransitions()

					// hide the viewer to hide any animation crimes...
					this.ribbons.viewer[0].style.visibility = 'hidden'

					// XXX async...
					// 		...this complicates things as we need to do the next
					// 		bit AFTER the resize is done...
					w.toggleFullscreen()

					setTimeout(function(){ 
						that
							.centerViewer()
							.focusImage()
							.ribbons
								.restoreTransitions()

						that.ribbons.viewer[0].style.visibility = ''
					}, 100)
				}

				// NOTE: we delay this to account for window animation...
				setTimeout(function(){ 
					that.storeWindowGeometry() 
				}, 500)
			})],
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(){
			nw.Window.get().showDevTools &&
				nw.Window.get().showDevTools()
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

	tag: 'ui-app-control',
	depends: [
		'ui',
	],

	actions: AppControlActions,

	// XXX test if in:
	// 	- chrome app
	// 	- nw
	// 	- mobile
	isApplicable: function(){ return this.runtime == 'nw' },

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
				var win = nw.Window.get()

				if(this.images){
					var img = this.images[this.current]
					win.title = (this.config['window-title'] 
							|| 'ImageGrid.Viewer (${VERSION}): ${FILENAME}')
						// XXX get this from the viewer...
						.replace('${VERSION}', this.version || 'gen4')
						.replace('${FILENAME}', 
							img ? 
									(img.name || img.path.replace(/\.[\\\/]/, ''))
								: '')
						.replace('${PATH}', 
							img ?
									(img.base_path || '.') 
										+'/'+ img.path.replace(/\.[\\\/]/, '')
								: '')
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



//---------------------------------------------------------------------
// Fullscreen app control buttons...
var FullScreenControllsActions = actions.Actions({
	toggleFullScreenControls: ['Interface/',
		toggler.Toggler(null,
			function(){ 
				return this.ribbons.viewer.find('.fullscreen-controls').length > 0 ? 'on' : 'off' },
			['off', 'on'],
			function(state){
				// clear the controls....
				this.ribbons.viewer.find('.fullscreen-controls').remove()

				if(state == 'on'){
					var that = this

					$('<div>')
						.addClass('fullscreen-controls')
						// minimize....
						.append($('<div>')
							.addClass('button')
							.html('_')
							.click(function(){ that.minimize() }))
						// fullscreen....
						.append($('<div>')
							.addClass('button')
							.html('&square;')
							.click(function(){ that.toggleFullScreen() }))
						// close...
						.append($('<div>')
							.addClass('button close')
							.html('&times;')
							.click(function(){ that.close() }))
						.appendTo(this.ribbons.viewer)
				}
			})],
})

var FullScreenControlls = 
module.FullScreenControlls = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fullscreen-controls',
	depends: [
		'ui-app-control',
	],

	actions: FullScreenControllsActions,

	handlers: [
		['toggleFullScreen', 
			function(){
				this.toggleFullScreenControls(this.toggleFullScreen('?'))
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
