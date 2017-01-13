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
module.GLOBAL_KEYBOARD2 = {
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
	'Cropped': {
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

		alt_X: 'close',
		alt_F4: 'close',
		meta_Q: 'close',

		// XXX
		F5: keyboard.doc('Reload viewer (full)', 
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
		meta_alt_I: 'F12',
		ctrl_shift_p: 'F12',


		// dialogs...
		// XXX should this be all here or in respective sections???
		alt_A: 'browseActions',

		//alt_S: 'browseActions: "/Sort/"',
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
		alt_H: 'browseActions: "/History/" -- Open history menu',


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

		shift_R: 'setBaseRibbon',


		// editing...
		R: 'rotateCW',
		L: 'rotateCCW',
		H: 'flipHorizontal',
		V: 'flipVertical',


		// ribbon image stuff...
		alt_I: 'browseActions: "/Image/" -- Show image menu',
		alt_R: 'browseActions: "/Ribbon/" -- Open ribbon menu',


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
		C: 'browseActions: "/Crop/" -- Show crop menu',


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
		alt_M: 'browseActions: "/Mark/" -- Show mark menu',


		// bookmarking...
		B: 'toggleBookmark',
		'[': 'prevBookmarked',
		']': 'nextBookmarked',
		alt_B: 'browseActions: "/Bookmark/" -- Show bookmark menu',



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

		// If 'on' enable .keyPressed(..) action calling on keyboard 
		// activity...
		//
		// NOTE: if updated the keyboard handler will need to be restarted
		// 		for changes to take effect.
		// XXX EXPERIMENTAL
		'keyboard-key-pressed-action': 'off',
	},

	get keybindings(){
		return this.__keyboard_config },
	get keyboard(){
		return this.__keyboard_object },


	// Self-test action...
	testKeyboardDoc: ['- Interface/',
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

	// Get normalized, flat set of actions and keys that trigger them...
	//
	// Format:
	// 	{
	// 		<action>: [
	// 			<key>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	// NOTE: this does not check overloading between modes i.e. if two
	// 		actions in two different modes are bound to the same key 
	// 		only one is shown...
	// 		XXX is this a bug???
	// 			...at this point can't find when this produces inconsistencies...
	getKeysForAction: ['- Interface/',
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

			// pass keys pressed to .keyPressed(..) action...
			// XXX EXPERIMENTAL...
			var keyPressdCall = function(handler){
				return that.config['keyboard-key-pressed-action'] == 'on' ?
					function(evt){
						var e = that.keyPressed.pre(
							that, 
							[evt, keyboard.joinKey(keyboard.event2key(evt))])

						var res = handler.apply(that, arguments)
						e.result = res

						that.keyPressed.post(that, e)
						return res
					}
					: handler
			}

			var kb = this.__keyboard_object = 
				this.__keyboard_object 
					|| keyboard.KeyboardWithCSSModes(
						function(){ return that.__keyboard_config },
						function(){ return that.ribbons.viewer })

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
						// XXX EXPERIMENTAL...
						keyPressdCall(
							keyboard.makeKeyboardHandler(
								this.keyboard,
								function(k){ window.DEBUG && console.log('KEY:', k) }, 
								this)),
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

	// Drop keys until non are pressed for a timeout...
	//
	// This is useful for stopping repeating (held down) keys after some
	// event.
	pauseKeyboardRepeat: ['- Interface/',
		function(){ this.__keyboard_repeat_paused = true }],

	// Keyboard activity event...
	//
	// This is triggered when a key passes to .keyboard. The .pre stage
	// is run before the key is handled, .post is run just after.
	//
	// Option .config['keyboard-key-pressed-action'] controls if this is
	// called, when false the functionality is disabled.
	//
	// Care must be taken when using binding to this (especially the 
	// .pre stage) as this may introduce a lag into user input.
	//
	// NOTE: updates to .config['keyboard-key-pressed-action'] will take
	// 		effect after handler restart via .toggleKeyboardHandling('!') 
	// 		or cycling it off and back on...
	// NOTE: his is called by the handler created in .toggleKeyboardHandling(..)
	//
	// XXX EXPERIMENTAL: event for actions to be able to handle keys...
	// 		...not working yet...
	// XXX not sure if we need this...
	// 		...the main reason being that this may be a way to bypass the
	// 		.keyboard handler and config and handle keys within an action
	// 		if overdone this can be a mess...
	keyPressed: ['- Interface/Key pressed event',
		'This is called by the keyboard handler when a key is pressed, '
			+'the actual event and key are passed as argument.',
		core.notUserCallable(function(evt, key){
			// This is the keyboard hook protocol root function
			//
			// Not for direct use.
		})],
	toggleKeyPressedHandling: ['Interface/keyPressed event',
		core.makeConfigToggler('keyboard-key-pressed-action',
			['off', 'on'],
			function(){ this.toggleKeyboardHandling('!') })],


	// Interface stuff ------------------------------------------------

	// XXX BUG sections with doc do not show up in title...
	// XXX sub-group by path (???)
	// XXX place this in /Doc/.. (???)
	browseKeyboardBindings: ['Interface|Help/Keyboard bindings...',
		widgets.makeUIDialog(function(path, edit, get_text){
			var actions = this
			var keybindings = this.keybindings
			var kb = this.keyboard

			var keys = kb.keys('*')

			// get doc...
			get_text = get_text === undefined && !edit ? 
				function(action){
					var doc = action.doc ? action.doc
						: action.action in this ? this.getDocTitle(action.action)
						: action.action 
					return doc.length == 0 ? action.action : doc
				}
				: get_text

			var dialog = browse.makeLister(null, 
				function(path, make){
					Object.keys(keybindings)
						.forEach(function(mode){
							var dropped = keybindings[mode].drop || []
							var bound_ignored = []
							var buttons = edit ? 
								[
									// XXX up
									['&#9206;', function(){}],
									// XXX down
									['&#9207;', function(){}],
								].concat(dialog.options.itemButtons)
								: undefined

							// section heading...
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
										buttons: buttons,
									})
								.attr('mode', mode)
								.addClass('mode')

							// bindings...
							var c = 0
							Object.keys(keys[mode] || {}).forEach(function(action){

								var o = keyboard.parseActionCall(action)

								if(get_text){
									var doc = ''
									var text = get_text.call(actions, o)

								} else {
									var doc = o.doc
									var text = o.action 
										+ (o.no_default ? '!' : '') 
										+ (o.arguments.length > 0 ? 
											(': '+ o.arguments.map(JSON.stringify).join(' '))
											: '')
								}
								var hidden = !edit 
									&& !(o.action in actions) 
									&& !(kb.handler(mode, keys[mode][action][0])
										instanceof Function)

								// NOTE: wee need the button spec to be
								// 		searchable, thus we are not using 
								// 		the keys attr as in .browseActions(..)
								make([text, ' ', '$BUTTONS']
										.concat($('<span>')
											.addClass('text')
											.html(keys[mode][action]
												// mark key if it is in dropped...
												.map(function(s){ 
													s = s.split('+')
													var k = s.pop() 
													var i = dropped.indexOf(k)
													i >= 0 
														&& bound_ignored
															.push(dropped[i])
													s.push(k 
														+ (i >= 0 ?  '<sup>*</sup>' : ''))
													return s.join('+') })
												.join(' / '))),
									{
										// hide stuff that is not an action...
										hidden: hidden,	
										disabled: hidden,	
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
									dropped
										.filter(function(k){ 
											return bound_ignored.indexOf(k) == -1 })
										.join(' / ')])
								.addClass('drop-list')
								.attr('mode', mode)

							// controls...
							if(edit){
								var elem = make('new', {
									buttons: [
										// XXX
										['key', 
											function(){
												//elem.before( XXX )
												actions.editKeyBinding(mode)
												// XXX update when done???
											}],
										// XXX
										['mode', 
											function(){
												//elem.after( XXX )
												// XXX need to pass order info...
												actions.editKeyboardMode()
												// XXX update when done???
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
							// 		...do we actually need this as a button????
							['&ctdot;', function(_, cur){
								// key...
								if(cur.hasClass('key')){
									actions.editKeyBinding(cur.attr('mode'), cur.attr('code'))

								// mode...
								} else if(cur.hasClass('mode')){
									actions.editKeyboardMode(cur.attr('mode'))
								}
							}],
							//*/
							//['edit', function(){}],
							//['&#128393;', function(){}],
						]
						: [],
				})

			return dialog
		})],
	// XXX BUG: for some reason modes are unclickable...
	editKeyboardBindings: ['Interface/Keyboard bindings editor...',
		widgets.uiDialog(function(path){ 
			var that = this
			var dialog = this.browseKeyboardBindings(path, true)
				// XXX should this be only a button thing (done in .browseKeyboardBindings(..))
				// 		or also the main action???
	   			.open(function(){
					var cur = dialog.select('!')

					// key...
					if(cur.hasClass('key')){
						that.editKeyBinding(cur.attr('mode'), cur.attr('code'))

					// mode...
					// XXX BUG: for some reason modes are unclickable...
					} else if(cur.hasClass('mode')){
						that.editKeyboardMode(cur.attr('mode'))

					} else if(cur.hasClass('drop-list')){
						that.editKeyboardModeDroppedKeys(cur.attr('mode'))
					}
				}) 
			return dialog
		})],

	// XXX key editor:
	// 		[ mode ]
	// 		[  action (text with dataset)  ] [  args (text field)  ] no default: [_]
	//		---
	//		<list of keys>
	//		new key
	// XXX
	editKeyBinding: ['- Interface/Key binding editor...',
		widgets.makeUIDialog(function(mode, code){
			var that = this
			// XXX
			var dialog = browse.makeLister(null, 
				function(path, make){
					// XXX make editable...
					make(['Mode:', mode || ''])
					// XXX make editable...
					make(['Code:', code || ''])

					make('---')

					// list the keys...
					var keys = that.keyboard.keys(code)
					keys = mode in keys ? 
						keys[mode][code]
						: [] 

					keys
						.forEach(function(key){
							// XXX make editable...
							make(key, { buttons: [
								['&times;', function(){}],
							], })
						})

					make('New key')
						// XXX stub...
						.css({ fontStyle: 'italic' })

					make('---')
					
					make('', { buttons: [
						['Delete mapping', function(){}],
					], })
				})

			return dialog
		})],
	// XXX
	editKeyboardMode: ['- Interface/keyboard mode editor...',
		widgets.makeUIDialog(function(mode){
			var that = this
			var dialog = browse.makeLister(null, 
				function(path, make){
					make(['Mode:', mode || ''])
					make(['Doc:', that.keybindings[mode].doc || ''])
					make(['Pattern:', that.keybindings[mode].pattern || mode])

					make('---')

					make('', { buttons: [
						['Delete mode', function(){}],
					], })
				})

			return dialog
		})],
	// XXX
	editKeyboardModeDroppedKeys: ['- Interface/keyboard mode dropped key editor...',
		widgets.makeUIDialog(function(mode){
			var that = this

			var dialog = browse.makeLister(null, 
				function(path, make){
					make(['Mode:', mode || ''])

					make('---')

					var drop = that.keybindings[mode].drop || []
					drop = drop == '*' ? [drop] : drop

					drop
						.forEach(function(key){
							// XXX make editable...
							make(key, { buttons: [
								['&times;', function(){}],
							], })
						})

					make('New key')
						// XXX stub...
						.css({ fontStyle: 'italic' })

					make('---')

					make('', { buttons: [
						['Clear dropped keys', function(){}],
					], })
				})

			return dialog
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

var Keyboard = 
module.Keyboard = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'keyboard',
	depends: [
		'ui'
	],
	suggested: [
		'self-test',
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

		['keyHandler',
			function(res, mode, key, action){
				action && this.checkKeyboardDoc() }],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
