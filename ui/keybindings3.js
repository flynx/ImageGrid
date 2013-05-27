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
	// single image mode only...
	'.single-image-mode': {
		title: 'Single image mode',

		// XXX this should only work on single image mode...
		F: doc('Toggle view proportions', 
			function(){ 
				toggleImageProportions() 
				centerRibbons()
			}),
		Esc: doc('Exit single image mode', 
				function(){ toggleSingleImageMode('off') }),
		Q: 'Esc',
	},

	// single image mode only...
	'.marked-only-view:not(.single-image-mode)': {
		title: 'Marked only view',

		Esc: doc('Exit marked only view', 
				function(){ toggleMarkedOnlyView('off') })
	},


	// help mode...
	'.help-mode': {
		title: 'Help',
		doc: 'NOTE: In this mode all other key bindings are disabled, except '+
			'the ones explicitly defined here.',
		ignore: '*',

		Esc: doc('Close help',
			function(){ toggleKeyboardHelp('off') }),
		H: 'Esc',
		Q: 'Esc',
		// '?'
		'/': { 
				shift: 'Esc', 
			},
	},


	// general setup...
	'.viewer:not(.overlay)': {
		title: 'Global',

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
				ctrl: doc('Previous screen',
					function(){ 
						event.preventDefault()
						prevScreenImages()
						centerRibbons()
					}),
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
				ctrl: doc('Previous screen',
					function(){ 
						event.preventDefault()
						nextScreenImages()
						centerRibbons()
					}),
			},
		Space: {
				default: 'Right',
				shift: 'Left',
				// screen-oriented movement...
				ctrl: 'Right',
				'ctrl+shift': 'Left',
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
		R: doc('Rotate image right', function(){ rotateRight() }),


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
						if($('.current.image').filter(':visible').length == 0){
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
						if($('.current.image').filter(':visible').length == 0){
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
				// XXX STUB -- replace with a real info window...
				default: doc('Show current image info',
					function(){
						var gid = getImageGID($('.current.image'))
						var r = getRibbonIndex(getRibbon())
						var data = IMAGES[gid]
						var orientation = data.orientation
						orientation = orientation == null ? 0 : orientation
						var order = DATA.order.indexOf(gid)
						var name = data.path.split('/').pop()
						alert('"'+ name +'"\n'+
								'Orientation: '+ orientation +'deg\n'+
								'GID: '+ gid +'\n'+
								'Path: "'+ data.path +'"\n'+
								'Order: '+ order +'\n'+
								'Position (ribbon): '+ DATA.ribbons[r].indexOf(gid) +
									'/'+ DATA.ribbons[r].length +'\n'+
								'Position (global): '+ order +'/'+ DATA.order.length +'\n'+
								'')
					}),
				ctrl: doc('Invert image marks', 
					function(){ invertImageMarks() }),
			},
		A: {
				shift: doc('Toggle marks in current contagious block', 
					function(){ toggleImageMarkBlock() }),
				ctrl: doc('Mark current ribbon', 
					function(){ markAll('ribbon') }),
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

		H: doc('Show keyboard bindings',
			function(){ toggleKeyboardHelp() }),
		// '?'
		'/': { 
				shift: 'H', 
			},
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
