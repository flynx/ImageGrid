/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(process) != 'undefined'){
	var pathlib = requirejs('path')
}

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')
var base = require('features/base')

var widgets = require('features/ui-widgets')



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
			var that = this
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
				var x = win.x = Math.round((W - w)/2)
				var y = win.y = Math.round((H - h)/2)

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
				if(cfg != null && cfg.fullscreen){
					that.toggleFullScreen('on')
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

	// XXX add ability to use devtools on background page (node context)...
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(){
			nw.Window.get().showDevTools &&
				nw.Window.get().showDevTools()
		}],

	// XXX should this be here???
	showInFolder: ['File|Image/Show in folder',
		function(image){
			image = this.images[this.data.getImage(image)]

			var base = image.base_path || this.location.path
			var filename = image.path

			path = pathlib.normalize(base + '/' + filename)

			nw.Shell.showItemInFolder(path)
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
var AppControllsActions = actions.Actions({
	config: {
		'app-buttons': {
			'_': ['minimize', 
				'minimize -- Minimize'],
			'&#8601;': ['fullscreen allways-shown', 
				'toggleFullScreen -- Toggle fullscreen'],
			'&times;': ['close', 
				'close -- Quit'],
		},
	},

	toggleAppButtons: ['Interface/Toggle App control buttons',
		widgets.makeButtonControlsToggler('app-buttons')],
})

var AppControlls = 
module.AppControlls = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-app-buttons',
	depends: [
		'ui-app-control',
	],
	suggested: [
		// needed for reporting info in .makeButtonControls(..)
		'ui-status-bar',
	],

	actions: AppControllsActions,

	handlers: [
		['toggleFullScreen', 
			function(){
				this.toggleAppButtons('on')

				var fullscreen = this.toggleFullScreen('?')
				var buttons = this.ribbons.viewer.find('.app-buttons')
				
				// fullscreen button...
				buttons.find('.fullscreen.button')
					.html(fullscreen == 'on' ? '&#8601;' : '&#8599;')
					.attr('info', fullscreen == 'on' ? 'Exit fullscreen' : 'Fullscreen')

				// XXX should this be done by css???
				if(fullscreen == 'on'){
					buttons.find('.button:not(.allways-shown)').show()

				} else {
					buttons.find('.button:not(.allways-shown)').hide()
				}

				//this.toggleFullScreenControls(fullScreen)
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
