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

var browse = require('lib/widget/browse')

var collections = require('features/collections')



/*********************************************************************/

// XXX might be a good idea to normalize key spec values here...
var GLOBAL_KEYBOARD =
module.GLOBAL_KEYBOARD = {
	// NOTE: the order of sections is important, it determines in what 
	// 		order the keys are handled...
	'Global': {
		doc: 'Global bindings that take priority over other sections.',
		pattern: '*',

	},

	'Slideshow': {
		pattern: '.slideshow-running',
		drop: [
			'Space', 'Backspace',
			'Esc',
			'Up', 'Down', 'Enter',
			'R', 'L', 'G', 'T',
		],

		Esc: 'toggleSlideshow: "off" -- Exit slideshow',
		Enter: 'slideshowDialog',

		Space: 'toggleSlideshowTimer',

		Left: 'resetSlideshowTimer',
		Right: 'resetSlideshowTimer',
		Home: 'resetSlideshowTimer',
		End: 'resetSlideshowTimer',

		T: 'slideshowIntervalDialog',
		R: 'toggleSlideshowDirection -- Reverse slideshow direction',
		L: 'toggleSlideshowLooping -- Toggle slideshow looping',
	},

	'Preview filter': {
		pattern: '.filter-applied',
		drop: [
			'Esc',
		],

		Esc: 'togglePreviewFilter: "No filters" -- Clear preview filter',
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
		'^': 'NEXT',
		'$': 'NEXT',
		// NOTE: we need to handle these explicitly...
		alt_C: 'NEXT',
		ctrl_C: 'NEXT',
		'ctrl+#6': 'NEXT',

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

	'Crop': {
		pattern: '.crop-mode',

		drop: [
			'Esc',
			'Del',
		],

		Esc: 'uncrop',
		shift_Esc: 'uncropAll',

		W: 'testAction2 -- XXX DEBUG: remove when done...',

		Del: 'removeFromCrop',
		shift_Del: 'removeMarkedFromCrop',
		ctrl_Del: 'removeRibbonFromCrop',
	},

	'Collection': {
		pattern: '.collection-mode',
		drop: [
			'Esc',
			'Del',
		],

		Esc: 'loadCollection: "'+ collections.MAIN_COLLECTION_TITLE +'" -- Load all images',

		Del: 'uncollect',
		shift_Del: 'uncollectMarked',
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
		F5: 'restart! -- Soft restart',
		ctrl_F5: 'reload!: "full" -- Reload viewer (full)',

		F12: 'showDevTools',
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		meta_alt_I: 'F12',
		ctrl_shift_p: 'F12',


		// dialogs...
		// XXX should this be all here or in respective sections???
		alt_A: 'browseActions',
		alt_F: 'browseActions: "/File/" -- File menu...',
		alt_E: 'browseActions: "/Edit/" -- Edit menu...',
		alt_N: 'browseActions: "/Navigate/" -- Navigate menu...',
		alt_T: 'browseActions: "/Tag/" -- Tag menu...',

		//alt_S: 'browseActions: "/Sort/" -- Sort menu...',

		// open/save...
		O: 'browsePath',
		ctrl_S: 'saveIndexHere',
		//ctrl_shift_S: 'exportDialog',
		ctrl_shift_S: 'exportPresets',
		ctrl_alt_S: 'exportDialog',


		// external editors...
		// XXX not sure if this is the right way to go...
		E: 'openInExtenalEditor',
		shift_E: 'openInExtenalEditor: 1 -- Open in alternative editor',
		ctrl_E: 'listExtenalEditors',


		// history...
		ctrl_H: 'listURLHistory',
		ctrl_shift_H: 'listSaveHistory',
		'ctrl_#6': 'openPreviousLoadedURL',


		U: 'undo',
		ctrl_Z: 'undo',
		shift_U: 'redo',
		ctrl_shift_Z: 'redo',
		alt_H: 'browseActions: "/History/" -- History menu...',


		// tilt...
		// XXX experimental, not sure if wee need this with a keyboard...
		ctrl_T: 'rotateRibbonCCW -- Tilt ribbons counter clock wise',
		ctrl_shift_T: 'rotateRibbonCW -- Tilt ribbons clock wise',
		ctrl_alt_T: 'resetRibbonRotation -- Reset ribbon tilt',


		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: 'toggleFullScreen!', 
		ctrl_F: 'F11',
		meta_F: 'F11',

		ctrl_R: 'sync!',
		ctrl_alt_R: 'reload!',
		ctrl_shift_R: 'F5',


		// modes... 
		Enter: '@500 toggleSingleImage',
		S: 'slideshowDialog',


		// statusbar...
		shift_I: 'toggleStatusBar',
		G: 'editStatusBarIndex!',
		shift_G: 'toggleStatusBarIndexMode!',


		// theme...
		//ctrl_B: 'toggleTheme!',
		//ctrl_shift_B: 'toggleTheme!: "prev"',
		'ctrl+-': 'darkerTheme!',
		'ctrl++': 'lighterTheme!',


		// navigation...
		Left: 'prevImage',
		shift_Space: 'Left',
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
		alt_Home: 'firstRibbon',
		End: 'lastImage',
		ctrl_End: 'lastGlobalImage',
		alt_End: 'lastRibbon',
		// NOTE: these (vim-like) bindings have been added by request as
		// 		it would seem that not all keyboards have a convenient 
		// 		Home/End buttons...
		'^': 'Home',
		'$': 'End',

		Up: 'prevRibbon',
		caps_shift_Up: 'prevRibbon',
		Down: 'nextRibbon',
		caps_shift_Down: 'nextRibbon',


		// shifting...
		shift_Up: 'shiftImageUp',
		caps_Up: 'shiftImageUp',
		alt_shift_Up: 'travelImageUp',
		ctrl_shift_Up: 'shiftImageUpNewRibbon',
		ctrl_Up: 'shiftMarkedUp',
		shift_Home: 'shiftImageToTop',

		shift_Down: 'shiftImageDown',
		caps_Down: 'shiftImageDown',
		alt_shift_Down: 'travelImageDown',
		ctrl_shift_Down: 'shiftImageDownNewRibbon',
		ctrl_Down: 'shiftMarkedDown',
		shift_End: 'shiftImageToBottom',

		alt_Left: 'shiftImageLeft!',
		alt_Right: 'shiftImageRight!',

		shift_B: 'setBaseRibbon',

		alt_PgUp: 'shiftRibbonUp',
		alt_PgDown: 'shiftRibbonDown',


		// editing...
		R: 'rotateCW',
		L: 'rotateCCW',
		H: 'flipHorizontal',
		V: 'flipVertical',


		// ribbon image stuff...
		Menu: 'showContextMenu',
		//alt_I: 'Menu',
		alt_I: 'browseActions: "/Image/" -- Image menu...',
		alt_V: 'browseActions: "/Virtual block/" -- Virtual block menu...',
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
		'#8': 'fitImage: 8 -- Fit 8 images',
		'#9': 'fitImage: 9 -- Fit 9 images',
		

		// cropping...
		F2: 'cropRibbon',
		D: 'cropOutRibbon',
		shift_F2: 'cropOutRibbonsBelow',
		ctrl_F2: 'cropMarked',
		alt_F2: 'cropBookmarked',
		C: 'browseActions: "/Crop/" -- Crop menu...',


		// collections...
		//alt_C: 'browseCollections',
		alt_C: 'browseActions: "/Collections/" -- Collections menu...',
		shift_O: 'browseCollections',
		F8: 'collect!',
		shift_F8: 'addMarkedToCollection!',


		// metadata...
		I: 'showMetadata',
		//ctrl_shift_I: 'showMetadata: "current" "full" -- Show full metadata',

		// XXX
		T: 'showTagCloud',


		// marking...
		M: 'toggleMark',
		Ins: 'toggleMark',
		ctrl_A: 'markRibbon!',
		ctrl_shift_A: 'markLoaded!',
		ctrl_D: 'unmarkRibbon!',
		ctrl_shift_D: 'unmarkLoaded!',
		ctrl_I: 'toggleMarkRibbon!',
		ctrl_shift_I: 'toggleMarkBlock!',
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
		//ctrl_C: 'NEXT',
		ctrl_V: 'NEXT',

		// copy/paste image...
		ctrl_C: 'copy',
		//ctrl_V: 'paste',


		// sort...
		//shift_S: 'sortImages: "Date" -- Sort images by date',
		shift_S: 'sortImages -- Sort images',
		// XXX need to make this save to base_path if it exists and
		// 		ask the user if it does not... now it always asks.
		shift_R: 'reverseImages',
		alt_S: 'sortDialog',


		// filters...
		// NOTE: Esc will also clear the filter (see "Preview filter" mode above)...
		shift_F: 'browseActions: "/Image/Preview filter/" -- Preview filters...',
		';': 'togglePreviewFilter: "Show clipping" -- Preview clipping',
		':': 'togglePreviewFilter: "Show shadows" -- Preview shadows',
		'caps+:': ':',
		'"': 'togglePreviewFilter: "Black and white" -- Preview black and white',
		"'": 'togglePreviewFilter: "Edge detect" -- Show edges',
		'caps+"': '"',

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

// XXX need a clean deep copy to restore...
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
		'keyboard-max-key-repeat-rate': 0,

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
					function(data){ 
						if(data){
							that.__keyboard_config = data
						} else {
							return that.__keyboard_config
						}
					},
					function(){ return that.dom })
		return kb },

	// Add debounce support to keyboard handling... 
	//
	// Syntax:
	// 	@0.5s actionName: arg arg -- doc...
	//
	// Supported units:	
	// 	ms (default)	- Milliseconds
	// 	s				- Seconds 
	// 	m 				- Minutes
	// 	hz				- Hertz
	//
	// NOTE: these are not actions to make the call as light as possible...
	parseStringHandler: function(txt, ...rest){
		var debounce = 0
		var scale = {
			ms: 1,
			s: 1000,
			m: 1000 * 60,
			hz: function(v){ return 1000 / v },
		}
		txt = txt.replace(/^\s*@([^\s]*)\s*/,
			function(_, time){
				var unit = time
					.replace(/(\d+|\d*\.\d+)([^\s]*)/, '$2')
					.toLowerCase()
				unit = unit == '' ? 'ms' : unit
				debounce = scale[unit] instanceof Function ?
					scale[unit](parseFloat(time))
					: parseFloat(time) * scale[unit]
				return '' 
			})

		return debounce > 0 ?
			Object.assign(
				this.parseStringAction(txt, ...rest), 
				{debounce: debounce})
			: this.parseStringAction(txt, ...rest)
	},
	callKeyboardHandler: function(data, context){
		context = context || this
		var meth = data.action
			.split('.')
			.reduce(function(res, e){ 
				context = res
				return res[e] 
			}, this)
		return data.debounce ?
			// debounce...
			this.debounce({
					timeout: data.debounce, 
					tag: 'tag:'+data.action,
					retrigger: true,
					returns: 'dropped',
				},
				meth.bind(context), ...data.arguments)
			// direct call...
			: meth.call(context, ...data.arguments) },


	testKeyboardDoc: ['- Interface/',
		core.doc`Self-test action keyboard configuration.`,
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

					// XXX we should also check if code is a key (i.e. alias)...

					var a = that.parseStringHandler(code, that)
					// skip aliases that look like actions (namely ':') and bad actions...
					if(a.action == ''){
						return
					}
					var doc = a.doc 
						|| (that.getDocTitle && that.getDocTitle(a.action)) 
						|| null

					// check if we have no doc...
					if(doc == null || doc == ''){
						console.warn('Action has no short doc: "'
							+ a.action +'" at: "'+ code +'"') 
						// XXX ???
						return
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
		core.doc`Restore default keyboard bindings`,
		function(){ 
			thiis.__keyboard_config = GLOBAL_KEYBOARD }],
	keyHandler: ['- Interface/Get or set key handler',
		// XXX this is essentially a copy of the docs for keyboard.handler(..), 
		// 		find a way to reuse...
		core.doc`Get/set/unset handler for key...

		In general if handler is not passed this will get the handlers,
		if a handler is given this will set the handler, if the passed 
		handler is either null or '' then it will be unbound.

			Get handler for key in all modes...
			.keyHandler(<key>)
			.keyHandler('*', <key>)
				-> <info> 

			Get handlers for key in applicable modes...
			.keyHandler('?', <key>)
			.keyHandler('test', <key>)
				-> <info> 

			Get handler for key in a specific mode...
			.keyHandler(<mode>, <key>)
				-> <info> 

			Get handler for key in a specific list of modes...
			.keyHandler([ <mode>, .. ], <key>)
				-> <info> 


			Bind handler to key in specific mode...
			.keyHandler(mode, key, handler)
				-> this
		
			Bind handler to key in all modes...
			.keyHandler('*', key, handler)
				-> this
		
			Bind handler to key in applicable modes...
			.keyHandler('?', key, handler)
			.keyHandler('test', key, handler)
				-> this
		
			Bind handler to key in a specific list of modes...
			.keyHandler([mode, ..], key, handler)
				-> this 
		
		
			Unbind handler from key in specific mode...
			.keyHandler(mode, key, null)
			.keyHandler(mode, key, '')
				-> this
		
			Unbind handler from key in all modes...
			.keyHandler('*', key, null)
			.keyHandler('*', key, '')
				-> this
		
			Unbind handler from key in applicable modes...
			.keyHandler('?', key, null)
			.keyHandler('?', key, '')
			.keyHandler('test', key, null)
			.keyHandler('test', key, '')
				-> this
		
			Unbind handler from key in a specific list of modes...
			.keyHandler([mode, ..], key, null)
			.keyHandler([mode, ..], key, '')
				-> this 
		
		
		<info> format:
			{
				<mode>: <handler>,
				...
			}


		NOTE: this is essentially aproxy to .keyboard.handler(..) for 
				more info see its docs.
		`,
		function(mode, key, action){ 
			var res = this.keyboard.handler(mode, key, action) 
			// return res only if we get a handler...
			if(!action){
				return res
			}
		}],
	// XXX NEXT/DROP handling needs more testing...
	// XXX should dropped key handling be done here or in .keyboard.keys()??? 
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
			var kb = this.keyboard
			var keybindings = this.keybindings

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
				var a = that.parseStringHandler(action.doc || action, that)
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

			modes = modes || kb.modes()
			modes = modes == '*' ? Object.keys(keybindings)
				: modes instanceof Array ? modes 
				: [modes]

			var keys = kb.keys('?')

			// build the result -- flatten the key list...
			modes.forEach(function(mode){
				if(mode in keys){
					Object.keys(keys[mode])
						// parse the actions...
						.forEach(function(action){ 
							var t = normalizeHandler(action)
							if(t && (actions == '*' || actions.indexOf(t) >= 0)){
								res[t] = (res[t] || []).concat(keys[mode][action])
							}
						})
				}
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
			var that = this
			// get/set the handler...
			var handler = this.__key_press_handler = 
				this.__key_press_handler 
					//|| keyboard.makeKeyboardHandler(this.keyboard, null, this)
					|| keyboard.makePausableKeyboardHandler(
						this.keyboard, 
						null, 
						this, 
						function(){ return that.config['keyboard-repeat-pause-check'] })
			// do the call...
			return handler(key, no_match)
		}],
	toggleKeyboardHandling: ['- Interface/Keyboard handling',
		core.doc`Toggle keyboard handling on/off`,
		toggler.Toggler(null, function(_, state){ 
			var that = this

			if(state == null){
				return this.__keyboard_handler ? 'on' : 'off'
			}

			var kb = this.keyboard

			// start/reset keyboard handling...
			if(state == 'on'){
				// NOTE: the target element must be focusable...
				var target =
				this.__keyboard_event_source =
					this.config['keyboard-event-source'] == null ? this.dom 
					: this.config['keyboard-event-source'] == 'window' ? $(window)
					: this.config['keyboard-event-source'] == 'viewer' ? this.dom
					: this.config['keyboard-event-source'] == 'document' ? $(document)
					: $(this.config['keyboard-event-source'])

				// need to reset...
				this.__keyboard_handler
					&& target.off('keydown', this.__keyboard_handler)

				// make the base handler...
				var handler = this.keyPress.bind(this)

				// setup base keyboard for devel, in case something breaks...
				// This branch does not drop keys...
				if(this.config['keyboard-max-key-repeat-rate'] < 0 
						|| this.config['keyboard-max-key-repeat-rate'] == null){
					this.__keyboard_handler = handler

				// drop keys if repeating too fast...
				// NOTE: this is done for smoother animations...
				} else {
					handler = 
					this.__keyboard_handler =
						keyboard.dropRepeatingkeys(
							handler,
							function(){ 
								return that.config['keyboard-max-key-repeat-rate'] })
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
		function(){ 
			this.config['keyboard-repeat-pause-check'] > 0
				&& this.keyboard.pauseRepeat
				&& this.keyboard.pauseRepeat() }],
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

				// string action call parser...
				//this.parseStringHandler = this.parseStringAction
				//this.parseStringHandler = this.parseStringActionWithDebounce

				this.toggleKeyboardHandling('on')
			}],
	
		['stop',
			function(){
				this.toggleKeyboardHandling('off') }],

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

// XXX make these usable for any keyboard handler, not just the builtin...
var KeyboardUIActions = actions.Actions({
	config: {
		// NOTE: this is defined in ui-dialogs feature...
		//'ui-confirm-timeout': 2000,
	},

	// XXX sub-group by path (???)
	// XXX make this usable for other other handlers...
	browseKeyboardBindings: ['Help/Keyboard bindings...',
		core.doc`Keyboard bindings viewer...


		This adds several keyboard bindings to the dialog:
			?		- show current action doc, if available.
	
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

			var that = this
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

			return browse.makeLister(null, 
				function(path, make){
					var keys = kb.keys('*')
					var keybindings = kb.keyboard

					Object.keys(keybindings)
						.forEach(function(mode){
							var dropped = keybindings[mode].drop || []
							var bound_ignored = []


							// section heading (mode)...
							make.Heading(mode, { 
									doc: keybindings[mode].doc,
									not_filtered_out: true,
									// XXX should sections be searchable???
									//not_searchable: true,
									buttons: options.mode_buttons,
								})
								.attr({ mode: mode })
								.addClass('mode')

							// bindings...
							var c = 0
							Object.keys(keys[mode] || {}).forEach(function(action){

								var o = that.parseStringHandler(action, that)

								if(getKeyText){
									var doc = ''
									var text = getKeyText.call(that, o)

								} else {
									var doc = o.doc
									var text = (o.debounce ? 
											`@${o.debounce} ` 
											: '')
										+ o.code.split('--')[0].trim()
										
								}

								var hidden = !options.show_non_actions
									// hide all non-actions...
									&& !(o.action in that
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
										'action': o.action,
										'doc': doc.trim() != '' ? 
											doc 
											: (kb.special_handlers[action] 
												|| null),
										'debounce': o.debounce || '',
									})
									.addClass('key'
										// special stuff...
										+ (action in kb.special_handlers ?
										   	' special-action' 
											: '')
										// aliases...
										+ (o.action in that ? '' : ' non-action'))
								c++
							})

							// no keys in view mode...
							// XXX is adding info stuff like this a correct 
							// 		thing to do in code?
							c == 0 && options.empty_section_text !== false
								&& make.Empty(options.empty_section_text || 'No bindings...')
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
								var elem = make('New:', {
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
				// setup extra kb actions...
				.run(function(){
					// clone the bindings so as not to mess up the global browser...
					this.keybindings = JSON.parse(JSON.stringify(this.keybindings))

					// handle '?' button to browse path...
					this.showDoc = function(){
						var action = this.select('!').attr('action')
						action 
							&& action in that 
							&& that.showDoc(action)
					}
					this.keyboard.handler('General', '?', 'showDoc')

					// edit keys on 'E' press...
					if(that.editKeyboardBindings){
						this.editKeys = function(){ 
							that.editKeyboardBindings() 
							this.close()
						}
						this.keyboard.handler('General', 'e', 'editKeys')
						this.keyboard.handler('General', 'F4', 'editKeys')
					}
				}) })],
	// XXX this does not handle the passed container protocol...
	// 		.editKeyboardBindings('Drawer') is broken...
	editKeyboardBindings: ['Interface/Keyboard bindings editor...',
		core.doc`Keyboard bindings editor...
		
		This is similar to .browseKeyboardBindings(..) but adds editing
		functionality...

		This adds several keyboard bindings to the dialog:
			N / K	- add new key binding to current mode.
			M		- add new mode.
		
		NOTE: current mode is the one where focus/selection is, if no 
			item is selected first mode is assumed.
		NOTE: for more details see: .browseKeyboardBindings(..)`,
		widgets.uiDialog(function(path){ 
			var that = this
			var to_select

			var sortModes = function(list){
				that.keyboard.sortModes(
					list.find('[mode]')
						.map(function(){ return $(this).attr('mode')})
						.toArray()
						.unique())
			}

			return this.browseKeyboardBindings(
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
									this.select(elems.first())

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
									this.select(elems.first())

									// do the actual section ordering...
									sortModes(cur.parent())
								}
							}],
					],
					mode_actions: [
						// XXX focus resulting key...
						['key', function(_, cur){
							var dialog = this
							that.editKeyBinding(
									cur.attr('mode'), 
									null, 
									function(e){ to_select = e })
								.close(function(){ dialog.update() }) }],
						// XXX place element...
						// XXX focus resulting mode...
						['mode', function(_, cur){
							var dialog = this
							// XXX need to pass order info...
							that.editKeyboardMode(
									null, 
									function(e){ to_select = e })
								.close(function(){ dialog.update() }) }],
					],
				})
				// XXX should this be only a button thing (done in .browseKeyboardBindings(..))
				// 		or also the main action???
	   			.open(function(){
					var dialog = this
					var cur = this.select('!')
					var sub_dialog

					// key...
					if(cur.hasClass('key')){
						sub_dialog = that
							.editKeyBinding(
								cur.attr('mode'), 
								cur.attr('code'),
								function(e){ to_select = e })

					// mode...
					} else if(cur.hasClass('mode')){
						sub_dialog = that
							.editKeyboardMode(
								cur.attr('mode'), 
								null, 
								function(e){ to_select = e })

					// dropped...
					} else if(cur.hasClass('drop-list')){
						sub_dialog = that
							.editKeyboardModeDroppedKeys(cur.attr('mode'))
					}

					sub_dialog 
						&& sub_dialog
							.close(function(evt, mode){ 
								dialog.update() })
				}) 
				// select updated/new items...
				.on('update', function(){
					to_select 
						// XXX this does not work for modes...
						&& this.select(to_select)
					to_select = null
				})
				// setup keyboard...
				.run(function(){
					this.newKey = function(){
						that.editKeyBinding(
								this.select('!').attr('mode')
									|| Object.keys(kb.keyboard)[0]) 
							.close(function(evt, mode){ 
								this.update() }.bind(this)) }
					this.newMode = function(){ 
						that.editKeyboardMode() 
							.close(function(evt, mode){ 
								this.update() }.bind(this)) }

					this.keyboard
						.handler('General', 'N', 'newKey')
						.handler('General', 'K', 'newKey')
						.handler('General', 'M', 'newMode')
				}) })],
	// XXX add action completion... (???)
	editKeyBinding: ['- Interface/Key mapping...',
		core.doc`Key mapping editor...

		Changes made in the editor are applied only when the dialog is 
		closed, so it is possible to cancel any edit within the dialog
		by either pressing Q or the "Cancel edits" button.
		
		This adds several keyboard bindings to the dialog:
			Q		- quit without saving changes.
		`,
		widgets.makeUIDialog(function(mode, code, callback){
			var that = this
			var orig_code = code

			// list the keys (cache)...
			var keys = that.keyboard.keys(code)
			keys = mode in keys ? 
				(keys[mode][code] || [])
				: [] 
			var orig_keys = keys.slice()

			return browse.makeLister(null, 
				function(path, make){
					var cfg = {
						start_on: 'open',
						edit_text: 'last',
						clear_on_edit: false,
						reset_on_commit: false,
					}

					// XXX make editable???
					make(['Mode:', mode || ''])

					// XXX add completion...
					// 		...datalist seems not to work with non input fields...
					make.Editable(['Code:', code || ''], {
							start_on: 'open',
							edit_text: 'last',
							clear_on_edit: false,
							reset_on_commit: false,
							buttons: [
								['&ctdot;', function(evt, elem){
									code = code || ''
									// highlight the current action...
									var a = that.parseStringHandler(code, that)
									var p = a.action in that ? 
										that.getDocPath(a.action)
										: ''
									// use the action menu to select actions...
									var dialog = that.browseActions(p, {
										no_disabled: true,
										no_hidden: true,
										callback: function(action){
											code = action
											elem.find('.text').last().text(action)
											dialog.close()
										},
									})
									
									dialog.dom.attr({
										'dialog-title': 'Action picker...',
										'keep-dialog-title': true,
									})
								}],
							],
						})
						.on('edit-commit', 
							function(evt, text){ code = text })

					// XXX should we edit/view this separately???
					//make(['Debounce:', that.parseStringHandler(code).debounce || ''])

					make('---')

					make.EditableList(keys, {
						unique: true,

						normalize: keyboard.normalizeKey,
						check: keyboard.isKey,
					})

					make('---')
					
					make.ConfirmAction('Delete', {
						callback: function(){
							keys = []
							make.dialog.close() 
						}, 
						timeout: that.config['ui-confirm-timeout'] || 2000,
						buttons: [
							['Cancel edit', function(){ 
								make.dialog.close('cancel')
							}],
						],
					})
				},
				{
					cls: 'table-view',
				})
				// save the keys...
				// XXX for some reason when Esc this is called twice...
				.on('close', function(_, m){
					if(m == 'cancel'){
						return
					}

					// remove keys...
					orig_keys
						.filter(function(k){ return keys.indexOf(k) < 0 })
						.forEach(function(k){
							that.keyHandler(mode, k, '')
						})

					var new_keys = code == orig_code ?
						keys.filter(function(k){ return orig_keys.indexOf(k) < 0 })
						: keys

					// add keys...
					new_keys
						.forEach(function(k){
							that.keyHandler(mode, k, code) })

					callback 
						&& callback.call(that, code)
				})
				.run(function(){
					this.abort = function(){
						this.close('cancel') }
					this.keyboard.handler('General', 'Q', 'abort')
				}) })],
	editKeyboardMode: ['- Interface/Mode...',
		core.doc`Mode editor...

			Create new mode...
			.editKeyboardMode()
				-> dialog

			Edit/create mode by <name>...
			.editKeyboardMode(<name>)
				-> dialog


		Changes made in the editor are applied only when the dialog is 
		closed, so it is possible to cancel any edit within the dialog
		by either pressing Q or the "Cancel edits" button.
		
		This adds several keyboard bindings to the dialog:
			Q		- quit without saving changes.


		NOTE: empty mode name will not get saved.
		`,
		widgets.makeUIDialog(function(mode, callback){
			var that = this
			var doc = (that.keybindings[mode] || {}).doc
			var pattern = (that.keybindings[mode] || {}).pattern || mode

			var orig_mode = mode in that.keybindings ? mode : null

			return browse.makeLister(null, 
				function(path, make){
					var cfg = {
						start_on: 'open',
						edit_text: 'last',
						clear_on_edit: false,
						reset_on_commit: false,
					}

					make.Editable(['Mode:', mode || ''], cfg)
						.on('edit-commit', 
							function(evt, text){ mode = text.trim() })
					make.Editable(['Doc:', doc || ''], cfg)
						.on('edit-commit', 
							function(evt, text){ doc = text.trim() })
					make.Editable(['Pattern:', pattern], cfg)
						.on('edit-commit', 
							function(evt, text){ pattern = text })

					make('---')

					make.ConfirmAction('Delete', {
						callback: function(){
							if(mode in that.keybindings){
								delete that.keybindings[mode]
							}
							make.dialog.close()
						}, 
						timeout: that.config['ui-confirm-timeout'] || 2000,
						buttons: [
							['Cancel edit', function(){ 
								make.dialog.close('cancel')
							}],
						],
					})
				},
				{
					cls: 'table-view',
				})
				.on('close', function(_, m){
					if(m == 'cancel'){
						return
					}

					var data = that.keybindings[orig_mode] || {}

					data.doc = doc
					data.pattern = pattern

					// update mode name if it changed... 
					if(mode != orig_mode && mode != ''){
						var order = Object.keys(that.keybindings)

						if(orig_mode){
							order[order.indexOf(orig_mode)] = mode
							delete that.keybindings[orig_mode]
						}

						that.keybindings[mode] = data

						that.keyboard.sortModes(order)
					}

					callback 
						&& callback.call(that, mode)
				})
				.run(function(){
					this.abort = function(){
						this.close('cancel') }
					this.keyboard.handler('General', 'Q', 'abort')
				}) })],
	editKeyboardModeDroppedKeys: ['- Interface/Dropped keys...',
		core.doc`Edit keys dropped after a mode...

			Edit the first mode...
			.editKeyboardModeDroppedKeys()
				-> dialog

			Edit a specific mode...
			.editKeyboardModeDroppedKeys(<mode>)
				-> dialog
				-> false
				NOTE: if a mode does not exist this will not create a 
					dialog and will return false.

		Changes made in the editor are applied only when the dialog is 
		closed, so it is possible to cancel any edit within the dialog
		by either pressing Q or the "Cancel edits" button.
		
		This adds several keyboard bindings to the dialog:
			Q		- quit without saving changes.
		`,
		widgets.makeUIDialog(function(mode){
			var that = this

			mode = mode || Object.keys(that.keybindings)[0]

			if(!(mode in that.keybindings)){
				return false
			}

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
								make.dialog.close('cancel')
							}],
						],
					})
				})
				.on('close', function(_, m){
					if(m != 'cancel'){
						that.keybindings[mode].drop = drop
					}
				})
				.run(function(){
					this.abort = function(){
						this.close('cancel') }
					this.keyboard.handler('General', 'Q', 'abort')
				}) })],

	// XXX
	//editActionKeyboardBinding: ['- Interface/',
	//	function(){}],


	/*/ XXX move to gen2
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
	//*/
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
