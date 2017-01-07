/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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

// helper...
function customScale(n){
	return {
		default: 'fitCustom: '+n+' -- Set cutom image size',
		'alt': 'setCustomSize: '+n+' -- Set current image size as custom',
		'ctrl+shift': 'setCustomSize: '+n+' null -- Clear custom image size',
	}
}


// XXX might be a good idea to be able ignore actions rather than keys...
// XXX add this to the global doc...
var GLOBAL_KEYBOARD =
module.GLOBAL_KEYBOARD = {
	'Global':{
		doc: 'Global bindings that take priority over other sections.',
		pattern: '*',

	},

	'Slideshow': {
		pattern: '.slideshow-running',
		ignore: [
			'Esc',
			'Up', 'Down', 'Enter',
			'R', 'L', 'G', 'T',
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


		// NOTE: these are here so as to enable handling via the next 
		// 		block, i.e. the Viewer
		// 		...if not given, then the ignore above will shadow the 
		// 		keys...
		// NOTE: the 'nop' action does not exist, this it will get ignored
		'(': 'nop',
		')': 'nop',

		// zooming...
		'#1': 'fitScreen',
		// XXX should these also be implemented in the same way as 4-9???
		'#2': {
			default: 'fitNormal',
			'alt': 'setNormalScale -- Set current image size as normal',
			'ctrl+shift': 'setNormalScale: null -- Reset normal image size to default',
		},
		'#3': {
			default: 'fitSmall',
			'alt': 'setSmallScale -- Set current image size as small',
			'ctrl+shift': 'setSmallScale: null -- Reset small image size to default',
		},
		'#4': customScale(4),
		'#5': customScale(5),
		'#6': customScale(6),
		'#7': customScale(7),
		'#8': customScale(8),
		'#9': customScale(9),
		'#0': customScale(0),


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

	'Range': {
		doc: 'Range editing',
		pattern: '.brace',

		// XXX add:
		// 		- range navigation
		// 		- range manipulation

		Esc: 'clearRange',
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
			alt: 'browseActions: "/Ribbon/" -- Open ribbon menu',
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

		// tilt...
		// XXX experimental, not sure if wee need this with a keyboard...
		T: {
			default: 'rotateRibbonCCW -- Tilt ribbons counter clock wise',
			shift: 'rotateRibbonCW -- Tilt ribbons clock wise',

			alt: 'resetRibbonRotation -- Reset ribbon tilt',
		},

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
		'[': {
			default: 'prevBookmarked',
			// XXX experimental
			shift: 'openRange',
		},
		']': {
			default: 'nextBookmarked',
			// XXX experimental
			shift: 'closeRange',
		},
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
		
		'+': {
			default: 'zoomIn',
			ctrl: 'lighterTheme!',
		},
		'=': '+',
		'-': {
			default: 'zoomOut',
			ctrl: 'darkerTheme!',
		},

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
			alt: 'browseActions: "/Image/" -- Show image menu',
			shift: 'toggleStatusBar',

			ctrl: 'toggleMark!: "ribbon" -- Invert marks in ribbon',
			'ctrl+shift': 'showMetadata: "current" "full" -- Show full metadata',

			'meta+alt': 'showDevTools',
		},
		// XXX experimental...
		'*': 'setRangeBorder',
		
		B: {
			default: 'toggleBookmark',
			ctrl: 'toggleTheme!',
			'ctrl+shift': 'toggleTheme!: "prev"',

			alt: 'browseActions: "/Bookmark/" -- Show bookmark menu',

			// XXX not sure if this is the right way to go...
			shift: 'setBaseRibbon',
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
			default: 'undo',
			shift: 'redo',
		},
		Z: {
			ctrl: 'undo',
			'ctrl+shift': 'redo',
		},

		G: {
			default: 'editStatusBarIndex!',
			shift: 'toggleStatusBarIndexMode!',

			// XXX for debug...
			//ctrl: function(){ $('.viewer').toggleClass('visible-gid') },
		},

		'?': 'showKeyboardBindings',
	},
}	



/*********************************************************************/

var KeyboardHandlerProto = {
	// object/function
	keyboard: null,
	context: null,

	// helpers...
	shifted: function(key){
	},

	// get keys for handler...
	//
	keys: function(handler){
	},

	// get/set handler for key...
	//
	handler: function(mode, key, action){
		var that = this

		// XXX normalize key...
		var full_key = key
		var modifiers = key.split('+')
		key = modifiers.pop()

		var code = keyboard.toKeyCode(key)
		var args = [].slice.call(arguments).slice(3)

		// set handler...
		if(action){
			modes = modes instanceof Array ? modes : [modes]
			// ignore all but the first mode...
			modes = modes.slice(0, 1)

		// get handler...
		} else {
			var shift_key = (modifiers.indexOf('shift') >= 0 ? 
					keyboard._SHIFT_KEYS[key]
					: keyboard._UNSHIFT_KEYS[key])
				|| '' 
			var shift_modifiers = shift_key != '' 
				&& (((modifiers.indexOf('shift') >= 0 ?
					modifiers.filter(function(k){ return k != 'shift' })
					: modifiers.concat(['shift'])))
				|| modifiers).join('+')
			var full_shift_key = shift_modifiers == '' ? 
				shift_key 
				: shift_modifiers +'+'+ shift_key

			var any = modes == 'any'
			modes = any ? this.getKeyboardModes()
				: modes == '*' ? Object.keys(this.keyboard) 
				: modes
			modes = modes instanceof Array ? modes : [modes]

			// filter modes...
			var ignore = false
			modes = any ? 
				modes
					.filter(function(mode){
						if(ignore){
							return false
						}

						var i = that.keyboard[mode].ignore || []

						ignore = i.indexOf(full_key) >= 0
							|| i.indexOf(key) >= 0
							|| i.indexOf(shift_key) >= 0
							|| i.indexOf(full_shift_key) >= 0
							|| i.indexOf(code) >= 0

						return true
					})
				: modes
		}

		modifiers = modifiers.join('+')


		// search modes...
		var res = {}
		ignore = false
		modes
			.forEach(function(mode){
				if(ignore){
					return false
				}

				var bindings = that.keyboard[mode]

				if(action){
					var match = 'direct'
					var alias = code in bindings ? code : key

				} else {
					// direct match...
					var match = 'direct'
					var alias = full_key in bindings ? full_key 
						: key in bindings ? key 
						: null
					// shift key match...
					match = alias == null ? 'shifted' : match
					alias = alias == null ? 
						(full_shift_key in bindings ? full_shift_key 
							: shift_key in bindings ? shift_key 
							: null)
						: alias
					// code match...
					match = alias == null ? 'code' : match
					alias = alias == null ? 
						(code in bindings ? code : null)
						: alias
				}

				var mod = (match == 'code' || match == 'direct') ? 
					modifiers 
					: shift_modifiers
				mod = mod == '' ? 'default' : mod

				var handler = alias

				// spin through aliases...
				// XXX do we look for aliases in this mode only or in all modes?
				var seen = []
				while(handler in bindings){
					// handler loop...
					if(seen.indexOf(handler) >= 0){
						return null
					}
					
					alias = handler
					handler = bindings[alias]
					seen.push(alias)

					// go into the map structure...
					if(!action && typeof(handler) != typeof('str')){
						handler = handler[mod]
					}
				}

				// set the action...
				if(action){
					if(handler == null || typeof(handler) == typeof('str')){
						bindings[alias] = modifiers.length == 0 ?
							action
							: { modifiers : action }

					} else if(modifiers.length == 0){
						handler['default'] = action

					} else {
						handler[modifiers] = action
					}

				// get the action...
				} else {
					if(handler){
						res[mode] = handler
					}

					ignore = any && handler == 'IGNORE'
				}
			})

		return !action ? 
			(modes.length == 1 ? res[modes[0]] : res) || null
			: undefined
	},

	// get applicable modes...
	//
	modes: function(context){
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

		'keyboard-repeat-pause-check': 100,

		// Sets the target element to which the keyboard event handler 
		// is bound...
		//
		// Supported values:
		// 	'window'			- window element
		// 	'document'			- document element
		// 	'viewer'			- the viewer (default)
		// 	null				- default element
		// 	<css selector>		- any css selector
		//
		// NOTE: this value is not live, to update the target restart 
		// 		the handler by cycling the toggler off and on...
		// NOTE: the target element must be focusable...
		'keyboard-event-source': 'window',
	},

	get keyboard(){
		return this.__keyboard_config },

	pauseKeyboardRepeat: ['- Interface/',
		function(){ 
			this.__keyboard_repeat_paused = true }],

	toggleKeyboardHandling: ['- Interface/Keyboard handling',
		toggler.Toggler(null, function(_, state){ 
			if(state == null){
				return this.__keyboard_handler ? 'on' : 'off'
			}

			// repeat stop checker...
			var check = (function(){
				if(this.config['keyboard-repeat-pause-check'] > 0
						&& this.__keyboard_repeat_paused){
					var that = this
					this.__keyboard_repeat_pause_timeout 
						&& clearTimeout(this.__keyboard_repeat_pause_timeout)

					this.__keyboard_repeat_pause_timeout = setTimeout(function(){
						delete that.__keyboard_repeat_paused
						delete that.__keyboard_repeat_pause_timeout 
					}, this.config['keyboard-repeat-pause-check'] || 100)

					return false
				}
				return true
			}).bind(this)

			// start/reset keyboard handling...
			if(state == 'on'){
				var that = this

				// NOTE: the target element must be focusable...
				var target =
				this.__keyboard_event_source =
					this.config['keyboard-event-source'] == null 
						|| this.config['keyboard-event-source'] == 'viewer' ? this.ribbons.viewer
					: this.config['keyboard-event-source'] == 'window' ? $(window)
					: this.config['keyboard-event-source'] == 'document' ? $(document)
					: $(this.config['keyboard-event-source'])

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
						keyboard.stoppableKeyboardRepeat(
							keyboard.makeKeyboardHandler(
								function(){ return that.__keyboard_config },
								function(k){ window.DEBUG && console.log('KEY:', k) }, 
								this),
							check)

				// drop keys if repeating too fast...
				// NOTE: this is done for smoother animations...
				} else {
					var handler = 
					this.__keyboard_handler =
						keyboard.stoppableKeyboardRepeat(
							keyboard.dropRepeatingkeys(
								keyboard.makeKeyboardHandler(
									function(){ return that.__keyboard_config },
									function(k){ window.DEBUG && console.log(k) },
									this), 
								function(){ 
									return that.config['max-key-repeat-rate']
								}),
							check)
				}

				target.keydown(handler)

			// stop keyboard handling...
			} else {
				this.__keyboard_event_source
					&& this.__keyboard_event_source
						.off('keydown', this.__keyboard_handler)

				delete this.__keyboard_handler
				delete this.__keyboard_event_source
			}
		},
		['on', 'off'])],

	// Format:
	// 	{
	// 		<action>: [
	// 			<key>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	// XXX this does not check overloading between modes...
	getKeysForAction: ['- Interface/',
		function(actions, modes){
			actions = actions == '*' ? null : actions
			actions = !actions || actions instanceof Array ? actions : [actions]

			modes = modes || null
			modes = !modes || modes instanceof Array ? modes : [modes]
			modes = modes || this.getKeyboardModes()

			// XXX does this handle overloading???
			var help = keyboard.buildKeybindingsHelp(
				this.keyboard, 
				null, 
				this,
				// get full doc compatible with get path...
				function(action, args){
					// NOTE: we do not care about the actual args 
					// 		here, all we need is for this to mismatch
					// 		if args exist...
					//return args.length == 0 ? Object.keys(this.getPath(action))[0] : '--' })
					return args.length == 0 ? action : '--' })
			var res = {}

			// build the result...
			Object.keys(help)
				// filter modes...
				.filter(function(mode){ return modes.indexOf(mode) >= 0 })
				.forEach(function(mode){
					Object.keys(help[mode])
						// keep only the actions given...
						.filter(function(action){
							return action != '--' 
								&& action != 'doc' 
								&& (!actions 
									|| actions.indexOf(action) >= 0)
						})
						.forEach(function(action){
							res[action] = (res[action] || []).concat(help[mode][action])
						})
				})

			return res
		}],

	// XXX argument #3 is not yet used (see: lib/keyboard.js)...
	getKeyboardModes: ['- Interface/',
		function(){
			return this.__keyboard_event_source ?
				keyboard.getApplicableModes(this.keyboard, null, this.__keyboard_event_source)
	   			: [] }],

	// XXX need to pre-process the docs...
	// 		- remove the path component...
	// 		- insert the action name where not doc present...
	// XXX cleanup CSS
	showKeyboardBindings: ['Interface/Show keyboard bindings...',
		widgets.makeUIDialog('Drawer', 
			function(){
				return keyboard.buildKeybindingsHelpHTML(
					this.__keyboard_config, 
					this, 
					function(action){
						return Object.keys(this.getPath(action))[0] })
			},
			{
				background: 'white',
				focusable: true,
			})],


	// XXX Things not to forget: 
	// 		* sort modes
	// 		* sort actions
	// 		* action editor dialog
	// 		* mode editor dialog
	// 		* add ability to disable key (???)
	// 		* ignore flag/list...
	// XXX key editor:
	//
	// 		[ mode ]
	// 		[  action (text with dataset)  ] [  args (text field)  ] no default: [_]
	//		---
	//		<list of keys>
	//		new
	// XXX add view mode (read only)...
	// XXX BUG sections with doc do not show up in title...
	// XXX BUG:
	// 		ig.bindKey('Global', 'X', 'editKeyboardBindings')
	// 		ig.editKeyboardBindings()
	// 			-> shows alt-X instead of X
	// 		ig.bindKey('Global', 'X', 'editKeyboardBindings')
	// 		ig.editKeyboardBindings()
	// 			-> shows two keys ctrl-Z and ctrl-shift-Z instead of Z
	browseKeyboardBindings: ['Interface/Keyboard bindings...',
		widgets.makeUIDialog(function(path, edit){
			var actions = this

			// Format:
			// 	{
			// 		<mode>: {
			// 			<action-code>: [ <key>, ... ],
			// 			...
			// 		},
			// 		...
			// 	}
			var keys = keyboard.buildKeybindingsHelp(
				this.keyboard, 
				null, 
				this,
				// get full doc compatible with get path...
				function(action, args, no_default, doc){
					return action
						+ (no_default ? '!' : '')
						+ (args.length > 0 ?
							': '+ args.map(JSON.stringify).join(' ')
							: '') 
				})

			var dialog = browse.makeLister(null, 
				function(path, make){
					Object.keys(keys)
						.forEach(function(mode){
							var ignored = actions.keyboard[mode].ignore || []
							var bound_ignored = []

							// section heading...
							make(keys[mode].doc ? 
									$('<span>')
										// NOTE: at this time adding a br
										// 		is faster and simpler than
										// 		doing this in CSS...
										// XXX revise...
										.html(mode + '<br>')
										.append($('<span>')
											.addClass('doc')
											.html(keys[mode].doc))
									: mode, 
									{ 
										not_filtered_out: true,
										// XXX should sections be searchable???
										//not_searchable: true,
									})
								.addClass('mode')

							// bindings...
							var c = 0
							Object.keys(keys[mode]).forEach(function(action){
								action != 'doc' 
									// NOTE: wee need the button spec to be
									// 		searchable, thus we are not using 
									// 		the keys attr as in .browseActions(..)
									&& make([action, ' ', '$BUTTONS']
											.concat($('<span>')
												.addClass('text')
												.html(keys[mode][action]
													// mark key if it is in ignored...
													.map(function(s){ 
														s = s.split('+')
														var k = s.pop() 
														var i = ignored.indexOf(k)
														i >= 0 
															&& bound_ignored
																.push(ignored[i])
														s.push(k 
															+ (i >= 0 ?  '<sup>*</sup>' : ''))
														return s.join('+') })
													.join(' / '))))
										.addClass('key '
											+ (action == 'IGNORE' ? 'ignored' : ''))
									&& c++
							})

							// no keys in view mode...
							// XXX is adding info stuff like this a correct 
							// 		thing to do in code?
							c == 0 && !edit 
								&& make('No bindings...', 
									{
										disabled: true,
										hide_on_search: true,
									})
									.addClass('info')

							// unpropagated and unbound keys...
							make(['Unpropagated and unbound keys:',
									// NOTE: this blank is so as to avoid
									// 		sticking the action and keys 
									// 		together in path...
									' ',
									'$BUTTONS',
									ignored
										.filter(function(k){ 
											return bound_ignored.indexOf(k) == -1 })
										.join(' / ')])
								.addClass('ignore-list')

							// controls...
							if(edit){
								var elem = make('new', {
									buttons: [
										// XXX
										['key', 
											function(){
												//elem.before( XXX )
											}],
										// XXX
										['mode', 
											function(){
												//elem.after( XXX )
											}],
									]})
									.addClass('new')
							}
						})

					// notes...
					// XXX is adding info stuff like this a correct 
					// 		thing to do in code?
					make('---')
					make($('<span>')
							.addClass('text')
							.html('<sup>*</sup> keys not propogated to next section.'), 
						{ 
							disabled: true ,
							hide_on_search: true,
						})
						.addClass('info')
				}, {
					cls: [
						'key-bindings',
						'no-item-numbers',
						(edit ? 'edit' : 'browse'),
					].join(' '),

					itemButtons: edit ?
					   	[
							// NOTE: ordering within one section is purely 
							// 		aesthetic and has no function...
							// XXX do wee actually need ordering???
							// XXX up
							//['&#9206;', function(){}],
							// XXX down
							//['&#9207;', function(){}],

							// XXX edit -- launch the editor...
							['&ctdot;', function(){}],
							//['edit', function(){}],
							//['&#128393;', function(){}],
						]
						: [],
				})

			return dialog
		})],
	// XXX place this in /Doc/.. (???)
	editKeyboardBindings: ['Interface/Keyboard bindings editor...',
		widgets.uiDialog(function(path){ 
			return this.browseKeyboardBindings(path, true) })],

	// XXX
	resetKeyBindings: ['Interface/Restore default key bindings',
		function(){ 
			this.__keyboard_config = GLOBAL_KEYBOARD }],

	// XXX do we look for aliases in this mode only or in all modes?
	getKeyHandler: ['- Interface/',
		function(modes, key, action){
		}],
	// XXX move this to lib/keyboard.js
	// XXX not done yet...
	bindKey: ['- Interface/',
		function(mode, key, action){
			var modifiers = key.split('+')
			key = modifiers.pop()
			modifiers = modifiers.join('+')
			var code = keyboard.toKeyCode(key)
			var args = [].slice.call(arguments).slice(3)
			action = action 
					+ (args.length > 0 ? 
						': '+ args.map(JSON.stringify).join(' ')
						: '')
			var bindings = this.keyboard[mode]

			var alias = code in bindings ? code : key
			var handler = bindings[key] || bindings[code]

			// spin through aliases...
			var seen = []
			while(handler in bindings){
				// handler loop...
				if(seen.indexOf(handler) >= 0){
					return null
				}
				
				alias = handler
				handler = bindings[alias]
				seen.push(alias)
			}

			if(handler == null || typeof(handler) == typeof('str')){
				bindings[alias] = modifiers.length == 0 ?
					action
					: { modifiers : action }

			} else if(modifiers.length == 0){
				handler['default'] = action

			} else {
				handler[modifiers] = action
			}
		}],
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
			}],

		// pause keyboard repeat...
		['shiftImageUp.pre shiftImageDown.pre',
			function(){
				var r = this.current_ribbon

				return function(){
					// pause repeat if shifting last image out of the ribbon... 
					if(this.data.ribbons[r] == null 
							|| this.data.ribbons[r].len == 0){
						this.pauseKeyboardRepeat()
					}
				}
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
