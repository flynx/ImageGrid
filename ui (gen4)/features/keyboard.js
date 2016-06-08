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
var keyboard = require('lib/keyboard')

var core = require('features/core')
var widgets = require('features/ui-widgets')

var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')



/*********************************************************************/

// XXX might be a good idea to be able ignore actions rather than keys...
// XXX add this to the global doc...
var GLOBAL_KEYBOARD =
module.GLOBAL_KEYBOARD = {
	'Global':{
		doc: 'Global bindings that take priority over other sections.',
		pattern: '*',

		// XXX
	},

	'Slideshow': {
		pattern: '.slideshow-running',
		ignore: [
			'Esc',
			'Up', 'Down', 'Enter',
			'R', 'L', 'G',
		],

		Esc: 'toggleSlideshow: "off" -- Exit slideshow',
		Enter: 'slideshowDialog',

		Left: 'resetSlideshowTimer',
		Right: 'resetSlideshowTimer',
		Home: 'resetSlideshowTimer',
		End: 'resetSlideshowTimer',

		T: 'slideshowIntervalDialog',
		R: 'toggleSlideshowDirection',
		L: 'toggleSlideshowLooping',
	},

	// XXX do we need to prevent up/down navigation here, it may get confusing?
	// XXX do we need to disable fast sorting here???
	'Single Image': {
		pattern: '.single-image-mode',
		ignore: [
			'Esc',

			// do not crop in single image mode...
			'C', 'F2',

			// zooming...
			'#0', '#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
		],

		'#1': 'fitScreen',
		'#2': 'fitNormal',
		'#3': 'fitSmall',

		Esc: 'toggleSingleImage: "off" -- Exit single image view',

		// ignore sorting and reversing...
		// XXX not sure about these yet, especially reversing...
		R: {
			shift: 'IGNORE',
		},
		S: {
			shift: 'IGNORE',
		},
	},

	// XXX add "save as collection..."
	'Cropped': {
		pattern: '.crop-mode',

		Esc: {
			default: 'uncrop',
			ctrl: 'uncropAll',
		},
	},

	// XXX add "save as collection..." (???)
	// XXX cleanup...
	'Viewer': {
		doc: 'NOTE: binding priority is the same as the order of sections '+
			'on this page.',
		pattern: '*',

		X: {
			alt: 'close',
		},

		F4: {
			alt: 'close',
		},
		Q: {
			meta: 'close',
		},
		// XXX
		F5: keyboard.doc('Full reload viewer', 
			function(){ 
				//a.stop()
				/*
				killAllWorkers()
					.done(function(){
						reload() 
					})
				*/
				location.reload()
				return false
			}),
		F12: 'showDevTools',
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		R: {
			default: 'rotateCW',
			shift: 'reverseImages',
			ctrl: 'loadNewImages!',
			'ctrl+alt': 'reload!',
			'ctrl+shift': 'F5',
		},
		L: 'rotateCCW',
		H: {
			default: 'flipHorizontal',
			ctrl: 'listURLHistory',
			'ctrl+shift': 'listSaveHistory',
			alt: 'browseActions: "/History/" -- Open history menu',
		},
		V: 'flipVertical',
		P: {
			'ctrl+shift': 'F12',
		},

		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: 'toggleFullScreen', 
		F: {
			ctrl: 'F11',
			meta: 'F11',
		},

		// XXX testing...

		Enter: 'toggleSingleImage',

		Home: {
			default: 'firstImage',
			ctrl: 'firstGlobalImage',
			shift: 'firstRibbon',
		},
		End: {
			default: 'lastImage',
			ctrl: 'lastGlobalImage',
			shift: 'lastRibbon',
		},
		Left: {
			default: 'prevImage',
			alt: 'shiftImageLeft!',
			ctrl: 'prevScreen',
			// XXX need to prevent default on mac + browser...
			meta: 'prevScreen',
		},
		PgUp: 'prevScreen',
		PgDown: 'nextScreen',
		Right: {
			default: 'nextImage',
			alt: 'shiftImageRight!',
			ctrl: 'nextScreen',
			// XXX need to prevent default on mac + browser...
			meta: 'nextScreen',
		},
		Space: 'Right',
		Backspace: 'Left',
		'(': 'prevImageInOrder',
		')': 'nextImageInOrder',
		',': 'prevMarked',
		'.': 'nextMarked',
		'[': 'prevBookmarked',
		']': 'nextBookmarked',
		Up: {
			default: 'prevRibbon',
			shift: 'shiftImageUp',
			'alt+shift': 'travelImageUp',
			'ctrl+shift': 'shiftImageUpNewRibbon',
		},
		Down: {
			default: 'nextRibbon',
			shift: 'shiftImageDown',
			'alt+shift': 'travelImageDown',
			'ctrl+shift': 'shiftImageDownNewRibbon',
		},

		'#0': 'fitMax',
		'#1': {
			default: 'fitImage',
			shift: 'fitRibbon',
			ctrl: 'fitOrig!',
		},
		'#2': 'fitImage: 2 -- Fit 2 Images',
		'#3': {
			default: 'fitImage: 3 -- Fit 3 images',
			shift: 'fitRibbon: 3.5 -- Fit 3.5 ribbons',
		},
		'#4': 'fitImage: 4 -- Fit 4 images',
		'#5': {
			default: 'fitImage: 5 -- Fit 5 images',
			shift: 'fitRibbon: 5.5 -- Fit 5.5 ribbons',
		},
		'#6': 'fitImage: 6 -- Fit 6 images',
		'#7': 'fitImage: 7 -- Fit 7 images',
		'#8':'fitImage: 8 -- Fit 8 images',
		'#9': 'fitImage: 9 -- Fit 9 images',
		
		'+': 'zoomIn',
		'=': '+',
		'-': 'zoomOut',

		F2: {
			default: 'cropRibbon',
			shift: 'cropRibbonAndAbove',
			ctrl: 'cropMarked',
			alt: 'cropBookmarked',
		},

		// marking...
		M: {
			default: 'toggleMark',
			alt: 'browseActions: "/Mark/" -- Show mark menu',
		},
		A: {
			alt: 'browseActions',
			'alt+shift': 'listActions',

			ctrl: 'toggleMark!: "ribbon" "on" -- Mark all images in ribbon',
		},
		D: {
			ctrl: 'toggleMark!: "ribbon" "off" -- Unmark all images in ribbon',
		},
		I: {
			default: 'showMetadata',
			shift: 'toggleStatusBar',

			ctrl: 'toggleMark!: "ribbon" -- Invert marks in ribbon',
			'ctrl+shift': 'showMetadata: "current" "full" -- Show full metadata',

			'meta+alt': 'showDevTools',
		},
		
		B: {
			default: 'toggleBookmark',
			ctrl: 'toggleTheme!',
			alt: 'browseActions: "/Bookmark/" -- Show bookmark menu',
		},
		E: {
			default: 'openInExtenalEditor',
			shift: 'openInExtenalEditor: 1 -- Open in alternative editor',
			alt: 'listExtenalEditors',
		},
		C: {
			default: 'browseActions: "/Crop/" -- Show crop menu',
			// do the default copy thing...
			// NOTE: this stops the default: handler from getting the ctrl:
			// 		key case...
			ctrl: '',
		},
		O: 'browsePath',
		S: {
			default: 'slideshowDialog',
			//shift: 'sortImages: "Date" -- Sort images by date',
			shift: 'sortImages -- Sort images',
			//alt: 'browseActions: "/Sort/"',
			alt: 'sortDialog',
			// XXX need to make this save to base_path if it exists and
			// 		ask the user if it does not... now it always asks.
			ctrl: 'saveIndexHere',
			'ctrl+shift': 'exportDialog',
		},

		// XXX still experimental...
		U: {
			default: 'undoLast',
			shift: 'redoLast',
		},
		Z: {
			ctrl: 'undoLast',
			'ctrl+shift': 'redoLast',
		},

		G: {
			default: 'editStatusBarIndex!',
			shift: 'toggleStatusBarIndexMode!',

			// XXX for debug...
			ctrl: function(){ $('.viewer').toggleClass('visible-gid') },
		},

		'?': 'showKeyboardBindings',
	},
}	



/*********************************************************************/
// XXX add a key binding list UI...
// XXX add loading/storing of kb bindings...

// XXX add introspection and doc actions...
var KeyboardActions = actions.Actions({
	config: {
		// limit key repeat to one per N milliseconds.
		//
		// Set this to -1 or null to run keys without any limitations.
		'max-key-repeat-rate': 0,
	},

	get keyboard(){
		return this.__keyboard_config
	},

	toggleKeyboardHandling: ['- Interface/Toggle keyboard handling',
		toggler.Toggler(null, function(_, state){ 
			if(state == null){
				return this.__keyboard_handler ? 'on' : 'off'
			}

			// XXX this does not work yet...
			//var target = this.ribbons.viewer
			var target = $(document)

			// start/reset keyboard handling...
			if(state == 'on'){
				var that = this

				// need to reset...
				if(this.__keyboard_handler != null){
					target.off('keydown', this.__keyboard_handler)
				}

				// setup base keyboard for devel, in case something breaks...
				// This branch does not drop keys...
				if(this.config['max-key-repeat-rate'] < 0 
						|| this.config['max-key-repeat-rate'] == null){
					//this.ribbons.viewer
					var handler = 
					this.__keyboard_handler =
						keyboard.makeKeyboardHandler(
							function(){ return that.__keyboard_config },
							function(k){ window.DEBUG && console.log(k) }, 
							this)

				// drop keys if repeating too fast...
				// NOTE: this is done for smoother animations...
				} else {
					var handler = 
					this.__keyboard_handler =
						keyboard.dropRepeatingkeys(
							keyboard.makeKeyboardHandler(
								function(){ return that.__keyboard_config },
								function(k){ window.DEBUG && console.log(k) },
								this), 
							function(){ 
								return that.config['max-key-repeat-rate']
							})
				}

				target.keydown(handler)

			// stop keyboard handling...
			} else {
				target.off('keydown', this.__keyboard_handler)
				delete this.__keyboard_handler
			}
		},
		['on', 'off'])],

	// XXX need to pre-process the docs...
	// 		- remove the path component...
	// 		- insert the action name where not doc present...
	// XXX cleanup CSS
	showKeyboardBindings: ['Interface/Show keyboard bindings...',
		widgets.makeUIDialog('Drawer', 
			function(){
				return keyboard.buildKeybindingsHelpHTML(this.__keyboard_config, this)
			},
			{
				background: 'white',
				focusable: true,
			})],
})

var Keyboard = 
module.Keyboard = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'keyboard',
	depends: [
		'ui'
	],

	actions: KeyboardActions, 

	handlers: [
		['start',
			function(){
				var that = this
				this.__keyboard_config = this.keyboard || GLOBAL_KEYBOARD

				this.toggleKeyboardHandling('on')
			}]
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
