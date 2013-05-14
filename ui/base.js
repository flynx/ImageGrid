/**********************************************************************
* 
* Viewer Generation III
* 
* Split the API into the following sections:
* 	- main control actions
* 		do main domain tasks like image and ribbon manipulation.
* 	- serialization and deserialization
* 		load and save data
* 	- UI
* 		basic align, animation and modes
* 
* 
* TODO group all actions into an object, referencing the viewer...
* 	...this will make this reusable multiple times.			
* TODO wrap the actions into an object and make all queries relative to
* 		a single root viewer...
* 		...this will make the code reusable multiple times...
*
*
**********************************************************************/

// NOTE: NAV_ALL might not be practical...
var NAV_ALL = '*'
var NAV_VISIBLE = ':visible'
var NAV_MARKED = '.marked:visible'
var NAV_DEFAULT = NAV_VISIBLE

var MAX_SCREEN_IMAGES = 12
var ZOOM_SCALE = 1.2



/**********************************************************************
* Helpers
*/

// XXX might need shift left/right indicators (later)...


function flashIndicator(direction){
	$({
		prev: '.up-indicator',
		next: '.down-indicator',
		start: '.start-indicator',
		end: '.end-indicator',
	}[direction])
		// NOTE: this needs to be visible in all cases and key press 
		// 		rhythms... 
		.show()
		.delay(20)
		.fadeOut(200)
}


function getRibbon(image){
	image = image == null ? $('.current.image') : $(image)
	return image.closest('.ribbon')
}


function getImage(gid){
	if(e == null){
		return $('.current.image')
	}
	// XXX do a proper check...
	// gid...
	return $('.image[gid='+ JSON.stringify(gid) +']')
	
	// order...
	// XXX
	//return $('.image[order='+ JSON.stringify(gid) +']')
}


// NOTE: elem is optional and if given can be an image or a ribbon...
function getRibbonIndex(elem){
	if(elem == null){
		var ribbon = getRibbon()
	} else {
		elem = $(elem)
		if(elem.hasClass('image')){
			ribbon = getRibbon(elem)
		} else {
			ribbon = elem
		}
	}
	return $('.ribbon').index(ribbon)
}


function getImageOrder(image){
	image = image == null ? $('.current.image') : $(image)
	if(image.length == 0){
		return
	}
	return JSON.parse(image.attr('order'))
}


function getImageGID(image){
	image = image == null ? $('.current.image') : $(image)
	if(image.length == 0){
		return
	}
	return JSON.parse(image.attr('gid'))
}


// Calculate relative position between two elements
//
// ...tried to make this as brain-dead-stupidly-simple as possible...
//				...looks spectacular comparing to either gen2 or gen1 ;)
function getRelativeVisualPosition(outer, inner){
	outer = $(outer).offset()
	inner = $(inner).offset()
	return {
		top: inner.top - outer.top,
		left: inner.left - outer.left
	}
}


// Returns the image size (width) as viewed on screen...
function getVisibleImageSize(){
	return $('.image').outerWidth() * getElementScale($('.ribbon-set'))
}


// Return the number of images that can fit to viewer width...
function getScreenWidthInImages(){
	return $('.viewer').innerWidth() / getVisibleImageSize()
}


// NOTE: this will return an empty jquery object if no image is before 
// 		the target...
// NOTE: this might return an empty target if the ribbon is empty...
// NOTE: this only "sees" the loaded images, for a full check use 
// 		getGIDBefore(...) that will check the full data...
function getImageBefore(image, ribbon, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	image = image == null ? $('.current.image') : $(image)
	if(ribbon == null){
		ribbon = getRibbon(image)
	}
	var images = $(ribbon).find('.image').filter(mode)
	var order = getImageOrder(image)
	var prev = []

	images.each(function(){
		if(order < getImageOrder($(this))){
			return false
		}
		prev = this
	})

	return $(prev)
}


function shiftTo(image, ribbon){
	var target = getImageBefore(image, ribbon, NAV_ALL)
	var cur_ribbon = getRibbon(image)

	// insert before the first image if nothing is before the target...
	if(target.length == 0){
		image.prependTo($(ribbon))

	} else {
		image.insertAfter(target)
	}

	$('.viewer').trigger('shiftedImage', [image, cur_ribbon, ribbon])

	// if removing last image out of a ribbon, remove the ribbon....
	if(cur_ribbon.find('.image').length == 0){
		// XXX check if the ribbon outside the loaded area is empty...
		// 		...do we need this check? it might be interresting to
		// 		"collapse" disjoint, empty areas...
		// 		......if so, will also need to do this in DATA...
		removeRibbon(cur_ribbon)
	}

	return image
}


function shiftImage(direction, image, force_create_ribbon){
	if(image == null){
		// XXX need to make this context specific...
		image = $('.current.image')
	} else {
		image = $(image)
	}
	var old_ribbon = getRibbon(image)
	var ribbon = old_ribbon[direction]('.ribbon')

	// need to create a new ribbon...
	if(ribbon.length == 0 || force_create_ribbon == true){
		var index = getRibbonIndex(old_ribbon)
		index = direction == 'next' ? index + 1 : index

		ribbon = createRibbon(index)

		shiftTo(image, ribbon)
	} else {
		shiftTo(image, ribbon)
	}
	return image
}



/**********************************************************************
* Constructors
*/

// NOTE: unless force_create_new is set to true this will clone an 
// 		image if one is available...
// NOTE: this will not attach the created images.
function createImage(n, force_create_new){
	if(n == null){
		if(window._n == null){
			window._n = 0
		}
		n = _n
		_n += 1
	}
	var img = $('.image')
	if(!force_create_new && img.length > 0){
		return img.first().clone()
					.attr({
						'order': JSON.stringify(n),
						'gid': JSON.stringify(n),
						// need to strip extra classes...
						'class': 'image'
					})
	} else {
		return $('<div order="'+n+'" gid="'+n+'" class="image"/>')
	}
}


// Create a set of new images, reusing a list of existing elements if 
// given.
// NOTE: this will not attach the created images.
function createImages(need, have){
	have = have == null ? $([]) : $(have)

	// we have enough elements in the cache...
	if(have.length >= need){
		return $(have.splice(0, need))

	// need to create additional elements...
	} else {
		return $(have.toArray().concat(new Array(need - have.length)))
			.map(function(i, elem){
				if(elem != null){
					return elem
				}
				return createImage()[0]
			})
	}
}


// NOTE: if index is given, this will also attach the created ribbon to 
// 		that position...
function createRibbon(index){
	var ribbon = $('<div class="ribbon"/>')

	if(index == null){
		return ribbon
	}
	var ribbons = $('.ribbon')
	if(index >= ribbons.length){
		ribbons.last().after(ribbon)
	} else {
		ribbons.eq(index).before(ribbon)
	}

	$('.viewer').trigger('createdRibbon', [ribbon])

	return ribbon
}


// NOTE: this will pass the index where the ribbon was to the event,
// 		rather than an actual ribbon...
// XXX check if ribbon is empty...
function removeRibbon(ribbon){
	// ribbon can be an index...
	if(typeof(ribbon) == typeof(1)){
		ribbon = $('.ribbon').eq(ribbon)
	}

	$('.viewer').trigger('removedRibbon', [getRibbonIndex(ribbon)])

	return $(ribbon).remove()
}



/**********************************************************************
* Infinite ribbon machinery
*/

// Extend the ribbon...
//
// This will add/remove images to/from ribbon's head and/or tail.
//
// NOTE: negative left or right will contract the ribbon -- remove 
// 		elements...
// NOTE: this will compensate for left position changes so as the images
// 		that did not change will stay in the same position.
// 		to disable this, set no_compensate_shift to true.
// NOTE: for position compensation to work with scaling need to set the 
// 		origin on the scaled element ($('.ribbon-set')) to top left 
// 		(instead of the default 50% 50% 0) to avoid element size 
// 		affecting it's perceived position...
//
// XXX check what goes on if left/right are far more than length...
function extendRibbon(left, right, ribbon, no_compensate_shift){
	ribbon = ribbon == null ? 
				getRibbon()
				: $(ribbon)
	left = left == null ? 0 : left
	right = right == null ? 0 : right
	var images = ribbon.children('.image')
	var removed = []
	var res = {
		left: $([]),
		right: $([])
	}

	// truncate...
	// NOTE: we save the detached elements to reuse them on extending,
	//		if needed...
	if(left < 0){
		removed = $(images.splice(0, -left)).detach()
	}
	if(right < 0){
		var l = images.length
		removed = $(images.splice(l+right, l)).detach()
	}

	// extend...
	if (left > 0){
		res.left = createImages(left, removed).prependTo(ribbon)
	}
	if (right > 0){
		res.right = createImages(right, removed).appendTo(ribbon)
	}

	// NOTE: this is fool-proof as it's based on relative visual 
	// 		position...
	var scale = getElementScale($('.ribbon-set'))
	var l = parseFloat(ribbon.css('left'))
	l = isNaN(l) ? 0 : l
	// compensate for left shift...
	if(!no_compensate_shift && left != 0){
		l -= left * images.outerWidth()

		ribbon.css({
			left: l,
		})
	}

	return res
}


// Roll the ribbon n positions to the left.
//
// NOTE: if n is negative the ribbon will be rolled right.
// NOTE: rollRibbon(N, R) is equivalent to extendRibbon(-N, N, R)
// NOTE: this will return a single list of relocated elements...
function rollRibbon(n, ribbon, extend, no_compensate_shift){
	var res = extendRibbon(-n, n, ribbon, no_compensate_shift)
	return n > 0 ? res.right : res.left
}



/**********************************************************************
* Modes
*/

// XXX shifting images and unmarking in this mode do not work correctly...
var toggleMarkedOnlyView = createCSSClassToggler('.viewer', 'marked-only',
	function(){
		var cur = $('.current.image')
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
		if($('.current.image').hasClass('marked')){
			return
		}
		nextRibbon()
	})


// XXX add ability to take all marked images and open them in a separate view...


// XXX should we use the createCSSClassToggler for this?
// XXX revise: does extra stuff...
function toggleImageProportions(mode){
	var image = $('.image')
	var h = image.outerHeight(true)
	var w = image.outerWidth(true)

	if(mode == '?'){
		return h != w ? 'viewer' : 'square'

	// square...
	} else if(h != w || mode == 'square'){
		var size = Math.min(w, h)
		image.css({
			width: size,
			height: size
		})
		centerView(null, 'css')
		return 'square'

	// viewer size...
	} else {
		var viewer = $('.viewer')
		var W = viewer.innerWidth()
		var H = viewer.innerHeight()

		if(W > H){
			image.css('width', W * h/H)
		} else {
			image.css('height', H * w/W)
		}
		centerView(null, 'css')
		return 'viewer'
	}
}



/**********************************************************************
* Layout
*/

function focusImage(image){
	image.closest('.viewer').find('.current.image').removeClass('current')
	$('.viewer').trigger('focusingImage', [image])
	return image.addClass('current')
}


/*
// Generic align
//
// XXX need to split this into two:
// 		- offset calculator
// 		- actual move
// XXX this does not account for scale at this point...
// XXX for this to be generic, need a uniform way to get any element scale
// 		regardless of weather it was scaled directly or is within one or 
// 		several scaled elements...
function alignVia(container, elem, via, valign, halign, mode){
	container = $(container)
	elem = $(elem)
	via = $(via)

	valign = valign == null ? 'center' : valign
	halign = halign == null ? 'center' : halign
	mode = mode == null ? 'animate' : mode

	var pos = getRelativeVisualPosition(container, elem)
	var dt = pos.top
	var dl = pos.left
	var target = {}

	var t = parseFloat(via.css('top'))
	t = !isNaN(t) ? t : 0
	var l = parseFloat(via.css('left'))
	l = !isNaN(l) ? l : 0

	if(valign == 'center'){
		var H = container.innerHeight()
		var h = elem.outerHeight()
		target.top = t - dt + (H - h)/2,
	} else if(valign == 'top'){
		target.top = t - dt
	} else if(valign == 'bottom'){
		var h = elem.outerHeight()
		target.top = t - dt - h
	} 

	if(halign == 'center'){
		var W = container.innerWidth()
		var w = elem.outerWidth()
		target.left = l - dl + (W - w)/2
	} else if(halign == 'left'){
		target.left = l - dl
	} else if(halign == 'right'){
		var w = elem.outerWidth()
		target.left = l - dl - w
	} 

	// do the actual work...
	if(mode == 'animate'){
		via.stop().animate(target, 100, 'linear')
	} else {
		via.css(target)
	}

	// XXX ???
	return
}
*/


// XXX make this more configurable (centering, ...)...
function centerView(image, mode){
	if(mode == null){
		//mode = 'css'
		mode = 'animate'
	}

	$('.viewer').trigger('preCenteringView', [getRibbon(image), image])

	if(image == null || image.length == 0){
		image = $('.current.image')
	}
	var viewer = $('.viewer')
	// XXX should these be "inner"???
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var ribbons = $('.ribbon-set')
	var scale = getElementScale(ribbons)
	// NOTE: these are scalable, this needs to get normalized...
	var w = image.outerWidth()*scale
	var h = image.outerHeight()*scale

	var pos = getRelativeVisualPosition(viewer, image)

	// zero out top/left if set to anything other than a specific number...
	var t = parseFloat(ribbons.css('top'))
	t = !isNaN(t) ? t : 0
	var l = parseFloat(ribbons.css('left'))
	l = !isNaN(l) ? l : 0


	var res = {
		'top': t - pos.top + (H - h)/2,
		'left': l - pos.left + (W - w)/2
	}
	// do the actual work...
	if(mode == 'animate'){
		ribbons.stop().animate(res, 100, 'linear')
	} else {
		ribbons.css(res)
	}

	$('.viewer').trigger('centeringView', [getRibbon(image), image])

	return image
}


// Center a ribbon...
//
// This behaves differently for different ribbons:
// 	- ribbon containing the current image
// 		center
// 	- any other ribbon
// 		center relative to target (given) via the ribbon left
// 		only left coordinate is changed...
//
// NOTE: image defaults to $('.current.image').
//
// XXX might be good to merge this and centerImage...
// 		...or make a generic centering function...
//
// XXX this does not work in marked-only mode...
// XXX this needs the image to exist... should be GID compatible... (???)
function centerRibbon(ribbon, image, mode){
	if(mode == null){
		//mode = 'css'
		mode = 'animate'
	}
	ribbon = $(ribbon)
	image = image == null ? $('.current.image') : $(image)

	$('.viewer').trigger('preCenteringRibbon', [ribbon, image])

	var scale = getElementScale($('.ribbon-set'))
	var target = getImageBefore(image, ribbon, null)
	var offset = 0
	var l = parseFloat(ribbon.css('left'))
	l = !isNaN(l) ? l : 0
	var w = $('.image').outerWidth()

	//if(ribbon.find('.image').index(image) >= 0){
	if(ribbon.find('.current.image').length > 0){
		offset = w/2 
	} 

	if(target.length > 0){
		var dl = getRelativeVisualPosition(target, image).left/scale
		l = {
			left: l + dl - (w/2) + offset
		}

	} else {
		target = ribbon.find('.image').filter(NAV_DEFAULT).first() 
		var dl = getRelativeVisualPosition(target, image).left/scale
		l = {
			left: l + dl + (w/2) + offset
		}
	}

	if(mode == 'animate'){
		ribbon.stop().animate(l, 100, 'linear')
	} else {
		ribbon.css(l)
	}

	$('.viewer').trigger('centeringRibbon', [ribbon, image])

	// XXX should this return a ribbon or the target image???
	return ribbon
}


// a shorthand...
function centerRibbons(mode, no_skip_current){
	return $('.ribbon')
		.filter(':visible')
		.each(function(){ 
			if(no_skip_current == true && $(this).find('.current.image').length > 0){
				return
			}
			centerRibbon($(this), null, mode) 
		})
}



/**********************************************************************
* Event handlers...
*/

// NOTE: this is on purpose done relative...
function clickHandler(evt){
	var img = $(evt.target).closest('.image')

	centerView(focusImage(img))

	centerRibbons()
}



/**********************************************************************
* User actions
*/

// basic navigation actions...
function nextImage(n, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	n = n == null ? 1 : n
	var target = $('.current.image').nextAll('.image' + mode)
	if(target.length < n){
		target = target.last()
		// XXX this fires if we hit the end of the currently loaded
		// 		images while scrolling very fast rather than when we are
		// 		out of images in the current ribbon...
		flashIndicator('end')
	} else {
		target = target.eq(n-1)
	}
	return centerView(focusImage(target))
}
function prevImage(n, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	n = n == null ? 1 : n
	var target = $('.current.image').prevAll('.image' + mode)
	if(target.length < n){
		target = target.last()
		// XXX this fires if we hit the end of the currently loaded
		// 		images while scrolling very fast rather than when we are
		// 		out of images in the current ribbon...
		flashIndicator('start')
	} else {
		target = target.eq(n-1)
	}
	return centerView(focusImage(target))
}


function nextScreenImages(mode){
	return nextImage(Math.round(getScreenWidthInImages()), mode)
}
function prevScreenImages(mode){
	return prevImage(Math.round(getScreenWidthInImages()), mode)
}


// XXX revise...
function firstImage(mode){
	$('.viewer').trigger('requestedFirstImage', [getRibbon()])

	mode = mode == null ? NAV_DEFAULT : mode
	if($('.current.image').prevAll('.image' + mode).length == 0){
		flashIndicator('start')
	}
	return centerView(
		focusImage(
			getRibbon().find('.image').filter(mode).first()))
}
// XXX revise...
function lastImage(mode){
	$('.viewer').trigger('requestedLastImage', [getRibbon()])

	mode = mode == null ? NAV_DEFAULT : mode
	if($('.current.image').nextAll('.image' + mode).length == 0){
		flashIndicator('end')
	}
	return centerView(
		focusImage(
			getRibbon().find('.image').filter(mode).last()))
}


// NOTE: if moving is 'next' these will chose the image after the current's order.
// NOTE: if an image with the same order is found, moving argument has no effect.
// XXX these sometimes behave wrong at the start of the ribbon depending
// 		on direction...
function prevRibbon(moving, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	var cur = $('.current.image')
	var target = getImageBefore(cur, 
			getRibbon(cur).prevAll('.ribbon:visible').first())
	if(target.length == 0){
		// XXX too complex???
		target = getRibbon(cur)
					.prevAll('.ribbon:visible').first()
						.find('.image' + mode).first()
	} else if(moving == 'next' && cur.attr('order') != target.attr('order')){
		var next = target.nextAll('.image' + mode).first()
		target = next.length > 0 ? next : target
	}
	return centerView(focusImage(target))
}
function nextRibbon(moving, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	var cur = $('.current.image')
	var target = getImageBefore(cur, 
			getRibbon(cur).nextAll('.ribbon:visible').first())
	if(target.length == 0){
		// XXX too complex???
		target = getRibbon(cur)
					.nextAll('.ribbon:visible').first()
						.find('.image' + mode).first()
	} else if(moving == 'next' && cur.attr('order') != target.attr('order')){
			var next = target.nextAll('.image' + mode).first()
			target = next.length > 0 ? next : target
	}
	return centerView(focusImage(target))
}



/********************************************************* Zooming ***/

function fitNImages(n){
	var image = $('.current.image')
	var size = image.outerHeight(true)

	var viewer = $('.viewer')
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var scale = Math.min(W / (size * n), H / size)

	// NOTE: if animating, the next two likes must be animated together...
	setElementScale($('.ribbon-set'), scale)
	centerView(image, 'css')

	$('.viewer').trigger('fittingImages', [n])
}


function zoomIn(){
	var w = getScreenWidthInImages()
	if(w > 1){
		w = w / ZOOM_SCALE
		fitNImages(w >= 1 ? w : 1)
	}
}
function zoomOut(){
	var w = getScreenWidthInImages()
	if(w <= MAX_SCREEN_IMAGES){
		w = w * ZOOM_SCALE
		fitNImages(w <= MAX_SCREEN_IMAGES ? w : MAX_SCREEN_IMAGES)
	}
}



/************************************************** Editor Actions ***/

function shiftImageTo(image, direction, moving, force_create_ribbon, mode){
	if(image == null){
		image = $('.current.image')
	}
	mode = mode == null ? NAV_DEFAULT : mode

	// account move for direction...
	// XXX get the value from some place more logical than the argument...
	var a = moving == 'prev' ? 'prevAll' : 'nextAll' 
	var b = moving == 'prev' ? 'nextAll' : 'prevAll' 
	var target = image[a]('.image' + mode).first()

	target = target.length == 0 ? image[b]().first() : target

	// XXX should this be in here or coupled later via an event???
	//flashIndicator(direction)

	shiftImage(direction, image, force_create_ribbon)
	// XXX does this need to be animated???
	return centerView(focusImage(target), 'css')
}
function shiftImageUp(image, moving){
	return shiftImageTo(image, 'prev', moving)
}
function shiftImageDown(image, moving){
	return shiftImageTo(image, 'next')
}
function shiftImageUpNewRibbon(image, moving){
	return shiftImageTo(image, 'prev', moving, true)
}
function shiftImageDownNewRibbon(image, moving){
	return shiftImageTo(image, 'prev', moving, false)
}


// TODO manual image ordering (shiftLeft/shiftRight functions)
// XXX



/*********************************************************** Marks ***/

// XXX if this unmarks an image in marked-only mode no visible image is 
// 		going to be current...
var toggleImageMark = createCSSClassToggler('.current.image', 'marked',
	function(action){
		$('.viewer').trigger('togglingMark', [$('.current.image'), action])
	})


// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		$('.viewer').trigger('removeingRibbonMarks', [ribbon])
		return ribbon
			.find('.marked')
				.removeClass('marked')

	// remove all marks...
	} else if(mode == 'all'){
		$('.viewer').trigger('removeingAllMarks')
		return $('.marked')
			.removeClass('marked')
	} 
}


function markAll(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		var ribbon = getRibbon()
		$('.viewer').trigger('markingRibbon', [ribbon])
		return ribbon
			.find('.image:not(.marked)')
				.addClass('marked')

	} else if(mode == 'all'){
		$('.viewer').trigger('markingAll')
		return $('.image:not(.marked)').addClass('marked')
	}
}


// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	var ribbon = getRibbon()
	$('.viewer').trigger('invertingMarks', [ribbon])
	return ribbon
		.find('.image')
			.toggleClass('marked')
}


// Toggle marks in the current continuous section of marked or unmarked
// images...
// XXX need to make this dynamic data compatible...
function toggleImageMarkBlock(image){
	if(image == null){
		image = $('.current.image')
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
* vim:set sw=4 ts=4 :												 */
