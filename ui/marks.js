/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var MARKED = []

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


var getMarkedGIDBefore = makeGIDBeforeGetterFromList(
		function(){ 
			return MARKED 
		})


// Make a mark toggler
//
// The toggler will:
// 	- toggle img_class on the target image
// 	- add/remove a mark element after the image
// 	- toggle mark_class on the mark element
// 	- call the callback, if defined, passing it:
// 		- gid
// 		- action ('on' or 'off')
// 	- trigger the evt_name on the viewer passing it:
// 		- gid
// 		- action ('on' or 'off')
//
// The actual toggler is built with createCSSClassToggler(..), see its
// docs for protocol descrittion.
//
// The resulting toggler, by default, marks the current image 
// (.current.image), but can be passed a different image as first 
// argument.
//
// NOTE: when passing an alternative image as an argument, the second 
// 		argument MUST also be passed. it can be one of:
// 			- 'on'		: force create mark
// 			- 'off'		: force remove mark
// 			- 'next'	: toggle next state (default)
// NOTE: when passing this a gid, the 'next' action is not supported
//
// XXX do we need a pre-callback here???
function makeMarkToggler(img_class, mark_class, evt_name, callback){
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

			if(callback != null){
				callback(gid, action)
			}

			$('.viewer').trigger(evt_name, [gid, action])
		})
}


// generate an image updater function...
//
// the resulting function will update image mark state by adding or 
// removing the mark the specific mark object.
function makeMarkUpdater(img_class, mark_class, test){
	var _updater = function(gid, image){
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
	IMAGE_UPDATERS.push(_updater)
	return _updater
}



/**********************************************************************
* 
*/

var updateSelectedImageMark = makeMarkUpdater(
		'marked',
		'selected', 
		function(gid){ 
			return MARKED.indexOf(gid) > -1 
		})


// NOTE: to disable MARKED cleanout set no_cleanout_marks to true.
// NOTE: MARKED may contain both gids that are not loaded and that do 
// 		not exist, as there is no way to distinguish between the two 
// 		situations the cleanup is optional...
function cropMarkedImages(keep_ribbons, keep_unloaded_gids){
	var marked = MARKED.slice()//.sort(imageOrderCmp)

	cropDataTo(marked, keep_ribbons, keep_unloaded_gids)

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
			cropMarkedImages(true)
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

var toggleMark = makeMarkToggler(
		'marked', 
		'selected', 
		'togglingMark',
		function(gid, action){
			// add marked image to list...
			if(action == 'on'){
				if(MARKED.indexOf(gid) == -1){
					insertGIDToPosition(gid, MARKED)
				} 

			// remove marked image from list...
			} else {
				MARKED.splice(MARKED.indexOf(gid), 1)
			}
		})



function toggleAllMarks(action, mode){
	action = action == null ? toggleMark('?') : action
	mode = mode == null ? 'ribbon' : mode

	var updated = []

	if(action == 'on'){
		var _update = function(e){
			if(MARKED.indexOf(e) < 0){
				insertGIDToPosition(e, MARKED)
				updated.push(e)
			}
		}
	} else {
		var _update = function(e){
			var i = MARKED.indexOf(e)
			if(i >= 0){
				MARKED.splice(i, 1)
				updated.push(e)
			}
		}
	}

	// marks from current ribbon (default)...
	if(mode == 'ribbon'){
		var res = getRibbonGIDs()

	// all marks...
	} else if(mode == 'all'){
		var res = getLoadedGIDs()
	} 

	res.forEach(_update)

	updateImages(updated)

	$('.viewer').trigger('togglingMarks', [updated, action])

	return res
}

// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	mode = mode == null ? 'ribbon' : mode
	var res = toggleAllMarks('off', mode)
	$('.viewer').trigger('removingMarks', [res, mode])
	return res
}


function markAll(mode){
	mode = mode == null ? 'ribbon' : mode
	var res = toggleAllMarks('on', mode)
	$('.viewer').trigger('addingMarks', [res, mode])
	return res
}


// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	var ribbon = getRibbonGIDs()
	var on = []
	var off = []

	$.each(ribbon, function(_, e){
		var i = MARKED.indexOf(e)
		if(i == -1){
			on.push(e)
			insertGIDToPosition(e, MARKED)
		} else {
			off.push(e)
			MARKED.splice(i, 1)
		}
	})
	updateImages(ribbon)

	$('.viewer')
		.trigger('invertingMarks', [ribbon])
		.trigger('togglingMarks', [on, 'on'])
		.trigger('togglingMarks', [off, 'off'])

	return on.concat(off)
}


// Toggle marks in the current continuous section of marked or unmarked
// images...
function toggleMarkBlock(image){
	image = image == null ? getImage() : image
	var gid = typeof(image) == typeof('str') ? image : getImageGID(image)
	image = typeof(image) == typeof('str') ? getImage(gid) : image

	var state = toggleMark(image, 'next') == 'off' ? false : true

	var ribbon = DATA.ribbons[getRibbonIndex(image)]
	var i = ribbon.indexOf(gid)

	var updated = [gid]

	var _convert = function(_, e){
		// break if state differs from current...
		if((MARKED.indexOf(e) >= 0) == state){
			return false
		}
		// do the toggle...
		if(state){
			insertGIDToPosition(e, MARKED)
		} else {
			MARKED.splice(MARKED.indexOf(e), 1)
		}
		updated.push(e)
	}

	// go left...
	var left = ribbon.slice(0, i)
	left.reverse()
	$.each(left, _convert)

	// go right...
	var right = ribbon.slice(i+1)
	$.each(right, _convert)

	updateImages(updated)

	$('.viewer')
		.trigger('togglingImageBlockMarks', [image, updated, state])
		.trigger('togglingMarks', [updated, state ? 'on' : 'off'])

	return state
}


// XXX need to account for empty ribbons...
function shiftMarkedImages(direction, mode, new_ribbon){
	mode = mode == null ? 'ribbon' : mode
	var cur = getRibbonIndex()
	var orig_ribbon = cur

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

	$('.viewer').trigger('shiftedImages', [marked, orig_ribbon, cur])
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
	return horizontalShiftMarkedImages('prev')
}
function shiftMarkedImagesRight(){
	return horizontalShiftMarkedImages('next')
}


// focus next/prev mark...
//
// NOTE: these will not jump to marks on other ribbons... to prevent this
// 		add true as the final argument (see restrict_to_ribbon argument 
// 		of makeNextFromListAction(..) for more info)
var nextMark = makeNextFromListAction(
		getMarkedGIDBefore, 
		function(){ return MARKED })
var prevMark = makePrevFromListAction(
		getMarkedGIDBefore, 
		function(){ return MARKED })




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
		'Mark all images',
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

			} else if(/Mark all.*current ribbon/.test(res)){
				markAll()
				var msg = 'marked ribbon'

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
			// set the MARKED...
			MARKED = data

			// for version below 2.1, sort MARKED and update to 2.1...
			if(DATA.version == '2.0'){
				setTimeout(function(){
					var t0 = Date.now()
					MARKED.sort(imageOrderCmp)
					var t1 = Date.now()

					// XXX is this the correct way to do this???
					DATA.version = DATA_VERSION

					console.warn('Marks: sort: done ('+( t1 - t0 )+'ms) -- resave the data.')
				}, 0)
			}
		},
		'marksLoaded')


// Save image marks to file
var saveFileMarks = makeFileSaver(
		MARKED_FILE_DEFAULT, 
		function(){ 
			return MARKED 
		})



/**********************************************************************
* Setup...
*/


function setupMarks(viewer){
	console.log('Marks: setup...')

	// XXX make this viewer specific...
	makeContextIndicatorUpdater('marked')

	// XXX make these viewer specific...
	showGlobalIndicator(
			'marks-visible', 
			'Marks visible (F2)')
		.click(function(){ toggleMarkesView() })
	showGlobalIndicator(
			'marked-only-visible', 
			'Marked only images visible (shift-F2)')
		.click(function(){ toggleMarkedOnlyView() })
	showContextIndicator(
			'current-image-marked', 
			'Marked (Ins)')
		.click(function(){ toggleMark() })

	return viewer
		// XXX do we actually need this???
		.on('togglingMarks', function(evt, lst, action){
			lst.forEach(function(gid){
				viewer.trigger('togglingMark', [gid, action])
			})
		})
}
SETUP_BINDINGS.push(setupMarks)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
