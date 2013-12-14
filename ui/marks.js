/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var MARKED_FILE_DEFAULT = 'marked.json'
var MARKED_FILE_PATTERN = /^[0-9]*-marked.json$/



/**********************************************************************
* helpers...
*/

function _addMark(cls, gid, image){
	gid = gid == null ? getImageGID() : gid
	image = image == null ? getImage() : $(image)

	// no image is loaded...
	if(image.length == 0){
		return
	}

	var mark = $('.mark.'+cls+'.'+gid)

	if(mark.length == 0){
		mark = $('<div class="mark"/>')
			.addClass(gid)
			.addClass(cls)
			.insertAfter(image)
	} 
	return mark
}
function _removeMark(cls, gid, image){
	gid = gid == null ? getImageGID() : gid
	image = image == null ? getImage() : $(image)

	// no image is loaded...
	if(image.length == 0){
		return
	}

	var mark = $('.mark.'+cls+'.'+gid)

	if(mark.length != 0){
		mark.detach()
	}
	return mark
}


// Make a mark toggler
//
// The toggler will:
// 	- toggle img_class on the target image
// 	- add/remove a mark element after the image
// 	- toggle mark_class on the mark element
// 	- trigger the evt_name on the viewer passing it:
// 		- target image
// 		- action ('on' on 'off')
//
// The actual toggler is built with createCSSClassToggler(..), see its
// docs for protocol descrittion.
//
// The resulting toggled, by default, marks the current image 
// (.current.image), but can be passed a different image as first 
// argument.
//
// NOTE: when passing an alternative image as an argument, the second 
// 		argument MUST also be passed. it can be one of:
// 			- 'on'		: force create mark
// 			- 'off'		: force remove mark
// 			- 'next'	: toggle next state (default)
// NOTE: when passing this a gid, the 'next' action is not supported
function makeMarkToggler(img_class, mark_class, evt_name){
	return createCSSClassToggler(
		'.current.image', 
		img_class,
		function(action, elem){
			toggleMarkesView('on')

			// we got a gid...
			if(elem.length == 0 && elem.selector in IMAGES){
				var gid = elem.selector
				elem = getImage(gid)
				elem = elem.length == 0 ? null : elem

			// we are given an image...
			} else {
				var gid = getImageGID(elem)
			}

			// do this only of the image is loaded...
			if(elem != null){
				if(action == 'on'){
					_addMark(mark_class, gid, elem)
				} else {
					_removeMark(mark_class, gid, elem)
				}
			}

			$('.viewer').trigger(evt_name, [gid, action])
		})
}


// generate an image updater function...
//
// the resulting function will update image mark state by adding or 
// removing the mark the specific mark object.
function makeMarkUpdater(img_class, mark_class, test){
	return function(gid, image){
		// marks...
		if(test(gid)){
			image.addClass(img_class)
			_addMark(mark_class, gid, image)
		} else {
			image.removeClass(img_class)
			_removeMark(mark_class, gid, image)
		}
		return image
	}
}


/**********************************************************************
* Basic marks...
*/

var updateSelectedImageMark = makeMarkUpdater(
		'marked',
		'selected', 
		function(gid){ 
			return MARKED.indexOf(gid) > -1 
		})
IMAGE_UPDATERS.push(updateSelectedImageMark)


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


var toggleMark = makeMarkToggler('marked', 'selected', 'togglingMark')


// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		var res = ribbon
			.find('.marked')
				.each(function(){
					toggleMark(this, 'off')
				})
		$('.viewer').trigger('removeingRibbonMarks', [ribbon])

	// remove all marks...
	} else if(mode == 'all'){
		var res = $('.marked')
			.each(function(){
				toggleMark(this, 'off')
			})
		$('.viewer').trigger('removeingAllMarks')
	} 
	return res
}


function markAll(mode){
	// current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		var res = ribbon
			.find('.image:not(.marked)')
				.each(function(){
					toggleMark(this, 'on')
				})
		$('.viewer').trigger('markingRibbon', [ribbon])

	// mark everything...
	} else if(mode == 'all'){
		var res = $('.image:not(.marked)')
			.each(function(){
				toggleMark(this, 'on')
			})
		$('.viewer').trigger('markingAll')
	}
	return res
}


// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	var ribbon = getRibbon()
	var res = ribbon
		.find('.image')
			.each(function(){
				toggleMark(this, 'next')
			})
	$('.viewer').trigger('invertingMarks', [ribbon])
	return res
}


// Toggle marks in the current continuous section of marked or unmarked
// images...
// XXX need to make this dynamic data compatible...
// XXX this will mark the block ONLY IF it is loaded!!!
function toggleMarkBlock(image){
	if(image == null){
		image = getImage()
	}
	var found = [false, false]
	// we need to invert this...
	var state = toggleMark()
	var _convert = function(i){
		return function(){
			if(toggleMark(this, '?') == state){
				// we found the end...
				// NOTE: this will not be set if we reached the end of 
				// 		the ribbon or the end of the loaded images...
				found[i] = true
				// stop the iteration...
				return false
			}
			toggleMark(this, state)
		}
	}
	image.nextAll('.image').each(_convert(1))
	image.prevAll('.image').each(_convert(0))

	$('.viewer').trigger('togglingImageBlockMarks', [image, state, found])

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
* Dialogs... 
*/

function markImagesDialog(){

	updateStatus('Mark...').show()

	var alg = 'Mark images:'

	var cur = toggleMark('?') == 'on' ? 'Unmark' : 'Mark'

	cfg = {}
	cfg[alg] = [
		cur + ' current image',
		cur + ' current block | '+
			'A block is a set of similarly marked images\n'+
			'to the left and right of the current image,\n'+
			'up until the closest images marked differently',
		'Invert marks in current ribbon',
		'Mark all in current ribbon',
		'Unmark all in current ribbon',
		'Unmark all images'
	]

	formDialog(null, '', 
			cfg,
			'OK', 
			'markImagesDialog')
		.done(function(res){
			res = res[alg]

			// NOTE: these must be in order of least-specific last...
			if(/current image/.test(res)){
				toggleMark()
				var msg = (cur + ' image').toLowerCase()

			} else if(/current block/.test(res)){
				toggleMarkBlock()
				var msg = 'toggled block marks'

			} else if(/Invert/.test(res)){
				invertImageMarks()
				var msg = 'inverted ribbon marks'

			} else if(/Mark all/.test(res)){
				markAll()
				var msg = 'marked ribbon'

			} else if(/Unmark all in/.test(res)){
				removeImageMarks('ribbon')
				var msg = 'unmarked ribbon'

			} else if(/Unmark all images/.test(res)){
				removeImageMarks('all')
				var msg = 'unmarked all'
			}

			showStatusQ('Mark: '+msg+'...')
		})
		.fail(function(){
			showStatusQ('Marking: canceled.')
		})
}



/**********************************************************************
* Files...
*/

// Load image marks form file
//
// NOTE: if no marks are found then set them to []
var loadFileMarks = makeFileLoader(
		'Marks', 
		MARKED_FILE_DEFAULT, 
		MARKED_FILE_PATTERN, 
		function(data){ 
			MARKED = data
		})
FILE_LOADERS.push(loadFileMarks)


// Save image marks to file
var saveFileMarks = makeFileSaver(
		MARKED_FILE_DEFAULT, 
		function(){ 
			return MARKED 
		})
FILE_SAVERS.push(saveFileMarks)



/**********************************************************************
* Setup...
*/


function setupMarks(viewer){
	console.log('Marks: setup...')
	return viewer
		// marks...
		.on('togglingMark', function(evt, gid, action){
			// add marked image to list...
			if(action == 'on'){
				MARKED.indexOf(gid) == -1 && MARKED.push(gid)

			// remove marked image from list...
			} else {
				MARKED.splice(MARKED.indexOf(gid), 1)
			}
		})
		.on('togglingImageBlockMarks', function(evt, img, state, found){
			var gid = getImageGID(img)
			var ribbon = DATA.ribbons[getRibbonIndex(img)]
			var i = ribbon.indexOf(gid)

			state = state == 'off' ? false : true

			var _convert = function(_, e){
				if(skipping && (MARKED.indexOf(e) >= 0) == state){
					return
				}
				skipping = false
				if((MARKED.indexOf(e) >= 0) == state){
					return false
				}
				// do the toggle...
				if(state){
					MARKED.push(e)
				} else {
					MARKED.splice(MARKED.indexOf(e), 1)
				}
			}

			// go left...
			if(!found[0]){
				var skipping = true
				var left = ribbon.slice(0, i)
				left.reverse()
				$.each(left, _convert)
			}

			// go right...
			if(!found[1]){
				var skipping = true
				var right = ribbon.slice(i)
				$.each(right, _convert)
			}
		})
		.on('removeingRibbonMarks', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i != -1){
					MARKED.splice(i, 1)
				}
			})
		})
		.on('removeingAllMarks', function(evt){
			MARKED.splice(0, MARKED.length)
		})
		.on('markingRibbon', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i == -1){
					MARKED.push(e)
				}
			})
		})
		.on('markingAll', function(evt){
			MARKED.splice(0, MARKED.length)
			MARKED.concat(DATA.order)
		})
		.on('invertingMarks', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i == -1){
					MARKED.push(e)
				} else {
					MARKED.splice(i, 1)
				}
			})
		})
}
SETUP_BINDINGS.push(setupMarks)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
