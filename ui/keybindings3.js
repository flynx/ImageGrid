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
	// general setup...
	'.viewer': {
		// Navigation...
		// XXX need to cancel the animation of the prev action...
		Left: {
				default: function(){ 
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
				},
				// XXX prevScreenImages...
				ctrl: function(){ 
					prevScreenImages()
				},
				// XXX need to keep shift explicitly clear for editor...
				/*
				shift: function(){
					toggleImageMark()
					prevImage()
				},
				// XXX mark screen images...
				'ctrl+shift': function(){
					console.log('NotImplemented: mark screen images back.')
				}
				*/
			},
		Right: {
				default: function(){ 
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
				},
				// XXX nextScreenImages...
				ctrl: function(){ 
					nextScreenImages()
				},
				// XXX need to keep shift explicitly clear for editor...
				/*
				shift: function(){
					toggleImageMark()
					nextImage()
				},
				// XXX mark screen images...
				'ctrl+shift': function(){
					console.log('NotImplemented: mark screen images forward.')
				}
				*/
			},
		Space: {
				default: 'Right',
				shift: 'Left',
				// screen-oriented movement...
				ctrl: 'Right',
				'ctrl+shift': 'Left',
			},
		/* XXX for some reason this does not work,,,
		// XXX for some odd reason, returning false does not cancel 
		//		default behaviour here...
		Backspace: {
				default: 'Left',
				shift: 'Right',
			},
		*/
		Home: function(){
				firstImage()
			},
		End: function(){
				lastImage()
			},


		// combined navigation and editor actions...
		Up: {
				default: function(){ prevRibbon(DIRECTION) },
				shift: function(){ shiftImageUp(null, DIRECTION) },
			},
		Down: {
				default: function(){ nextRibbon(DIRECTION) },
				shift: function(){ shiftImageDown(null, DIRECTION) },
			},


		// zooming...
		'1': function(){ fitNImages(1) },
		'2': function(){ fitNImages(2) },
		'3': function(){ fitNImages(3) },
		'4': function(){ fitNImages(4) },
		'5': function(){ fitNImages(5) },
		'6': function(){ fitNImages(6) },
		'7': function(){ fitNImages(7) },
		// XXX for some reason this also hooks the Backspace key (80)...
		'8': function(){ fitNImages(8) },
		'9': function(){ fitNImages(9) },
		// XXX bind the +/- keys...


		// XXX this is temporary, combine this with single image mode...
		// XXX this should only work on single image mode...
		F: function(){ toggleImageProportions() },


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
				default: function(){ 
					toggleImageMark()
					if(DIRECTION == 'next'){
						nextImage()
					} else {
						prevImage()
					}
					if($('.current.image').filter(':visible').length == 0){
						centerImage(focusImage(getImageBefore()))
					}
				},
				// same as default but in reverse direction...
				shift: function(){
					toggleImageMark()
					if(DIRECTION == 'prev'){
						nextImage()
					} else {
						prevImage()
					}
					if($('.current.image').filter(':visible').length == 0){
						centerImage(focusImage(getImageBefore()))
					} 
				},
				ctrl: function(){ 
					var action = toggleImageMark() 
					// focus an image instead of the one that just vanished...
					if(action == 'off' && toggleMarkedOnlyView('?') == 'on'){
						if(DIRECTION == 'next'){
							nextImage()
						} else {
							prevImage()
						}
						if($('.current.image').filter(':visible').length == 0){
							centerImage(focusImage(getImageBefore()))
						} 

					}
				},
			},
		I: {
				ctrl: function(){ invertImageMarks() },
			},
		A: {
				shift: function(){ toggleImageMarkBlock() },
				ctrl: function(){ markAll('ribbon') },
			},
		U: {
				ctrl: function(){ removeImageMarks('ribbon') },
				shift: function(){ removeImageMarks('all') },
			},
		F2: function(){ toggleMarkedOnlyView() },
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
