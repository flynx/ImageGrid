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
function loadMarkedOnlyData(cmp, no_cleanout_marks){
	cmp = cmp == null ? imageDateCmp : cmp
	var cur = DATA.current
	var marked = MARKED.slice().sort(cmp)
	// this will ignore any gid in marks that is not in IMAGES...
	// NOTE: if IMAGES contains only part of the data loadable this will 
	// 		be wrong...
	if(!no_cleanout_marks){
		for(var i=0; i < marked.length;){
			if(marked[i] in IMAGES){
				i++
				continue
			}
			// NOTE: we do not need to advance i here...
			marked.splice(i, 1)
		}
	}
	ALL_DATA = DATA
	DATA = {
		varsion: '2.0',
		current: null,
		ribbons: [
			marked
		],
		//order: marked.slice(),
		order: DATA.order,
	}
	DATA.current = getGIDBefore(cur, 0)
	loadData()
	toggleMarkesView('off')
	return DATA
}


// XXX name this in a better way...
function loadAllImages(){
	DATA = ALL_DATA
	loadData()
	return DATA
}



/**********************************************************************
* Modes
*/

var toggleMarkedOnlyView = createCSSClassToggler('.viewer', 
		'marked-only-view',
		function(action){
			if(action == 'on'){
				loadMarkedOnlyData()
			} else {
				loadAllImages()
			}
		})


// XXX shifting images and unmarking in this mode do not work correctly...
var toggleMarkesView = createCSSClassToggler('.viewer', 'marks-visible',
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

var toggleImageMark = createCSSClassToggler('.current.image', 'marked',
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




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
