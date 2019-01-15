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
	var url = requirejs('url')
}

var electron
try{
	electron = requirejs('electron')
} catch(e){ }

var VERSION = require('version').version

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')
var base = require('features/base')
var widgets = require('features/ui-widgets')



/*********************************************************************/

var Widget = 
module.Widget = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'widget',
	depends: [
		'-ui-app-control',
	],
})


//---------------------------------------------------------------------

var NWHostActions = actions.Actions({
	// window stuff...
	// XXX should this be nested in a .window object???
	get title(){
		return nw.Window.get().title },
	set title(value){
		nw.Window.get().title = value },
	get size(){
		var win = nw.Window.get()
		return [
			win.width,
			win.height,
		]
	},
	set size(value){
		var win = nw.Window.get()
		win.width = value[0]
		win.height = value[1]
	},
	get position(){
		var win = nw.Window.get()
		return [
			win.x,
			win.y,
		]
	},
	set position(value){
		var win = nw.Window.get()
		win.x = value[0]
		win.y = value[1]
	},

	show: ['- Window/',
		function(){
			nw.Window.get().show() }],
	minimize: ['Window/Minimize',
		function(){
			nw.Window.get().minimize() }],
	toggleFullScreen: ['Window/Full screen mode',
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
					this.dom[0].style.visibility = 'hidden'

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

						that.dom[0].style.visibility = ''
					}, 100)
				}

				// NOTE: we delay this to account for window animation...
				setTimeout(function(){ 
					that.storeWindowGeometry() 
				}, 500)
			})],

	// XXX add ability to use devtools on background page (node context)...
	// XXX get the devtools stage...
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(action){
			if(action == '?'){
				// XXX get the devtools stage...
				return false
			}
			nw.Window.get().showDevTools &&
				nw.Window.get().showDevTools()
		}],
	showInFolder: ['File|Image/Show in $folder',
		function(image){
			image = this.images[this.data.getImage(image)]

			var base = image.base_path || this.location.path
			var filename = image.path
			var path = pathlib.normalize(base + '/' + filename)

			nw.Shell.showItemInFolder(path)
		}],

	toggleSplashScreen: ['Interface/',
		function(){
		}],
})

var NWHost = 
module.NWHost = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-nw-host',
	exclusive: 'ui-host',
	depends: [],

	actions: NWHostActions,

	isApplicable: function(){ return this.runtime.nw },
})



//---------------------------------------------------------------------

var ElectronHostActions = actions.Actions({
	// window stuff...
	// XXX should this be nested in a .window object???
	// XXX should these be props or methods???
	get title(){
		return electron.remote.getCurrentWindow().getTitle() },
	set title(value){
		electron.remote.getCurrentWindow().setTitle(value) },
	get size(){
		return electron.remote.getCurrentWindow().getSize() },
	set size(value){
		value 
			&& electron.remote.getCurrentWindow()
				.setSize(value[0], value[1]) },
	get position(){
		return electron.remote.getCurrentWindow().getPosition() },
	set position(value){
		value 
			&& electron.remote.getCurrentWindow()
				.setPosition(value[0], value[1]) },

	show: ['- Window/',
		function(){
			if(electron.remote.getGlobal('readyToShow')){
				electron.remote.getCurrentWindow().show()

			} else {
				var win = electron.remote.getCurrentWindow()
				win.once('ready-to-show', function(){
					win.show()
				})
			}
		}],
	minimize: ['Window/Minimize',
		function(){
			electron.remote.getCurrentWindow().minimize() }],
	toggleFullScreen: ['Window/Full screen mode',
		toggler.CSSClassToggler(
			function(){ return document.body }, 
			'.full-screen-mode',
			function(action){
				var that = this
				var win = electron.remote.getCurrentWindow()

				var state = win.isFullScreen() ? 'on' : 'off'

				// change the state only if the target state is not the same
				// as the current state...
				if(state != action){
					this.ribbons.preventTransitions()

					// hide the viewer to hide any animation crimes...
					this.dom[0].style.visibility = 'hidden'

					// XXX async...
					// 		...this complicates things as we need to do the next
					// 		bit AFTER the resize is done...
					win.setFullScreen(action == 'on' ? true : false)

					setTimeout(function(){ 
						that
							.centerViewer()
							.focusImage()
							.ribbons
								.restoreTransitions()

						that.dom[0].style.visibility = ''
					}, 100)
				}

				// NOTE: we delay this to account for window animation...
				setTimeout(function(){ 
					that.storeWindowGeometry() 
				}, 500)
			})],

	// XXX should this be a toggler???
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(action){
			var w = electron.remote.getCurrentWindow()

			if(action == '?'){
				return w.isDevToolsOpened()
			}
				
			w.openDevTools() 
			// focus the devtools if its window is available...
			w.devToolsWebContents
				&& w.devToolsWebContents.focus()
		}],
	// XXX make this portable (osx, linux)...
	showInFolder: ['File|Image/Show in $folder',
		function(image){
			image = this.images[this.data.getImage(image)]

			var base = image.base_path || this.location.path
			var filename = image.path
			var path = pathlib.normalize(base + '/' + filename)

			requirejs('child_process')
				// XXX this is windows-specific...
				.exec(`explorer.exe /select,"${ pathlib.normalize(path) }"`)
				// XXX osx...
				//.exec('open -R '+JSON.stringify(path))
		}],

	// XXX make this a real toggler...
	toggleSplashScreen: ['Interface/',
		function(action){
			var splash = this.splash = (!this.splash || this.splash.isDestroyed()) ?
				electron.remote.getGlobal('splash')
				: this.splash

			if(action == '?'){
				return !splash || splash.isDestroyed() ? 'off' : 'on'
			}

			// XXX HACK: use real toggler protocol...
			if(action != 'off' && (!splash || splash.isDestroyed())){
				var splash = this.splash = 
					// XXX move this to splash.js and use both here and in e.js...
					new electron.remote.BrowserWindow({
						// let the window to get ready before we show it to the user...
						show: false,

						transparent: true,
						frame: false,
						center: true,
						width: 800, 
						height: 500,

						alwaysOnTop: true,

						resizable: false,
						movable: false,
						minimizable: false,
						maximizable: false,
						fullscreenable: false,

						autoHideMenuBar: true,
					})

				splash.setMenu(null)

				// and load the index.html of the app.
				splash.loadURL(url.format({
					// XXX unify this with index.html
					pathname: pathlib.join(__dirname, 'splash.html'),
					protocol: 'file:',
					slashes: true
				}))
				
				splash.once('ready-to-show', function(){
					splash.webContents
						.executeJavaScript(
							`document.getElementById("version").innerText = "${VERSION}"`)
					splash.show()
				})

			} else if(action != 'on' && splash){
				splash.destroy()
			}
		}],
})

var ElectronHost = 
module.ElectronHost = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-electron-host',
	exclusive: 'ui-host',
	depends: [],

	actions: ElectronHostActions,

	isApplicable: function(){ return this.runtime.electron },
})



//---------------------------------------------------------------------
// XXX this needs to trigger only when fullwindow browser mode and not 
// 		get loaded when in widget mode...

var BrowserHostActions = actions.Actions({
	// window stuff...
	get title(){
		return $('title').text() },
	set title(value){
		$('title').text(value) },
})

// NOTE: keep this defined last as a fallback...
var BrowserHost = 
module.BrowserHost = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-browser-host',
	exclusive: 'ui-host',
	depends: [],

	actions: BrowserHostActions,

	isApplicable: function(){ return !this.runtime.widget },
})


//---------------------------------------------------------------------

var PortableAppControl = 
module.PortableAppControl = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-portable-app-control',
	depends: [
		'ui',
		'ui-host',
	],

	isApplicable: function(){ return this.runtime.browser },

	config: {
		//'window-title': 'ImageGrid.Viewer (${VERSION}): ${FILENAME}',
		'window-title': '${FILENAME} - ImageGrid.Viewer (${VERSION})',
	},

	handlers: [
		// update window title...
		// XXX make this generic...
		['focusImage clear',
			function(){
				if(this.images){
					var img = this.images[this.current]
					this.title = (this.config['window-title'] 
							|| 'ImageGrid.Viewer (${VERSION}): ${FILENAME}')
						// XXX get this from the viewer...
						.replace('${VERSION}', this.version || 'gen4')
						.replace('${FILENAME}', 
							img ? 
									(img.name 
										|| (img.path && img.path.replace(/\.[\\\/]/, ''))
										|| this.current
										|| '')
								: (this.current || ''))
						.replace('${PATH}', 
							(img && img.path) ?
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

// XXX would be nice to store/restore dev-tools state...
var WindowedAppControlActions = actions.Actions({
	config: {
		'window-delay-initial-display': 500,
		'splash-screen-delay-hide': 500,

		'show-splash-screen': 'on',
	},

	// XXX revise these...
	close: ['File|Window/Close viewer',
		function(){ 
			this.stop()
			window.close() 
		}],

	storeWindowGeometry: ['- Window/Store window state',
		function(){
			// store window parameters (size, state)...
			//var win = nw.Window.get()
			var size = this.size
			var position = this.position

			// fullscreen...
			// ...avoid overwriting size...
			if(this.toggleFullScreen('?') == 'on'){
				var cfg = this.config.window = this.config.window || {}
				cfg.fullscreen = true
				cfg.devtools = this.showDevTools('?')

			} else {
				this.config.window = {
					width: size[0],
					height: size[1],

					x: position[0],
					y: position[1],

					fullscreen: false,
					devtools: this.showDevTools('?'),
				}
			}
		}],
	restoreWindowGeometry: ['- Window/Restore window state',
		function(){
			var that = this
			var cfg = this.config.window || {}

			var fullscreen = cfg.fullscreen || false

			if(fullscreen){
				that.toggleFullScreen('on')

			} else {
				var w = cfg.width || 800
				var h = cfg.height || 600 
				var x = cfg.x || Math.round((screen.width - w)/2)
				var y = cfg.y || Math.round((screen.height - h)/2)

				this.position = [x, y]
				this.size = [w, h]
			}
		}],

	toggleSplashScreenShowing: ['Interface/Splash screen on start',
		core.makeConfigToggler('show-splash-screen', 
			['on', 'off'],
			function(action){
				if(action == 'on'){
					delete localStorage.disableSplashScreen

				} else if(action == 'off'){
					localStorage.disableSplashScreen = true
				}
			})],
})

// XXX store/load window state...
// 		- size
// 		- state (fullscreen/normal)
var WindowedAppControl = 
module.WindowedAppControl = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-windowed-app-control',
	depends: [
		'ui',
		'ui-host',
	],

	actions: WindowedAppControlActions,

	// XXX BUG: when running in electron:
	// 			- loading this breaks the other buttons (menu, collections, ...)
	// 			- .toggleFullScreen(..) works in an odd manner -- ok when 
	// 				explicitly called or button pushed but in opposite manner 
	// 				when F11 (FIXED?)
	// 			- ready protocol breaks -- need to call .ready() to unstall 
	// 				the viewer
	// 		...does this all have anything to do with double init???
	isApplicable: function(){ return this.runtime.desktop },
	//isApplicable: function(){ return this.runtime.desktop && !this.runtime.electron },

	// XXX show main window...
	handlers: [
		['start.pre',
			function(){ 
				// we are going to declare ready ourselves...
				this.requestReadyAnnounce() }],
		['start',
			function(){ 
				var that = this
				var cfg = this.config.window

				// set the initial non-fullscreen window geometry...
				// NOTE: this will avoid overwriting the initial geometry
				// 		with the values set in e.js if .fullscreen is set...
				// NOTE: this will also set the size to which the OS will 
				// 		resize the window in state change...
				if(cfg){
					var W = screen.width
					var H = screen.height
					var w = cfg.width || Math.round(Math.max(0.8 * W, 600))
					var h = cfg.height || Math.round(Math.max(0.8 * H, 400))
					var x = cfg.x || Math.round((W - w)/2)
					var y = cfg.y || Math.round((H - h)/2)

					this.position = [x, y]
					this.size = [w, h]

					cfg.devtools
						&& this.showDevTools()
				}

				// restore actual window state... 
				this.restoreWindowGeometry() 

				// declare we are ready when DOM is ready...
				$(function(){ 
					that.declareReady() })
			}],

		// show window + hide splash screen...
		['ready',
			function(){ 
				var that = this
				// NOTE: we delay this to enable the browser time to render
				// 		things before we show them to the user...
				setTimeout(function(){
					// show window...
					that.show()

					// hide splash screen...
					setTimeout(function(){
						that.toggleSplashScreen('off')
					}, (that.config['splash-screen-delay-hide'] || 0)) 
				}, this.config['window-delay-initial-display'] || 0) }],

		[[
			'stop.pre',
			'toggleFullScreen.pre',
			'toggleFullScreen',
		],
			function(){ this.storeWindowGeometry() }],
	],
})


//---------------------------------------------------------------------

var AppControl = 
module.AppControl = core.ImageGridFeatures.Feature('ui-app-control', [
	'ui-windowed-app-control',
	'ui-portable-app-control',
])


//---------------------------------------------------------------------
// Fullscreen app control buttons...

var AppButtonsActions = actions.Actions({
	config: {
		// append app-specific buttons...
		'app-buttons': Object.assign({},
			widgets.Buttons.actions.config['app-buttons'],
			{
				'_': ['minimize', 
					'minimize -- Minimize'],
				'&#8601;': ['fullscreen always-shown', 
					'toggleFullScreen -- Toggle fullscreen'],
				'&times;': ['close', 
					'close -- Quit'],
			}),
	},
})

var AppButtons = 
module.AppButtons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-app-buttons',
	depends: [
		'ui-windowed-app-control',
		'ui-buttons',
	],
	suggested: [
		// needed for reporting info in .makeButtonControls(..)
		'ui-status-bar',
	],

	actions: AppButtonsActions,

	handlers: [
		['start.pre', 
			function(){
				this.toggleAppButtons('on')
			}],
		['start toggleFullScreen', 
			function(){
				var fullscreen = this.toggleFullScreen('?')
				var buttons = this.dom.find('.app-buttons')
				
				// fullscreen button...
				buttons.find('.fullscreen.button')
					.html(fullscreen == 'on' ? '&#8601;' : '&#8599;')
					.attr('info', fullscreen == 'on' ? 'Exit fullscreen' : 'Fullscreen')

				// XXX should this be done by css???
				if(fullscreen == 'on'){
					buttons.find('.button:not(.always-shown)').show()

				} else {
					buttons.find('.button:not(.always-shown)').hide()
				}

				//this.toggleFullScreenControls(fullScreen)
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
