/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true



/**********************************************************************
* helpers...
*/

// NOTE: to disable MARKED cleanout set no_cleanout_marks to true.
// NOTE: MARKED may contain both gids that are not loaded and that do 
// 		not exist, as there is no way to distinguish between the two 
// 		situations the cleanup is optional...
function cropMarkedImages(cmp, keep_ribbons, no_cleanout_marks){
	cmp = cmp == null ? imageOrderCmp : cmp
	var cur = DATA.current
	var marked = MARKED.slice().sort(cmp)

	cropDataTo(marked, keep_ribbons, no_cleanout_marks)

	return DATA
}



/**********************************************************************
* Modes
*/

// XXX is this a mode???
var toggleMarkedOnlyView = makeCropModeToggler(
		'marked-only-view',
		cropMarkedImages)


var toggleMarkedOnlyWithRibbonsView = makeCropModeToggler(
		'marked-only-view',
		function(){
			cropMarkedImages(null, true)
		})


// XXX shifting images and unmarking in this mode do not work correctly...
var toggleMarkesView = createCSSClassToggler(
	'.viewer', 
	'marks-visible',
	function(){
		var cur = getImage()
		// current is marked...
		if(cur.hasClass('marked')){
			centerView(null, 'css')
			return
		} 
		// there is a marked image in this ribbon...
		var target = getImageBefore(cur, null)
		if(target.length > 0){
			centerView(focusImage(target), 'css')
			return
		}
		// get marked image from other ribbons...
		prevRibbon()
		if(getImage().hasClass('marked')){
			return
		}
		nextRibbon()
	})



/**********************************************************************
* Actions
*/

var toggleImageMark = createCSSClassToggler(
	'.current.image', 
	'marked',
	function(action){
		toggleMarkesView('on')
		$('.viewer').trigger('togglingMark', [getImage(), action])
	})


// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		var res = ribbon
			.find('.marked')
				.removeClass('marked')
		$('.viewer').trigger('removeingRibbonMarks', [ribbon])

	// remove all marks...
	} else if(mode == 'all'){
		var res = $('.marked')
			.removeClass('marked')
		$('.viewer').trigger('removeingAllMarks')
	} 
	return res
}


function markAll(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		var res = ribbon
			.find('.image:not(.marked)')
				.addClass('marked')
		$('.viewer').trigger('markingRibbon', [ribbon])

	} else if(mode == 'all'){
		var res = $('.image:not(.marked)').addClass('marked')
		$('.viewer').trigger('markingAll')
	}
	return res
}


// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	var ribbon = getRibbon()
	var res = ribbon
		.find('.image')
			.toggleClass('marked')
	$('.viewer').trigger('invertingMarks', [ribbon])
	return res
}


// Toggle marks in the current continuous section of marked or unmarked
// images...
// XXX need to make this dynamic data compatible...
function toggleImageMarkBlock(image){
	if(image == null){
		image = getImage()
	}
	//$('.viewer').trigger('togglingImageBlockMarks', [image])
	// we need to invert this...
	var state = toggleImageMark()
	var _convert = function(){
		if(toggleImageMark(this, '?') == state){
			return false
		}
		toggleImageMark(this, state)
	}
	image.nextAll('.image').each(_convert)
	image.prevAll('.image').each(_convert)
	return state
}


// XXX need to account for empty ribbons...
function shiftMarkedImages(direction, mode, new_ribbon){
	mode = mode == null ? 'ribbon' : mode
	var cur = getRibbonIndex()

	// ribbon only...
	if(mode == 'ribbon'){
		var ribbon = DATA.ribbons[cur]
		// remove all the marked images form current ribbon...
		var marked = $.map(MARKED, function(e){
			var i = ribbon.indexOf(e)
			if(i >= 0){
				ribbon.splice(i, 1)
				return e
			}
			return null
		})

	// shift all marked images...
	} else {
		var marked = MARKED.slice()
		// remove all the marked images form all the ribbons...
		$.each(DATA.ribbons, function(ribbon){
			$.each(marked, function(e){
				var i = ribbon.indexOf(e)
				i >= 0 ? ribbon.splice(i, 1) : null
			})
		})
	}

	// if we are at the top or bottom ribbons we need to create a new 
	// ribbon regardless...
	if((cur == 0 && direction == 'prev') 
			|| (cur == DATA.ribbons.length-1 && direction == 'next')){
		new_ribbon = true
	}

	// add marked to new ribbon...
	if(new_ribbon){
		cur += direction == 'next' ? 1 : 0
		DATA.ribbons.splice(cur, 0, marked)
	
	// add marked to existing ribbon...
	} else {
		cur += direction == 'next' ? 1 : -1
		DATA.ribbons[cur] = DATA.ribbons[cur].concat(marked).sort(cmp)
	}
	
	// remove empty ribbons...
	DATA.ribbons = DATA.ribbons.filter(function(e){ return e.length > 0 ? true : false })

	updateRibbonOrder()
}
function shiftMarkedImagesUp(mode, new_ribbon){
	return shiftMarkedImages('prev', mode, new_ribbon)
}
function shiftMarkedImagesDown(mode, new_ribbon){
	return shiftMarkedImages('next', mode, new_ribbon)
}


// XXX these are ribbon wise only (???)
// XXX this on first step this must pack all marked images
function horizontalShiftMarkedImages(direction){
	// XXX
}
function shiftMarkedImagesLeft(){
	return shiftMarkedImages('prev')
}
function shiftMarkedImagesRight(){
	return shiftMarkedImages('next')
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
