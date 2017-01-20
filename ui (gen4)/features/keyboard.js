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

var GLOBAL_KEYBOARD =
module.GLOBAL_KEYBOARD = {
	'Global': {
		doc: 'Global bindings that take priority over other sections.',
		pattern: '*',

	},

	'Slideshow': {
		pattern: '.slideshow-running',
		drop: [
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
		R: 'toggleSlideshowDirection -- Reverse slideshow direction',
		L: 'toggleSlideshowLooping -- Toggle slideshow looping',
	},

	// XXX do we need to prevent up/down navigation here, it may get confusing?
	// XXX do we need to disable fast sorting here???
	'Single Image': {
		pattern: '.single-image-mode',
		drop: [
			'Esc',

			// do not crop in single image mode...
			'C', 'F2',

			// zooming...
			'#0', '#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
		],


		// handle in next section...
		'(': 'NEXT',
		')': 'NEXT',

		// zooming...
		'#1': 'fitScreen',
		// XXX should these also be implemented in the same way as 4-9???
		'#2': 'fitNormal',
		'alt+#2': 'setNormalScale -- Set current image size as normal',
		'ctrl+shift+#2': 'setNormalScale: null -- Reset normal image size to default',
		'#3': 'fitSmall',
		'alt+#3': 'setSmallScale -- Set current image size as small',
		'ctrl+shift+#3': 'setSmallScale: null -- Reset small image size to default',

		// NOTE: these are the same, the only difference is the number...
		'#4': 'fitCustom: 4 -- Set cutom image size',
		'alt+#4': 'setCustomSize: 4 -- Set current image size as custom',
		'ctrl+shift+#4': 'setCustomSize: 4 null -- Clear custom image size',

		'#5': 'fitCustom: 5 -- Set cutom image size',
		'alt+#5': 'setCustomSize: 5 -- Set current image size as custom',
		'ctrl+shift+#5': 'setCustomSize: 5 null -- Clear custom image size',

		'#6': 'fitCustom: 6 -- Set cutom image size',
		'alt+#6': 'setCustomSize: 6 -- Set current image size as custom',
		'ctrl+shift+#6': 'setCustomSize: 6 null -- Clear custom image size',

		'#7': 'fitCustom: 7 -- Set cutom image size',
		'alt+#7': 'setCustomSize: 7 -- Set current image size as custom',
		'ctrl+shift+#7': 'setCustomSize: 7 null -- Clear custom image size',

		'#8': 'fitCustom: 8 -- Set cutom image size',
		'alt+#8': 'setCustomSize: 8 -- Set current image size as custom',
		'ctrl+shift+#8': 'setCustomSize: 8 null -- Clear custom image size',

		'#9': 'fitCustom: 9 -- Set cutom image size',
		'alt+#9': 'setCustomSize: 9 -- Set current image size as custom',
		'ctrl+shift+#9': 'setCustomSize: 9 null -- Clear custom image size',

		'#0': 'fitCustom: 0 -- Set cutom image size',
		'alt+#0': 'setCustomSize: 0 -- Set current image size as custom',
		'ctrl+shift+#0': 'setCustomSize: 0 null -- Clear custom image size',

		Esc: 'toggleSingleImage: "off" -- Exit single image view',

		// ignore sorting and reversing...
		// XXX not sure about these yet, especially reversing...
		shift_R: 'DROP',
		shift_S: 'DROP',
	},

	// XXX add "save as collection..."
	'Crop': {
		pattern: '.crop-mode',

		Esc: 'uncrop',
		ctrl_Esc: 'uncropAll',

		W: 'testAction2 -- XXX DEBUG: remove when done...',
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

		F1: 'browseActions: "/Help/" -- Help menu...',

		alt_X: 'close',
		alt_F4: 'close',
		meta_Q: 'close',

		// XXX
		F5: 'reload!: "full" -- Reload viewer (full)',
		/*F5: keyboard.doc('Reload viewer (full)', 
			function(){ 
				//a.stop()
				//killAllWorkers()
				//	.done(function(){
				//		reload() 
				//	})
				location.reload()
				return false
			}),
		//*/

		F12: 'showDevTools',
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		meta_alt_I: 'F12',
		ctrl_shift_p: 'F12',


		// dialogs...
		// XXX should this be all here or in respective sections???
		alt_A: 'browseActions',

		//alt_S: 'browseActions: "/Sort/" -- Sort menu...',
		alt_shift_A: 'listActions',


		// open/save...
		O: 'browsePath',
		ctrl_S: 'saveIndexHere',
		ctrl_shift_S: 'exportDialog',


		// external editors...
		// XXX not sure if this is the right way to go...
		E: 'openInExtenalEditor',
		shift_E: 'openInExtenalEditor: 1 -- Open in alternative editor',
		alt_E: 'listExtenalEditors',


		// history...
		ctrl_H: 'listURLHistory',
		ctrl_shift_H: 'listSaveHistory',

		U: 'undo',
		ctrl_Z: 'undo',
		shift_U: 'redo',
		ctrl_shift_Z: 'redo',
		alt_H: 'browseActions: "/History/" -- History menu...',


		// tilt...
		// XXX experimental, not sure if wee need this with a keyboard...
		T: 'rotateRibbonCCW -- Tilt ribbons counter clock wise',
		shift_T: 'rotateRibbonCW -- Tilt ribbons clock wise',
		alt_T: 'resetRibbonRotation -- Reset ribbon tilt',


		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: 'toggleFullScreen', 
		ctrl_F: 'F11',
		meta_F: 'F11',

		ctrl_R: 'loadNewImages!',
		ctrl_alt_R: 'reload!',
		ctrl_shift_R: 'F5',


		// modes... 
		Enter: 'toggleSingleImage',
		S: 'slideshowDialog',


		// statusbar...
		shift_I: 'toggleStatusBar',
		G: 'editStatusBarIndex!',
		shift_G: 'toggleStatusBarIndexMode!',


		// theme...
		ctrl_B: 'toggleTheme!',
		ctrl_shift_B: 'toggleTheme!: "prev"',
		'ctrl+-': 'darkerTheme!',
		'ctrl++': 'lighterTheme!',


		// navigation...
		Left: 'prevImage',
		Backspace: 'Left',
		Right: 'nextImage',
		Space: 'Right',

		'(': 'prevImageInOrder',
		')': 'nextImageInOrder',

		PgUp: 'prevScreen',
		ctrl_Left: 'prevScreen',
		// XXX need to prevent default on mac + browser...
		meta_Left: 'prevScreen',

		PgDown: 'nextScreen',
		ctrl_Right: 'nextScreen',
		// XXX need to prevent default on mac + browser...
		meta_Right: 'nextScreen',

		Home: 'firstImage',
		ctrl_Home: 'firstGlobalImage',
		shift_Home: 'firstRibbon',
		End: 'lastImage',
		ctrl_End: 'lastGlobalImage',
		shift_End: 'lastRibbon',

		Up: 'prevRibbon',
		Down: 'nextRibbon',


		// shifting...
		shift_Up: 'shiftImageUp',
		alt_shift_Up: 'travelImageUp',
		ctrl_shift_Up: 'shiftImageUpNewRibbon',

		shift_Down: 'shiftImageDown',
		alt_shift_Down: 'travelImageDown',
		ctrl_shift_Down: 'shiftImageDownNewRibbon',

		alt_Left: 'shiftImageLeft!',
		alt_Right: 'shiftImageRight!',

		shift_B: 'setBaseRibbon',


		// editing...
		R: 'rotateCW',
		L: 'rotateCCW',
		H: 'flipHorizontal',
		V: 'flipVertical',


		// ribbon image stuff...
		alt_I: 'browseActions: "/Image/" -- Image menu...',
		alt_R: 'browseActions: "/Ribbon/" -- Ribbon menu...',


		// ranges...
		// XXX experimental
		// XXX add border jumping to Home/End...
		'{': 'openRange',
		'}': 'closeRange',
		'*': 'setRangeBorder',


		// zooming...
		'+': 'zoomIn',
		'=': '+',
		'-': 'zoomOut',
		'_': '-',

		'#0': 'fitMax',
		'#1': 'fitImage',
		'shift+#1': 'fitRibbon',
		'ctrl+#1': 'fitOrig!',
		'#2': 'fitImage: 2 -- Fit 2 Images',
		'#3': 'fitImage: 3 -- Fit 3 images',
		'shift+#3': 'fitRibbon: 3.5 -- Fit 3.5 ribbons',
		'#4': 'fitImage: 4 -- Fit 4 images',
		'#5': 'fitImage: 5 -- Fit 5 images',
		'shift+#5': 'fitRibbon: 5.5 -- Fit 5.5 ribbons',
		'#6': 'fitImage: 6 -- Fit 6 images',
		'#7': 'fitImage: 7 -- Fit 7 images',
		'#8':'fitImage: 8 -- Fit 8 images',
		'#9': 'fitImage: 9 -- Fit 9 images',
		

		// cropping...
		F2: 'cropRibbon',
		shift_F2: 'cropRibbonAndAbove',
		ctrl_F2: 'cropMarked',
		alt_F2: 'cropBookmarked',
		C: 'browseActions: "/Crop/" -- Crop menu...',


		// metadata...
		I: 'showMetadata',
		ctrl_shift_I: 'showMetadata: "current" "full" -- Show full metadata',


		// marking...
		M: 'toggleMark',
		ctrl_A: 'toggleMark!: "ribbon" "on" -- Mark all images in ribbon',
		ctrl_D: 'toggleMark!: "ribbon" "off" -- Unmark all images in ribbon',
		ctrl_I: 'toggleMark!: "ribbon" -- Invert marks in ribbon',
		',': 'prevMarked',
		'.': 'nextMarked',
		alt_M: 'browseActions: "/Mark/" -- Mark menu...',


		// bookmarking...
		B: 'toggleBookmark',
		'[': 'prevBookmarked',
		']': 'nextBookmarked',
		alt_B: 'browseActions: "/Bookmark/" -- Bookmark menu...',



		// copy/paste...
		// do the default copy thing...
		// NOTE: this stops the default: handler from getting the ctrl:
		// 		key case...
		ctrl_C: '',
		ctrl_V: '',


		// sort...
		//shift_S: 'sortImages: "Date" -- Sort images by date',
		shift_S: 'sortImages -- Sort images',
		// XXX need to make this save to base_path if it exists and
		// 		ask the user if it does not... now it always asks.
		shift_R: 'reverseImages',
		alt_S: 'sortDialog',


		// doc...
		// XXX for debug...
		//ctrl_G: function(){ $('.viewer').toggleClass('visible-gid') },
		//'?': 'showKeyboardBindings',
		'?': 'browseKeyboardBindings',


		//W: 'testAction -- XXX DEBUG: remove when done...',
		W: 'nonAction -- XXX DEBUG: remove when done...',
	},
}



/*********************************************************************/
// XXX add loading/storing of kb bindings...
// XXX experimenting with new style of doc strings, usable from the 
// 		system... (for details see: core.doc)

var KeyboardActions = actions.Actions({
	config: {
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

		// limit key repeat to one per N milliseconds.
		//
		// Set this to -1 or null to run keys without any limitations.
		'max-key-repeat-rate': 0,

		// The amount of keyboard "quiet" time to wait for when
		// .pauseKeyboardRepeat(..) is called...
		'keyboard-repeat-pause-check': 100,
	},

	get keybindings(){
		return this.__keyboard_config },
	get keyboard(){
		var that = this
		// XXX should this be here on in start event???
		var kb = this.__keyboard_object = 
			this.__keyboard_object 
				|| keyboard.KeyboardWithCSSModes(
					function(){ return that.__keyboard_config },
					function(){ return that.ribbons.viewer })
		return kb },

	testKeyboardDoc: ['- Interface/',
		core.doc`Self-test action...`,
		{self_test: true},
		function(){
			var that = this
			var keys = this.keyboard.keys()

			var index = {}
			Object.keys(keys).forEach(function(mode){
				Object.keys(keys[mode]).forEach(function(code){
					if(code == ''){
						return
					}

					var a = keyboard.parseActionCall(code)
					var doc = a.doc || that.getDocTitle(a.action) || null

					// check if we have no doc...
					if(doc == null || doc == ''){
						console.warn('Action has no doc: "'
							+ a.action +'" at: "'+ code +'"') 
					}

					// see if two actions have the same doc...
					//
					// This problem can be fixed by:
					// 	- setting a different doc in .keybindings...
					// 	- updating action doc...
					if(index[doc] && index[doc] != a.action){
						console.warn('Actions have same doc/title: "' 
							+ index[doc] +'" and "'+ a.action
							+'" at: "'+ code +'"')
					}

					index[doc] = a.action
				})
			})
		}],


	// Key bindings ---------------------------------------------------
	// XXX need a clean deep copy to restore...
	resetKeyBindings: ['Interface/Restore default key bindings',
		function(){ 
			thiis.__keyboard_config = GLOBAL_KEYBOARD }],
	keyHandler: ['- Interface/Get or set key handler',
		function(mode, key, action){ 
			var res = this.keyboard.handler(mode, key, action) 
			// return res only if we get a handler...
			if(!action){
				return res
			}
		}],
	getKeysForAction: ['- Interface/',
		core.doc`Get normalized, flat set of actions and keys that trigger them...
		
		Format:
			{
				<action>: [
					<key>,
					...
				],
				...
			}
		
		NOTE: this does not check overloading between modes i.e. if two
			actions in two different modes are bound to the same key 
			only one is shown...
			XXX is this a bug???
				...at this point can't find when this produces inconsistencies...
		`,
		function(actions, modes){
			var that = this
			var res = {}

			// Normalize handler to one of the following forms:
			// 	- "<action>"
			// 	- "<action>: <arg> ..."
			//
			// We intentionally the following because they are not 
			// relevant to the actual action function:
			// 	- .doc
			// 	- .no_default
			// 	- .stop_propagation
			var normalizeHandler = function(action){
				var a = keyboard.parseActionCall(action.doc || action)
				return a.action in that ?
					a.action 
						+(a.arguments.length > 0 ? 
							(': '+ a.arguments.map(JSON.stringify))
							: '')
					: null 
			}

			actions = actions || '*'
			actions = (actions != '*' && actions instanceof Array) ?
				actions 
				: [actions]
			actions = actions != '*' ? 
				// normalize the inputs...
				actions.map(normalizeHandler) 
				: actions

			modes = modes || this.keyboard.modes()
			modes = modes == '*' ? Object.keys(this.keybindings)
				: modes instanceof Array ? modes 
				: [modes]

			var keys = this.keyboard.keys()

			// build the result -- flatten the key list...
			modes.forEach(function(mode){
				mode in keys 
					&& Object.keys(keys[mode])
						// parse the actions...
						.forEach(function(action){ 
							var t = normalizeHandler(action)
							if(t && (actions == '*' || actions.indexOf(t) >= 0)){
								res[t] = (res[t] || []).concat(keys[mode][action])
							}
						})
			})

			return res
		}],


	// keyboard handling ----------------------------------------------
	keyPress: ['- Interface/Handle key or keyboard event',
		core.doc`Handle key / keyboard event...
	
			Handle key...
			.keyPress(<key>)
		
			Handle key and call func if key is not bound...
			.keyPress(<key>, <func>)
		
			Handle key event...
			.keyPress(<event>)
		
			Handle key and call func if key is not bound...
			.keyPress(<event>, <func>)
	
	
		NOTE: care must be taken when using or binding to this (especially 
	 		the .pre stage) as this may introduce a lag into user input.
		`,
		{ keepDialogTitle: true },
		function(key, no_match){
			// get/set the handler...
			var handler = this.__key_press_handler = 
				this.__key_press_handler 
					|| keyboard.makeKeyboardHandler(this.keyboard, null, this)
			// do the call...
			return handler(key, no_match)
		}],
	toggleKeyboardHandling: ['- Interface/Keyboard handling',
		toggler.Toggler(null, function(_, state){ 
			var that = this

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

			var kb = this.keyboard

			// start/reset keyboard handling...
			if(state == 'on'){
				// NOTE: the target element must be focusable...
				var target =
				this.__keyboard_event_source =
					this.config['keyboard-event-source'] == null ? this.ribbons.viewer 
					: this.config['keyboard-event-source'] == 'window' ? $(window)
					: this.config['keyboard-event-source'] == 'viewer' ? this.ribbons.viewer
					: this.config['keyboard-event-source'] == 'document' ? $(document)
					: $(this.config['keyboard-event-source'])

				// need to reset...
				this.__keyboard_handler
					&& target.off('keydown', this.__keyboard_handler)

				// make the base handler...
				var handler = 
					keyboard.stoppableKeyboardRepeat(
						this.keyPress.bind(this),
						/*/ log unbound keys...
						function(evt){ 
							return that.keyPress(evt, function(evt, k){ 
								window.DEBUG && console.log('KEY:', k) }) },
						//*/
						check)

				// setup base keyboard for devel, in case something breaks...
				// This branch does not drop keys...
				if(this.config['max-key-repeat-rate'] < 0 
						|| this.config['max-key-repeat-rate'] == null){
					this.__keyboard_handler = handler

				// drop keys if repeating too fast...
				// NOTE: this is done for smoother animations...
				} else {
					handler = 
					this.__keyboard_handler =
						keyboard.dropRepeatingkeys(
							handler,
							function(){ 
								return that.config['max-key-repeat-rate'] })
				}

				target.keydown(handler)

			// stop keyboard handling...
			} else {
				this.__keyboard_event_source
					&& this.__keyboard_event_source
						.off('keydown', this.__keyboard_handler)

				//delete this.__keyboard_object
				delete this.__keyboard_handler
				delete this.__keyboard_event_source
			}
		},
		['on', 'off'])],
	pauseKeyboardRepeat: ['- Interface/Drop keys until none are pressed for a timout',
		core.doc`Drop keys until non are pressed for a timeout...

		This is useful for stopping repeating (held down) keys after some
		event.`,
		function(){ this.__keyboard_repeat_paused = true }],
})

var Keyboard = 
module.Keyboard = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'keyboard',
	depends: [
		'ui',
	],
	suggested: [
		'self-test',
		'keyboard-ui',
	],

	actions: KeyboardActions, 

	handlers: [
		['start',
			function(){
				var that = this
				this.__keyboard_config = this.keybindings || GLOBAL_KEYBOARD

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

		/*
		['keyHandler',
			function(res, mode, key, action){
				action && this.testKeyboardDoc() }],
		//*/
	],
})



//---------------------------------------------------------------------

var KeyboardUIActions = actions.Actions({
	config: {
		// NOTE: this is defined in ui-dialogs
		//'ui-confirm-timeout': 2000,
	},

	// Interface stuff ------------------------------------------------
	// XXX BUG sections with doc do not show up in title...
	// XXX BUG: for some reason modes are unclickable...
	// XXX slow on update...
	// XXX sub-group by path (???)
	browseKeyboardBindings: ['Help/Keyboard bindings...',
		core.doc`Keyboard bindings viewer...
	
		options format:
			{
				// Classes to add to the dialog...
				cls: 'edit',
		
				// If true, show non-actions in the list...
				// This would include:
				//	- aliases
				//	- special handlers (like: DROP, NEXT, ...) 
				//	- actions of features not loaded or not available
				show_non_actions: false,
		
				// If true will show the placeholder text in sections that 
				// contain no mappings...
				//
				// This can also be a string, which will be shown as empty 
				// section text.
				empty_section_text: true,
		
				// Function used to get/generate text to represent an action
				// in the list.
				//
				// If not defined or false action doc will be used if 
				// available.
				get_key_text: <function>,
		
		
				// Button structures for different sections...
				//
				// All of these must confirm to the lib/widget/browse buttons
				// format:
				//	{
				//		[<html>: <func>],
				//		...
				//	}
				//
				// (see: browse.Browser.update(..) doc for more info)
				//
				// Mode section title...
				mode_buttons: <buttons>,
		
				// Mode actions...
				//
				// If false or undefined the element will not be shown.
				//
				// NOTE: these are shown at the end of a section.
				mode_actions: <buttons>,
		
				// Key binding buttons...
				key_buttons: <buttons>,
		
				// Dropped key list buttons...
				drop_buttons: <buttons>,
			}
	
		NOTE: this is designed to be a viewer by default but provide enough
			configurability to support editing without actually including
			any editing mechanics.
			This should separate the editing mechanics from the actual 
			view layout while at the same time keeping it consistent.
			The main drawback could be that this will complicate the 
			layout development until (if) it stabilizes.
		`,
		widgets.makeUIDialog(function(path, options){
			options = options || {}

			var actions = this
			var keybindings = this.keybindings
			var kb = this.keyboard

			// get doc...
			var getKeyText = options.get_key_text === undefined ?
				function(action){
					var doc = action.doc ? action.doc
						: action.action in this ? this.getDocTitle(action.action)
						: action.action 
					return doc.length == 0 ? action.action : doc
				}
				: options.get_key_text

			var dialog = browse.makeLister(null, 
				function(path, make){
					var keys = kb.keys('*')

					Object.keys(keybindings)
						.forEach(function(mode){
							var dropped = keybindings[mode].drop || []
							var bound_ignored = []

							// section heading (mode)...
							make(keybindings[mode].doc ? 
									$('<span>')
										// NOTE: at this time adding a br
										// 		is faster and simpler than
										// 		doing this in CSS...
										// XXX revise...
										.html(mode + '<br>')
										.append($('<span>')
											.addClass('doc')
											.html(keybindings[mode].doc))
									: mode, 
									{ 
										not_filtered_out: true,
										// XXX should sections be searchable???
										not_searchable: true,
										buttons: options.mode_buttons,
									})
								.attr('mode', mode)
								.addClass('mode')

							// bindings...
							var c = 0
							Object.keys(keys[mode] || {}).forEach(function(action){

								var o = keyboard.parseActionCall(action)

								if(getKeyText){
									var doc = ''
									var text = getKeyText.call(actions, o)

								} else {
									var doc = o.doc
									var text = o.action 
										+ (o.no_default ? '!' : '') 
										+ (o.arguments.length > 0 ? 
											(': '+ o.arguments.map(JSON.stringify).join(' '))
											: '')
								}

								var hidden = !options.show_non_actions
									// hide all non-actions...
									&& !(o.action in actions
										// except: functions represented by their doc...
										|| keybindings[mode][action] == null
											&& kb.handler(mode, keys[mode][action][0]) 
												instanceof Function)

								// NOTE: wee need the button spec to be
								// 		searchable, thus we are not using 
								// 		the keys attr as in .browseActions(..)
								make([text, ' ', '$BUTTONS']
										.concat($('<span>')
											.addClass('text')
											.html(keys[mode][action]
												// mark key if it's dropped...
												.map(function(s){ 
													if(dropped == '*'){
														s += '<sup>*</sup>'
													} else {
														s = s.split('+')
														var k = s.pop() 
														var i = dropped.indexOf(k)
														i >= 0 
															&& bound_ignored
																.push(dropped[i])
														s.push(k + (i >= 0 ?  '<sup>*</sup>' : ''))
														s = s.join('+')
													}
													return s 
												})
												.join(' / '))),
									{
										// hide stuff that is not an action...
										hidden: hidden,	
										disabled: hidden,	

										buttons: options.key_buttons,
									})
									.attr({
										'mode': mode,
										'code': action,
										'doc': doc.trim() != '' ? 
											doc 
											: (kb.special_handlers[action] 
												|| null),
									})
									.addClass('key'
										// special stuff...
										+ (action in kb.special_handlers ?
										   	' special-action' 
											: '')
										// aliases...
										+ (o.action in actions ? '' : ' non-action'))
								c++
							})

							// no keys in view mode...
							// XXX is adding info stuff like this a correct 
							// 		thing to do in code?
							c == 0 && options.empty_section_text !== false
								&& make(options.empty_section_text || 'No bindings...', 
									{
										disabled: true,
										hide_on_search: true,
									})
									.attr('mode', mode)
									.addClass('info')

							// unpropagated and unbound keys...
							make(['Unpropagated and unbound keys:',
									// NOTE: this blank is so as to avoid
									// 		sticking the action and keys 
									// 		together in path...
									' ',
									'$BUTTONS',
									dropped == '*' ? 
										dropped 
										: dropped
											.filter(function(k){ 
												return bound_ignored.indexOf(k) == -1 })
											.join(' / ')],
								{
									buttons: options.drop_buttons,
								})
								.addClass('drop-list')
								.attr('mode', mode)

							// controls...
							if(options.mode_actions){
								var elem = make('new', {
										buttons: options.mode_actions,
									})
									.attr('mode', mode)
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
				}, 
				{
					path: path,
					cls: [
						'key-bindings',
						'no-item-numbers',
						options.cls,
					].join(' '),
				})

			return dialog
		})],
	// XXX do we need a binding to add new keys to current mode from the 
	// 		keyboard???
	editKeyboardBindings: ['Interface/Keyboard bindings editor...',
		core.doc`Similar to .browseKeyboardBindings(..) but adds editing functionality...
		
		For more details see: .browseKeyboardBindings(..)`,
		widgets.uiDialog(function(path){ 
			var that = this
			var bindings = this.keybindings

			var sortModes = function(list){
				var ordered = {}
				list.find('[mode]')
					.map(function(){ return $(this).attr('mode')})
					.toArray()
					.unique()
					.forEach(function(mode){
						ordered[mode] = bindings[mode]
					})
				// reorder only if we moved all the modes...
				if(Object.keys(bindings).length == Object.keys(ordered).length){
					that.__keyboard_config = ordered
				}
			}

			var dialog = this.browseKeyboardBindings(
				path, 
				{
					cls: 'edit',
					show_non_actions: true,
					empty_section_text: false,
					get_key_text: false,

					// mode...
					mode_buttons: [
						// up...
						['&#9206;', function(_, cur){
								var mode = cur.attr('mode')
								var elems = cur.parent().find('[mode="'+mode+'"]')
								var prev = elems.first().prev('[mode]').attr('mode')

								// move only if we have somewhere to move...
								if(prev){
									cur.parent().find('[mode="'+prev+'"]')
										.first()
										.before(elems)
									dialog.select(elems.first())

									// do the actual section ordering...
									sortModes(cur.parent())
								}
							}],
						// down...
						['&#9207;', function(_, cur){
								var mode = cur.attr('mode')
								var elems = cur.parent().find('[mode="'+mode+'"]')
								var next = elems.last().next('[mode]').attr('mode')

								// move only if we have somewhere to move...
								if(next){
									cur.parent().find('[mode="'+next+'"]')
										.last()
										.after(elems)
									dialog.select(elems.first())

									// do the actual section ordering...
									sortModes(cur.parent())
								}
							}],
						['&ctdot;', function(_, cur){
							that.editKeyboardMode(cur.attr('mode'))
								.close(function(){ dialog.update() }) }],
					],
					mode_actions: [
						['key', function(_, cur){
							//elem.before( XXX )
							that.editKeyBinding(cur.attr('mode'))
								.close(function(){ dialog.update() }) }],
						// XXX place element...
						['mode', function(_, cur){
							//elem.after( XXX )
							// XXX need to pass order info...
							that.editKeyboardMode()
								.close(function(){ dialog.update() }) }],
					],

					/*/ XXX do we need this???
					// keys...
					key_buttons: [
						['&ctdot;', function(_, cur){
							that.editKeyBinding(cur.attr('mode'), cur.attr('code'))
								.close(function(){ dialog.update() }) }],
					],

					// dropped key list...
					drop_buttons: [
						['&ctdot;', function(_, cur){
							that.editKeyboardModeDroppedKeys(cur.attr('mode'))
								.close(function(){ dialog.update() }) }],
					],
					//*/
				})
				// XXX should this be only a button thing (done in .browseKeyboardBindings(..))
				// 		or also the main action???
	   			.open(function(){
					var cur = dialog.select('!')
					var sub_dialog

					// key...
					if(cur.hasClass('key')){
						sub_dialog = that
							.editKeyBinding(cur.attr('mode'), cur.attr('code'))

					// mode...
					// XXX BUG: for some reason modes are unclickable...
					} else if(cur.hasClass('mode')){
						sub_dialog = that
							.editKeyboardMode(cur.attr('mode'))

					// dropped...
					} else if(cur.hasClass('drop-list')){
						sub_dialog = that
							.editKeyboardModeDroppedKeys(cur.attr('mode'))
					}

					sub_dialog 
						&& sub_dialog
							.close(function(){ dialog.update() })
				}) 
			return dialog
		})],
	// XXX make fields editable...
	editKeyBinding: ['- Interface/Key mapping...',
		widgets.makeUIDialog(function(mode, code){
			var that = this
			var abort = false

			// list the keys (cache)...
			var keys = that.keyboard.keys(code)
			keys = mode in keys ? 
				(keys[mode][code] || [])
				: [] 
			var orig_keys = keys.slice()

			var dialog = browse.makeLister(null, 
				function(path, make){
					// XXX make editable...
					make(['Mode:', mode || ''])
					// XXX make editable...
					make(['Code:', code || ''])

					make('---')

					make.EditableList(keys)

					make('---')
					
					make.ConfirmAction('Delete', {
						callback: function(){ dialog.close() }, 
						timeout: that.config['ui-confirm-timeout'] || 2000,
						buttons: [
							['Cancel edit', function(){ 
								abort = true
								make.dialog.close()
							}],
						],
					})
				},
				{
					cls: 'metadata-view',
				})
				// save the keys...
				// XXX at this point this does not account for changes 
				// 		in mode or code...
				.on('close', function(){
					if(abort){
						return
					}

					// remove keys...
					orig_keys
						.filter(function(k){ return keys.indexOf(k) < 0 })
						.forEach(function(k){
							that.keyHandler(mode, k, '')
						})

					// add keys...
					keys
						.filter(function(k){ return orig_keys.indexOf(k) < 0 })
						.forEach(function(k){
							that.keyHandler(mode, k, code)
						})
				})

			return dialog
		})],
	// XXX make fields editable...
	editKeyboardMode: ['- Interface/Mode...',
		widgets.makeUIDialog(function(mode){
			var that = this
			var abort = false

			var dialog = browse.makeLister(null, 
				function(path, make){
					// XXX make these editable....
					make(['Mode:', mode || ''])
					make(['Doc:', (that.keybindings[mode] || {}).doc || ''])
					make(['Pattern:', (that.keybindings[mode] || {}).pattern || mode])

					make('---')

					make.ConfirmAction('Delete', {
						callback: function(){
							if(mode in that.keybindings){
								delete that.keybindings[mode]
							}
							dialog.close()
						}, 
						timeout: that.config['ui-confirm-timeout'] || 2000,
						buttons: [
							['Cancel edit', function(){ 
								abort = true
								make.dialog.close()
							}],
						],
					})
				},
				{
					cls: 'metadata-view',
				})

			return dialog
		})],
	// XXX revise:
	// 		- '*' toggle
	// 		- done/cancel
	editKeyboardModeDroppedKeys: ['- Interface/Dropped keys...',
		widgets.makeUIDialog(function(mode){
			var that = this
			var abort = false
			var drop = (that.keybindings[mode].drop || []).slice()

			return browse.makeLister(null, 
				function(path, make){
					var drop_all 

					// the list editor...
					make.EditableList(function(keys){
						// get...
						if(keys === undefined){
							return drop && drop != '*' ? drop : []

						// set...
						} else {
							drop = drop_all ? '*' : keys
						}
					}, 
					{
						unique: true,

						normalize: keyboard.normalizeKey,
						check: keyboard.isKey,
					})

					make.Separator()

					// '*' toggler...
					// XXX should this close the dialog???
					make.ConfirmAction('Drop all keys', {
						callback: function(){ 
							drop_all = '*'
							
							make.dialog.close() 
						}, 
						timeout: that.config['ui-confirm-timeout'] || 2000,
						buttons: [
							['Cancel edit', function(){ 
								abort = true
								make.dialog.close()
							}],
						],
					})
				})
				.on('close', function(){
					if(!abort){
						that.keybindings[mode].drop = drop
					}
				})
		})],


	// XXX move to gen2
	// XXX need to pre-process the docs...
	// 		- remove the path component...
	// 		- insert the action name where not doc present...
	// XXX cleanup CSS
	showKeyboardBindings: ['- Interface/Show keyboard bindings...',
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
})


var KeyboardUI = 
module.KeyboardUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'keyboard-ui',
	depends: [
		'keyboard',
		'ui-dialogs',
	],

	actions: KeyboardUIActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
