/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var _STEPS_LEFT_TO_CHANGE_DIRECTION = CONFIG.steps_to_change_direction
var DIRECTION = 'next'

var ACTIONS = {}


/*********************************************************************/

function updateDirection(direction){
	if(DIRECTION != direction){
		_STEPS_LEFT_TO_CHANGE_DIRECTION--
		if(_STEPS_LEFT_TO_CHANGE_DIRECTION == 0){
			DIRECTION = direction
			_STEPS_LEFT_TO_CHANGE_DIRECTION = CONFIG.steps_to_change_direction
		}
	} else {
			_STEPS_LEFT_TO_CHANGE_DIRECTION = CONFIG.steps_to_change_direction
	}
}


function directionImage(reverse){
	if(DIRECTION == (reverse ? 'prev' : 'next')){
		nextImage()
	} else {
		prevImage()
	}
}


// XXX this is experimental...
// 		...not sure yet how to go about this...
function Action(text, func){
	var not_action = func === false ? true : false
	func = !func ? function(){return true}: func
	func.doc = text

	var name = text.split('\n')[0].trim()

	if(name in ACTIONS){
		console.warn('Action: "'+name+'" is defined more than once.')
	}

	if(!not_action){
		ACTIONS[name] = func
	}

	return func
}


var _doc = doc
var doc = Action



/*********************************************************************/

var KEYBOARD_CONFIG = {
	'Global bindings': {
		doc: 'NOTE: binding priority is the same as the order of sections '+
			'on this page.',
		pattern: '*',

		F4: {
			alt: doc('Close viewer', 
				function(){ 
					closeWindow() 
					return false
				}),
		},
		F5: doc('Full reload viewer', 
			function(){ 
				killAllWorkers()
					.done(function(){
						reload() 
					})
				return false
			}),
		F12: doc('Show devTools', 
			function(){ 
				showDevTools() 
				return false
			}),
		// NOTE: these are for systems where F** keys are not available 
		// 		or do other stuff...
		R: {
			'ctrl+alt': doc('Reload viewer', 
				function(){ 
					reloadViewer() 
					return false
				}),
			'ctrl+shift': 'F5',
		},
		P: {
			'ctrl+shift': 'F12',
		},

		// NOTE: this is handled by the wrapper at this point, so we do 
		// 		not have to do anything here...
		F11: doc('Toggle full screen view', function(){ 
				toggleFullscreenMode() 
				return false
			}),
		Enter: {
			alt: 'F11'
		},
		F: {
			ctrl: 'F11',
		},

	},

	// NOTE: this is here to prevent selecting images while trying to 
	// 		select info text...
	'Info overlay': {
		doc: 'Displayed on bottom of the screen if enabled (toggle with '+
			'<b>I</b>) and/or inline, at bottom of an image when cursor '+
			'is over it (only in ribbon view, toggle with <b>alt-I</b>)'+

			'<p>NOTE: when the cursor is over the info overlay one can use '+
			'Ctrl-A and Ctrl-D for info text selection, without affecting '+
			'image selection/marks.',
		pattern: '.overlay-info:hover',

		ignore: [ 'A', 'C', 'D' ],

		// NOTE: these are here only for documentation...
		A: {
			ctrl: doc('Select all', false),
		},
		C: {
			ctrl: doc('Copy selection', false)
		},

		D: {
			ctrl: doc('Clear selection', 
				function(){
					console.log('!!!')
					document.getSelection().empty()
				})
		}
	},


	// NOTE: editor effects are not documented, but should be obvious...
	// 		XXX is this the case?
	'Dialog': {
		doc: 'NOTE: to <i>close</i> a dialog, in addition to the keyaboard '+
			'shortcuts, one can also click anywhere outside the dialog.',
		pattern: '.viewer.overlay .overlay-block.dialog, '
			+'.panel :focus',

		ignore: '*',

		'insert-return': doc('Insert return', false),

		Enter: {
				default: doc('Accept dialog',
					function(){
						var f = $(':focus')

						// trigger the default button/summary action...
						// NOTE: for some reason checkboxes in dialogs do not work (not a biggie)...
						if(f.length > 0 
								&& (/button|summary/i.test(f[0].tagName) 
									|| /button|checkbox/i.test(f.attr('type')))){
							f.click()
							// prevent the key from propagating to the viewer...
							return false

						// accept the input -- e.g. remove focus from it...
						} else if(toggleEditor('?') == 'on'){
							f.blur()
							// prevent the key from propagating to the viewer...
							return false

						// accept the dialog...
						} else if(isOverlayVisible('.viewer')) {
							getOverlay($('.viewer')).trigger('accept')
							hideOverlay($('.viewer')) 
						}
					}),
				shift: 'insert-return',
				//ctrl: 'insert-return',
			},
		Esc: doc('Close dialog', 
			function(){ 
				// hide the overlay...
				if(isOverlayVisible('.viewer')){
					//getOverlay($('.viewer')).trigger('close')
					hideOverlay($('.viewer')) 
					return false

				// blur focused element, if nothing focused close...
				} else if(toggleEditor('?') == 'on'){
					$(':focus').blur()
					return false
				}
			}),
	},


	// NOTE: need to keep all info modes before the rest so as to give 
	// 		their bindings priority...
	'Drawer views': {
		doc: 'NOTE: In this view all other key bindings are disabled, '+
			'except app defaults and the ones explicitly defined here.',
		pattern: '.drawer-mode',

		ignore: '*',

		Esc: doc('Close drawer',
			function(){ 
				toggleKeyboardHelp('off') 
				return false
			}),
		Q: 'Esc',
	},


	'Slideshow view': {
		doc: 'To enter this view press <b>S</b>.',
		pattern: '.slideshow-mode',

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


	'Single image view': {
		doc: 'To toggle between this and ribbon view press <b>Enter</b>.',
		pattern: '.single-image-mode',

		Esc: doc('Exit single image view', 
				function(){ 
					toggleSingleImageMode('off') 
					return false
				}),
		Q: 'Esc',
	},


	'Cropped ribbon views': {
		doc: 'To crop marked images press <b>shift-F2</b> for '+
			'single ribbon crop view press <b>F3</b> and to open the crop '+
			'dialog for more options press <b>C</b>.'+
			'<p>NOTE: toggling crop views is only possible from ribbon view.',
		pattern: '.cropped-view:not(.single-image-mode)',

		Esc: {
				default: doc('Uncrop to last state', 
					function(){ 
						uncropData()
						return false
					}),
				shift: doc('Exit crop view', 
					function(){ 
						toggleMarkedOnlyView('off') 
						toggleSingleRibbonMode('off') 
						return false
					}),
			},
		Q: 'Esc',
	},


	// visible marks...
	//
	/* XXX does this work???
	 * 		...appears to be overtaken by every Esc definition before,
	 * 		and every single one of them returns false...
	'.marks-visible': {
		title: 'Visible marks',

		Esc: doc('Hide marks', 
				function(){ 
					toggleMarksView('off')
					return false
				}),
	},
	*/


	// NOTE: these bindings apply ONLY to ribbon view...
	// XXX this breaks getKeyHandlers(...) when modes argument is given...
	'Ribbon view': {
		pattern: '.viewer:not(.overlay):not(.single-image-mode)',
		ignore: [ '#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#0' ],

		Left: {
				// XXX revise...
				alt: doc('Shift image left', 
					function(){ 
						event.preventDefault()
						shiftImageLeft() 
						centerView(null, 'css')
						// XXX for some odd reason centerRibbons does 
						// 		something really odd here -- images get to
						// 		correct positions but the align is totally 
						// 		wrong...
						// 		...race condition???
						//centerRibbons()
						// XXX HACK...
						if(window._center_ribbon_delay != null){
							clearTimeout(_center_ribbon_delay)
						}
						_center_ribbon_delay = setTimeout(
							function(){ 
								centerRibbons() 
							}, 300)

						return false
					}),
				ctrl: 'prev-screen',
			},
		Right: {
				// XXX revise...
				alt: doc('Shift image right', 
					function(){ 
						event.preventDefault()
						shiftImageRight() 
						centerView(null, 'css')
						// XXX for some odd reason centerRibbons does 
						// 		something really odd here -- images get to
						// 		correct positions but the align is totally 
						// 		wrong...
						// 		...race condition???
						//centerRibbons()
						// XXX HACK...
						if(window._center_ribbon_delay != null){
							clearTimeout(_center_ribbon_delay)
						}
						_center_ribbon_delay = setTimeout(
							function(){ 
								centerRibbons() 
							}, 300)

						return false
					}),
				ctrl: 'next-screen',
			},
		PgUp: 'next-screen',
		PgDown: 'prev-screen',
		'prev-screen': doc('Previous screen',
				function(){ 
					event.preventDefault()
					prevScreenImages()
					centerRibbons()
				}),
		'next-screen': doc('Next screen',
				function(){ 
					event.preventDefault()
					nextScreenImages()
					centerRibbons()
				}),
		Space: {
				// screen-oriented movement...
				ctrl: 'Right',
				'ctrl+shift': 'prev-screen',
			},
		Backspace: {
				// screen-oriented movement...
				ctrl: 'Left',
				'ctrl+shift': 'next-screen',
			},

		// align to base ribbon...
		// XXX base ribbon concept is not yet fully defined...
		Down: {
				'ctrl+alt': doc('Align sorted section to current ribbon (EXPERIMENTAL)',
					function(){
						alignRibbons()
					}),
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
		'#0': doc('Fit maximum images', function(){ fitNImages(getScreenWidthInImages(CONFIG.min_image_size)) }),

		// cropping...
		C: doc('Show ribbon crop dialog', cropImagesDialog),
		F: doc('Filter images', filterImagesDialog),

		// XXX add a non FXX key for macs...
		F2: {
				shift: doc('Crop marked only images', 
					function(){
						toggleMarkedOnlyView('on')
						// prevent the default from the main mode from 
						// getting called...
						return false
					}),
			},

		// XXX add a non FXX key for macs...
		F3: doc('Crop single ribbon', 
			function(){
				event.preventDefault()
				toggleSingleRibbonMode('on')
			}),
	},


	// general bindings...
	//
	'Viewer': {
		doc: 'These key bindings work in most other viewer views.'+

			'<p>NOTE: shifting all marked images from different ribbons will '+
			'perform the operations on ALL marked images but relative '+
			'the the current ribbon. i.e. some images might get promoted, '+
			'others demoted while some will not change position. ',
		pattern: '.viewer:not(.overlay)',

		// Basics...
		// XXX STUB: use a real path browser...
		O: doc('Open a directory path',
			function(){
				loadDirectoryDialog()
			}),


		// Navigation...
		// XXX need to cancel the animation of the prev action...
		Left: {
				default: doc('Previous image',
					function(){ 
						event.preventDefault()
						// update direction...
						updateDirection('prev')
						prevImage() 
						centerRibbons()
					}),

				// XXX button not final...
				'ctrl+shift': doc('Previous URL in history', loadURLHistoryPrev ),
			},
		Right: {
				default: doc('Next image',
					function(){ 
						event.preventDefault()
						// update direction...
						updateDirection('next')
						nextImage() 
						centerRibbons()
					}),

				// XXX button not final...
				'ctrl+shift': doc('Next URL in history', loadURLHistoryNext ),
			},
		Space: {
				default: 'Right',
				shift: 'Left',
			},
		Backspace: {
				default: 'Left',
				shift: 'Right',
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

		// bookmark navigation...
		'[': doc('Previous bookmarked image', 
				function(){ prevBookmark() }),
		']': doc('Next bookmarked image', 
				function(){ nextBookmark() }),

		// marked/unmarked navigation...
		',': {
				default: doc('Previous marked image', 
					function(){ prevMark() }),
				shift: doc('Previous unmarked image',
					function(){ prevUnmarked() }),
			},
		'.': {
				default: doc('Next marked image', 
					function(){ nextMark() }),
				shift: doc('Next unmarked image',
					function(){ nextUnmarked() }),
			},

		// sorted section navigation...
		'{': doc('Previous unsorted section edge', 
				function(){ prevUnsortedSection() }),
		'}': doc('Next unsorted section edge', 
				function(){ nextUnsortedSection() }),


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
				'ctrl+shift': doc('Shift image up to new ribbon',
					function(){
						event.preventDefault()
						shiftImageUpNewRibbon(null, DIRECTION) 
						centerRibbons()
					}),
				alt: doc('Shift marked images up',
					function(){
						toggleMarksView('on')
						shiftMarkedImagesUp()
					}),
				'alt+shift': doc('Shift marked images up to new ribbon',
					function(){
						// XXX
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
				'ctrl+shift': doc('Shift image down to new ribbon',
					function(){
						event.preventDefault()
						shiftImageDownNewRibbon(null, DIRECTION) 
						centerRibbons()
					}),
				alt: doc('Shift marked images down',
					function(){
						toggleMarksView('on')
						shiftMarkedImagesDown()
					}),
				'alt+shift': doc('Shift marked images down to new ribbon',
					function(){
						// XXX
					}),
			},

		L: doc('Rotate image left', function(){ rotateLeft() }),
		R: {
				default: doc('Rotate image right', 
					function(){ rotateRight() }),
				ctrl: doc('Reverse image order', 
					function(){ 
						event.preventDefault()
						reverseImageOrder() 
					}),
			},
		H: {
			   default: doc('Flip image horizontally', 
					function(){ 
						var o = getImage().attr('orientation')
						// need to rotate relative to user, not relative to image...
						if(o == 90 || o == 270){
						   flipVertical() 
						} else {
							flipHorizontal() 
						}
					}),
				ctrl: doc('Show recently opend urls',
					function(){
						recentlyOpenedDialog()
					}),
		   },
		V: doc('Flip image vertically', 
				function(){ 
					var o = getImage().attr('orientation')
					// need to rotate relative to user, not relative to image...
					if(o == 90 || o == 270){
						flipHorizontal() 
					} else {
						flipVertical() 
					}
				}),


		// zooming...
		'#1': doc('Fit image to screen', function(){ fitNImages(1) }),
		'#2': doc('Show big image', 
				function(){ 
					fitNImages(CONFIG.single_image_view_scale_2) 
				}),
		'#3': doc('Show small image', 
				function(){ 
					fitNImages(CONFIG.single_image_view_scale_3) 
				}),

		'-': doc('Zoom in', function(){ zoomOut() }),
		'=': doc('Zoom out', function(){ zoomIn() }),


		Enter: doc('Toggle single image view', 
				function(){ toggleSingleImageMode() }),
		B: {
				default: doc('Toggle theme', 
					function(){ toggleTheme() }),
				ctrl: doc('Toggle bookmark', 
					function(){ toggleBookmark() }),
				'ctrl+shift': doc('Remove all bookmarks',
					function(){ removeAllBookmarks() }),
			},

		S: {
				default: doc('Start slideshow', 
					function(){ toggleSlideShowMode('on') }),
				shift: doc('Sort images',
					function(){
						sortImagesDialog()
					}),
				ctrl: doc('Save current state', 
					function(){
						event.preventDefault()

						showStatusQ('Saving: localStorage: Settings.')
						saveLocalStorageSettings()

						saveFileState()

						showStatusQ('Saving: Done.')
					}),
				'ctrl+shift': doc('Export',
					function(){
						exportPreviewsDialog()
					}), 
				// NOTE: this will not delete anything, just merge all the diffs 
				// 		into a single, redundent images.json.
				// 		this will make loading faster...
				'ctrl+alt': doc('Compact image data.',
					function(){
						showStatusQ('Merging: images diffs.')
						saveFileImages()
					}),
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
				// XXX  should this toggle or set mark to on?
				default: doc('Mark current image and advance',
					function(){ 
						toggleMark('on')
						directionImage()
						// XXX do we need this???
						//if(getImage().filter(':visible').length == 0){
						//	centerView(focusImage(getImageBefore()))
						//}
						centerRibbons()
					}),
				// same as default but in reverse direction...
				shift: doc('Mark current image and return',
					function(){
						toggleMark('on')
						directionImage(true)
						// XXX do we need this???
						//if(getImage().filter(':visible').length == 0){
						//	centerView(focusImage(getImageBefore()))
						//} 
						centerRibbons()
					}),
				ctrl: doc('Show mark dialog', function(){ markImagesDialog() }),
			},
		Ins: doc('Toggle mark on current image', function(){ toggleMark() }),
		'invert-marks': doc('Invert image marks', 
			function(){ invertImageMarks() }),
		A: {
			  	// XXX does not yet work with DATA (???)
				//shift: doc('Toggle marks in current contagious block', 
				//	function(){ toggleMarkBlock() }),

				ctrl: doc('Mark current ribbon', 
					function(){ 
						toggleMarksView('on')
						markAll('ribbon') 
					}),
				'ctrl+shift': doc('Mark all images', 
					function(){ 
						toggleMarksView('on')
						markAll('all') 
					}),
			},

		'unmark-ribbon': doc('Unmark current ribbon', 
				function(){ 
					event.preventDefault()
					unmarkAll('ribbon') 
				}),
		'unmark-all': doc('Unmark all images', 
				function(){ unmarkAll('all') }),

		D: {
				ctrl: 'unmark-ribbon',
				'ctrl+shift': 'unmark-all', 
		
			},
		U: {
				default: doc('Unmark current image',
					function(){ toggleMark('off') }), 
				ctrl: 'unmark-ribbon',
				shift: 'unmark-all',
			},


		// XXX add a non FXX key for macs...
		F2: doc('Toggle mark visibility', 
				function(){ toggleMarksView() }),
		// XXX should we be able to toggle crop modes from single image mode???
		// 		...if yes, then remove the F2 & F3 definitions form ribbon
		// 		mode...
		// 		one way to go is to exit single-image-mode on s-f2 or f3...
		/*
		F2: {
				default: doc('Toggle mark visibility', 
					function(){ toggleMarksView() }),
				shift: doc('Crop marked only images', 
					function(){
						toggleMarkedOnlyView('on')
					}),
			},

		F3: doc('Crop single ribbon', 
			function(){
				event.preventDefault()
				toggleSingleRibbonMode('on')
			}),
		*/

		E: {
				default: doc('Open image in external software', openImage),
				// XXX Experimental
				ctrl: doc('Open preview editor panel (Experimental)', 
					function(){ toggleEditor() }),
			},
		// XXX make F4 a default editor and E a default viewer...
		F4: 'E',

		// info...
		I: {
				default: doc('Show current image info',
					function(){ 
						showImageInfo()
						//toggleImageInfoDrawer() 
					}),
				shift: doc('Toggle image info display',
					function(){ toggleImageInfo() }),
				alt: doc('Toggle inline image info display',
					function(){
						toggleInlineImageInfo()
					}),

				// marking...
				ctrl: 'invert-marks',
			},
		P: {
				default: doc('Show panel list',
					function(){ 
						panelListDialog()
					}),
				shift: doc('Show options',
					function(){ 
						toggleOptionsUI() 
					}),
				ctrl: doc('Print keyboard help',
					function(){
						toggleKeyboardHelp('on')
						// NOTE: on chrome this is blocking...
						print()
						toggleKeyboardHelp('off')
					}),
			},

		// Help and info...
		'?': doc('Show keyboard bindings',
			function(){ toggleKeyboardHelp() }),

		// XXX add a non FXX key for macs...
		F1: doc('Show help',
			function(){ toggleHelp() }),


		// XXX DEBUG MODE...
		// 		...remove these in production...
		//F12: doc('Show devTools', function(){ showDevTools() }),
		//F5: doc('Reload app', function(){ reload() }),

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
	},

	'.image': {
		'#1': doc('mooo!')
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
