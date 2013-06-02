/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var STEPS_TO_CHANGE_DIRECTION = 2
var _STEPS_LEFT_TO_CHANGE_DIRECTION = STEPS_TO_CHANGE_DIRECTION
// XXX code related to this needs testing...
var DIRECTION = 'next'



/*********************************************************************/

var KEYBOARD_CONFIG = {
	// info overlay...
	//
	// NOTE: this is here to prevent selecting images while trying to 
	// 		select info text...
	'.overlay-info:hover': {
		title: 'Info overlay',
		doc: 'Displayed on bottom of the screen if enabled (toggle with '+
			'<b>I</b>) and/or inline, at bottom of and image when cursor '+
			'is over it (only in ribbon mode, toggle with <b>alt-I</b>)<p>'+

			'<p>NOTE: when the cursor is over the info overlay one can use '+
			'Ctrl-A and Ctrl-D for info text selection, without affecting '+
			'image selection/marks.',

		ignore: [ 'A' ],

		A: {
			// NOTE: this is here only for documentation...
			ctrl: doc('Select all'),
		},
		D: {
			ctrl: doc('Clear selection', 
				function(){
					document.getSelection().empty()
					return false
				})
		}
	},


	// help mode...
	//
	// NOTE: need to keep all info modes before the rest so as to give 
	// 		their bindings priority...
	'.drawer-mode': {
		title: 'Drawer modes',
		doc: 'NOTE: In this mode all other key bindings are disabled, '+
			'except the ones explicitly defined here.',

		ignore: '*',

		Esc: doc('Close drawer',
			function(){ 
				toggleKeyboardHelp('off') 
				return false
			}),
		Q: 'Esc',
		'?': 'Esc',
	},


	// slideshow mode...
	//
	'.slideshow-mode': {
		title: 'Slideshow mode',
		doc: 'To enter this mode press <b>S</b>.',

		// XXX think about what else to disable here...
		ignore: [
			'Up', 'Down', 'Enter', 'R', 'L',
			],

		L: doc('Toggle slideshow looping',
			function(){
				SLIDESHOW_LOOP = SLIDESHOW_LOOP ? false : true
				showStatus('Slideshow: looping', SLIDESHOW_LOOP ? 'enabled...' : 'disabled...')
				return false
			}),
		R: doc('Reverse slideshow direction',
			function(){
				SLIDESHOW_DIRECTION = SLIDESHOW_DIRECTION == 'next' ? 'prev' : 'next'
				showStatus('Slideshow: direction:', SLIDESHOW_DIRECTION + '...')
				return false
			}),
		Esc: doc('Exit/stop slideshow', 
			function(){ 
				toggleSlideShowMode('off') 
				return false
			}),
		S: 'Esc',
		Q: 'Esc',
	},


	// single image mode...
	//
	'.single-image-mode': {
		title: 'Single image mode',
		doc: 'To toggle between this and ribbon modes press <b>Enter</b>.',

		// XXX this should only work on single image mode...
		F: doc('Toggle view proportions', 
			function(){ 
				var mode = toggleImageProportions() 
				showStatus('Fitting image to:', mode + '...')
				centerRibbons()
			}),
		Esc: doc('Exit single image mode', 
				function(){ 
					toggleSingleImageMode('off') 
					return false
				}),
		Q: 'Esc',
	},


	// marked only ribbon mode...
	//
	'.marked-only-view:not(.single-image-mode)': {
		title: 'Marked only view',
		doc: 'To toggle this mode press <b>shift-F2</b>.',

		Esc: doc('Exit marked only view', 
				function(){ 
					toggleMarkedOnlyView('off') 
					return false
				}),
		Q: 'Esc',
	},


	// general setup...
	//
	'.viewer:not(.overlay)': {
		title: 'Global',
		doc: 'These key bindings work in most other modes.',

		// Actions...
		'next-screen': doc('Next screen',
				function(){ 
					event.preventDefault()
					nextScreenImages()
					centerRibbons()
				}),
		'prev-screen': doc('Previous screen',
				function(){ 
					event.preventDefault()
					prevScreenImages()
					centerRibbons()
				}),


		// Basics...
		// XXX STUB: use a real path browser...
		O: doc('Open a directory path',
			function(){
				var path = prompt('Path to open', BASE_URL)
				if(path == null){
					return
				}
				path = path.trim()
				loadDir(path)
			}),


		// Navigation...
		// XXX need to cancel the animation of the prev action...
		Left: {
				default: doc('Previous image',
					function(){ 
						event.preventDefault()
						// update direction...
						if(DIRECTION != 'prev'){
							_STEPS_LEFT_TO_CHANGE_DIRECTION--
							if(_STEPS_LEFT_TO_CHANGE_DIRECTION == 0){
								DIRECTION = 'prev'
								_STEPS_LEFT_TO_CHANGE_DIRECTION = 2
							}
						} else {
								_STEPS_LEFT_TO_CHANGE_DIRECTION = 2
						}
						prevImage() 
						centerRibbons()
					}),
				ctrl: 'prev-screen',
			},
		Right: {
				default: doc('Next image',
					function(){ 
						event.preventDefault()
						// update direction...
						if(DIRECTION != 'next'){
							_STEPS_LEFT_TO_CHANGE_DIRECTION--
							if(_STEPS_LEFT_TO_CHANGE_DIRECTION == 0){
								DIRECTION = 'next'
								_STEPS_LEFT_TO_CHANGE_DIRECTION = 2
							}
						} else {
								_STEPS_LEFT_TO_CHANGE_DIRECTION = 2
						}
						nextImage() 
						centerRibbons()
					}),
				ctrl: 'next-screen',
			},

		Space: {
				default: 'Right',
				shift: 'Left',
				// screen-oriented movement...
				ctrl: 'Right',
				'ctrl+shift': 'prev-screen',
			},
		Backspace: {
				default: 'Left',
				shift: 'Right',
				// screen-oriented movement...
				ctrl: 'Left',
				'ctrl+shift': 'next-screen',
			},
		Home: doc('First image', 
			function(){
				event.preventDefault()
				firstImage()
				centerRibbons()
			}),
		End: doc('Last image',
			function(){
				event.preventDefault()
				lastImage()
				centerRibbons()
			}),


		// combined navigation and editor actions...
		Up: {
				default: doc('Go to ribbon above', 
					function(){ 
						event.preventDefault()
						prevRibbon() 
						centerRibbons()
					}),
				shift: doc('Shift image up',
					function(){ 
						event.preventDefault()
						shiftImageUp(null, DIRECTION) 
						centerRibbons()
					}),
				'ctrl+shift': doc('Shift image up to empty ribbon',
					function(){
						event.preventDefault()
						shiftImageUpNewRibbon(null, DIRECTION) 
						centerRibbons()
					}),
			},
		Down: {
				default: doc('Go to ribbon below', 
					function(){
						event.preventDefault()
						nextRibbon() 
						centerRibbons()
					}),
				shift: doc('Shift image down',
					function(){ 
						event.preventDefault()
						shiftImageDown(null, DIRECTION) 
						centerRibbons()
					}),
				'ctrl+shift': doc('Shift image down to empty ribbon',
					function(){
						event.preventDefault()
						shiftImageDownNewRibbon(null, DIRECTION) 
						centerRibbons()
					}),
			},

		L: doc('Rotate image left', function(){ rotateLeft() }),
		R: {
				default: doc('Rotate image right', 
					function(){ rotateRight() }),
				ctrl: doc('Reverse image order', 
					function(){ reverseImageOrder() }),
			},


		// zooming...
		'#1': doc('Fit one image', function(){ fitNImages(1) }),
		'#2': doc('Fit two images', function(){ fitNImages(2) }),
		'#3': doc('Fit three images', function(){ fitNImages(3) }),
		'#4': doc('Fit four images', function(){ fitNImages(4) }),
		'#5': doc('Fit five images', function(){ fitNImages(5) }),
		'#6': doc('Fit six images', function(){ fitNImages(6) }),
		'#7': doc('Fit seven images', function(){ fitNImages(7) }),
		'#8': doc('Fit eight images', function(){ fitNImages(8) }),
		'#9': doc('Fit nine images', function(){ fitNImages(9) }),

		'-': doc('Zoom in', function(){ zoomOut() }),
		'=': doc('Zoom out', function(){ zoomIn() }),


		Enter: doc('Toggle single image view', 
				function(){ toggleSingleImageMode() }),

		B: doc('Toggle theme', function(){ toggleTheme() }),

		S: {
				default: doc('Start slideshow', 
					function(){ toggleSlideShowMode('on') }),
				ctrl: doc('Save current state', 
					function(){
						event.preventDefault()
						//saveLocalStorage()
						saveLocalStorageData()
						saveLocalStorageMarks()

						saveLocalStorageSettings()

						saveFileState()
					})
			},
		Z: {
				ctrl: doc('Restore to last saved state', 
					function(){
						loadLocalStorage()
						loadLocalStorageMarks()
					})
			},


		// marking...
		// XXX not final, think of a better way to do this...
		// XXX need mark navigation...
		// XXX need marked image shift up/down actions...
		// XXX unmarking an image in marked-only mode results in nothing
		// 		visible focused if we unmark the first or last image in 
		// 		the ribbon...
		M: {
				// NOTE: marking moves in the same direction as the last
				//		move...
				//		i.e. marking can change direction depending on where
				//		we moved last...
				// NOTE: marking does not change move direction...
				default: doc('Mark current image and advance',
					function(){ 
						toggleImageMark()
						if(DIRECTION == 'next'){
							nextImage()
						} else {
							prevImage()
						}
						if(getImage().filter(':visible').length == 0){
							centerView(focusImage(getImageBefore()))
						}
						centerRibbons()
					}),
				// same as default but in reverse direction...
				shift: doc('Mark current image and return',
					function(){
						toggleImageMark()
						if(DIRECTION == 'prev'){
							nextImage()
						} else {
							prevImage()
						}
						if(getImage().filter(':visible').length == 0){
							centerView(focusImage(getImageBefore()))
						} 
						centerRibbons()
					}),
				ctrl: doc('Mark current image',
					function(){ 
						var action = toggleImageMark() 
					}),
			},
		I: {
				// XXX group this with other info stuff into a single on/off toggle...
				default: doc('Toggle image info display',
					function(){ toggleImageInfo() }),
				// XXX STUB -- replace with a real info window...
				shift: doc('Show current image info',
					function(){ toggleImageInfoDrawer() }),
				alt: doc('Toggle inline image info display',
					function(){
						toggleInlineImageInfo()
					}),

				// marking...
				ctrl: doc('Invert image marks', 
					function(){ invertImageMarks() }),
			},
		A: {
			  	// XXX does not yet work with DATA (???)
				//shift: doc('Toggle marks in current contagious block', 
				//	function(){ toggleImageMarkBlock() }),

				ctrl: doc('Mark current ribbon', 
					function(){ markAll('ribbon') }),
				'ctrl+shift': doc('Mark all images', 
					function(){ markAll('all') }),
			},
		D: {
				ctrl: doc('Unmark current ribbon', 
					function(){ removeImageMarks('ribbon') }),
				'ctrl+shift': doc('Unmark all images', 
					function(){ removeImageMarks('all') }),
			},
		U: {
				ctrl: doc('Unmark current ribbon', 
					function(){ removeImageMarks('ribbon') }),
				shift: doc('Unamrk all', 
					function(){ removeImageMarks('all') }),
			},
		F2: {
				default: doc('Toggle mark visibility', 
					function(){ toggleMarkesView() }),
				shift: doc('Toggle marked only images view', 
					function(){
						toggleMarkedOnlyView()
					})
			},

		F4: doc('Open image in external software', openImage),
		E: 'F4',


		'?': doc('Show keyboard bindings',
			function(){ toggleKeyboardHelp() }),

		F1: doc('Show help',
			function(){ toggleHelp() }),
		H: 'F1',

		P: doc('Show options',
			function(){ toggleOptionsUI() }),



		/* testing the shift-key feature...
		'~': {
			default: function(){ alert('~') },
			// this is inaccessible...
			shift: function(){ alert('shift-~') },
			ctrl: function(){ alert('ctrl-~') },
			'ctrl+alt': function(){ alert('ctrl-alt-~') },
		},
		'`': {
			default: function(){ alert('`') },
			// this is also not accessible as it is shadowed by '''...
			shift: function(){ alert('shift-`') },
			ctrl: function(){ alert('ctrl-`') },
			'ctrl+alt': function(){ alert('ctrl-alt-`') },
		},
		*/
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
