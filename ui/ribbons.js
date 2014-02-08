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
* TODO wrap the actions into an object and make all queries relative to
* 		a single root viewer...
* 		...this will make the code reusable multiple times...
*
*
**********************************************************************/

var CONFIG = {
	min_image_size: 100,
	zoom_step_scale: 1.2,
}

// can be:
// 	- animate
// 	- css
var TRANSITION_MODE_DEFAULT = 'animate'



/**********************************************************************
* Helpers
*/

// Match the results of two functions
//
// If the results are not the same then print a warning.
//
// NOTE: this is here for testing.
// NOTE: this expects that none of the functions will modify the 
// 		arguments...
// NOTE: this will return the result of the first function.
function match2(f0, f1){
	return function(){
		var a = f0.apply(f0, arguments)
		var b = f1.apply(f1, arguments)
		if(a != b){
			console.warn('Result mismatch: f0:'+a+' f1:'+b)
		}
		return a
	}
}


// Same as match2 but can take an arbitrary number of functions.
// XXX test
function matchN(){
	var funcs = arguments
	return function(){
		var res = []
		var err = false
		var r
		// call everything...
		for(var i=0; i < funcs.lenght; i++){
			r = f0.apply(f0, arguments)
			// match the results...
			if(r != res[res.length-1]){
				err = false
			}
			res.push(r)
		}
		if(err){
			console.warn('Not all results matched:', r)
		}
		return res[0]
	}
}


// XXX might need shift left/right indicators (later)...


function getImage(gid){
	var res
	// current or first (no gid given)
	if(gid == null){
		res = $('.current.image')
		return res.length == 0 ? $('.image').first() : res
	}

	// order...
	if(typeof(gid) == typeof(1)){
		res = $('.image[order="'+ JSON.stringify(gid) +'"]')
		if(res.length != null){
			return res
		}
	}

	// gid...
	res = $('.image[gid="'+ JSON.stringify(gid) +'"]')
	if(res.length != null){
		return res
	}
	
	return null
}


function getImageOrder(image){
	image = image == null ? getImage() : $(image)
	if(image.length == 0){
		return
	}
	return JSON.parse(image.attr('order'))
}


function getImageGID(image){
	image = image == null ? getImage() : $(image)
	if(image.length == 0){
		return
	}
	return JSON.parse(image.attr('gid'))
}


// Get mark elements associated with image...
//
// img can be:
// 	- literal gid
// 	- image
// 	- null -- assume current image
//
// NOTE: this does not understand selectors as arguments...
function getImageMarks(img){
	gid = typeof(img) == typeof('str') ? img : null
	gid = gid == null ? getImageGID(img) : gid

	return $('.mark.'+gid)
}


function getRibbon(a){
	a = a == null ? getImage() : a

	// a is an index...
	if(typeof(a) == typeof(123)){
		return $($('.ribbon')[a])

	// a is a gid...
	} else if(typeof(a) == typeof('str')){
		a = getImage(a)

	// a was an elem...
	} else {
		a = $(a)
	}

	// a is an element...
	return a.closest('.ribbon')
}


// XXX make this not depend on DOM... a-la getImageBefore vs. getGIDBefore
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


// Calculate relative position between two elements
//
// NOTE: tried to make this as brain-dead-stupidly-simple as possible...
//		...looks spectacular comparing to either gen2 or gen1 ;)
// NOTE: if used during an animation/transition this will give the 
// 		position at the exact frame of the animation, this might not be
// 		the desired "final" data...
function getRelativeVisualPosition(outer, inner){
	outer = $(outer).offset()
	inner = $(inner).offset()
	return {
		top: inner.top - outer.top,
		left: inner.left - outer.left
	}
}


// Returns the image size (width) as viewed on screen...
//
// dim can be:
// 	- 'width' (default)
// 	- 'height'
// 	- 'min'
// 	- 'max'
//
// NOTE: we do not need to worry about rotation here as the size change is 
// 		compensated with margins...
function getVisibleImageSize(dim){
	dim = dim == null ? 'width' : dim
	var scale = getElementScale($('.ribbon-set'))
	if(dim == 'height'){
		return $('.image').outerHeight(true) * scale
	} else if(dim == 'width'){
		return $('.image').outerWidth(true) * scale
	} else if(dim == 'max'){
		return Math.max($('.image').outerHeight(true), $('.image').outerWidth(true)) * scale
	} else if(dim == 'min'){
		return Math.min($('.image').outerHeight(true), $('.image').outerWidth(true)) * scale
	}
}


// Return the number of images that can fit to viewer width...
function getScreenWidthInImages(size, dim){
	size = size == null ? getVisibleImageSize(dim) : size
	return $('.viewer').innerWidth() / size
}


// NOTE: this will return an empty jquery object if no image is before 
// 		the target...
// NOTE: this might return an empty target if the ribbon is empty...
// NOTE: this only "sees" the loaded images, for a full check use 
// 		getGIDBefore(...) that will check the full data...
function getImageBefore(image, ribbon){
	image = image == null ? getImage() : $(image)
	if(ribbon == null){
		ribbon = getRibbon(image)
	}
	var images = $(ribbon).find('.image')
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


// NOTE: this just shifts the image, it does not care about either 
// 		aligning nor focus...
// NOTE: the shiftedImage event is fired BEFORE any ribbons are removed...
function shiftTo(image, ribbon){
	var target = getImageBefore(image, ribbon)
	var cur_ribbon = getRibbon(image)
	var marks = getImageMarks(image)

	// insert before the first image if nothing is before the target...
	if(target.length == 0){
		image.prependTo($(ribbon))

	// insert the image...
	// NOTE: we need to take care to insert the image not just after the
	// 		target, but also after the target's marks...
	} else {
		var target_marks = getImageMarks(target).last()
		image.insertAfter(
				// if target has marks, insert after them...
				target_marks.length > 0 
					? target_marks 
					: target)
	}

	// move the marks...
	image.after(marks)

	// NOTE: this is intentionally fired BEFORE removing a ribbon...
	$('.viewer').trigger('shiftedImage', [image, cur_ribbon, ribbon])

	// if removing last image out of a ribbon, remove the ribbon....
	if(cur_ribbon.find('.image').length == 0){
		// XXX check if the ribbon outside the loaded area is empty...
		// 		...do we need this check? it might be interesting to
		// 		"collapse" disjoint, empty areas...
		// 		......if so, will also need to do this in DATA...
		removeRibbon(cur_ribbon)
	}

	return image
}


function shiftImage(direction, image, force_create_ribbon){
	image = image == null ? getImage() : $(image)
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
		// XXX do we need this?
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
		return $('<div/>')
			.attr({
				order: n,
				gid: JSON.stringify(n),
				// need to strip extra classes...
				'class': 'image',
			})
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
// 		that position and trigger the event...
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
//
// NOTE: for position compensation to work with scaling need to set the 
// 		origin on the scaled element ($('.ribbon-set')) to top left 
// 		(instead of the default 50% 50% 0) to avoid element size 
// 		affecting it's perceived position...
// NOTE: this will remove everything out of a ribbon if left/right are 
// 		more than the length of the ribbon...
function extendRibbon(left, right, ribbon, no_compensate_shift){
	ribbon = ribbon == null ?  getRibbon() : $(ribbon)
	left = left == null ? 0 : left
	right = right == null ? 0 : right
	var images = ribbon.children('.image')

	// total length of the result...
	var len = left + right + images.length
	len = len < 0 ? 0 : len
	var cur_len = images.length

	var removed = []
	var res = {
		left: $([]),
		right: $([])
	}

	// truncate...
	// NOTE: we save the detached elements to reuse them on extending,
	//		if needed...
	if(left < 0){
		removed = removed.concat($(images.splice(0, -left)).detach().toArray())
	}
	if(right < 0){
		var l = images.length
		removed = removed.concat($(images.splice(l+right, l)).detach().toArray())
	}
	// calculate the maximum number of new elements left to create...
	cur_len -= removed.length
	len -= cur_len

	// extend...
	// XXX do we need to balance the len between left/right...
	// 		...likely no.
	if (left > 0){
		left = left > len ? len : left
		res.left = createImages(left, removed).prependTo(ribbon)
	}
	if (right > 0){
		right = right > len ? len : right
		res.right = createImages(right, removed).appendTo(ribbon)
	}

	// cleanup...
	$(removed).each(function(){
		getImageMarks($(this)).remove()
	})

	// compensate the position...
	// NOTE: this is fool-proof as it's based on relative visual 
	// 		position...
	//var scale = getElementScale($('.ribbon-set'))
	var l = parseFloat(ribbon.css('left'))
	l = isNaN(l) ? 0 : l
	// compensate for left shift...
	if(!no_compensate_shift && left != 0){
		l -= left * images.outerWidth(true)

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
// NOTE: if extend is non-zero the extension will happen ONLY in the 
// 		direction of the roll...
function rollRibbon(n, ribbon, extend, no_compensate_shift){
	var l = extend == null || n >= 0 ? 0 : extend
	var r = extend == null || n < 0 ? 0 : extend 
	var res = extendRibbon(-n-l, n+r, ribbon, no_compensate_shift)
	return n > 0 ? res.right : res.left
}



/**********************************************************************
* Layout
*/

function focusImage(image){
	image = typeof(image) == typeof('str') ? getImage(image) : image

	image.closest('.viewer').find('.current.image').removeClass('current')
	image.addClass('current')
	$('.viewer').trigger('focusingImage', [image])
	return image
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
	mode = mode == null ? TRANSITION_MODE_DEFAULT : mode

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
		var h = elem.outerHeight(true)
		target.top = t - dt + (H - h)/2,
	} else if(valign == 'top'){
		target.top = t - dt
	} else if(valign == 'bottom'){
		var h = elem.outerHeight(true)
		target.top = t - dt - h
	} 

	if(halign == 'center'){
		var W = container.innerWidth()
		var w = elem.outerWidth(true)
		target.left = l - dl + (W - w)/2
	} else if(halign == 'left'){
		target.left = l - dl
	} else if(halign == 'right'){
		var w = elem.outerWidth(true)
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
// XXX do a version using setElementTransform(...)
function centerView(image, mode){
	mode = mode == null ? TRANSITION_MODE_DEFAULT : mode

	$('.viewer').trigger('preCenteringView', [getRibbon(image), image])

	if(image == null || image.length == 0){
		image = getImage()
	}
	var viewer = $('.viewer')
	// XXX should these be "inner"???
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var ribbons = $('.ribbon-set')
	var scale = getElementScale(ribbons)
	// NOTE: these are scalable, this needs to get normalized...
	var w = image.outerWidth(true)*scale
	var h = image.outerHeight(true)*scale

	var pos = getRelativeVisualPosition(viewer, image)
	//var pos = getRelativeImagePosition(image)

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
// NOTE: image defaults to getImage().
//
// XXX might be good to merge this and centerImage...
// 		...or make a generic centering function...
//
// XXX this does not work in marked-only mode...
// XXX this needs the image to exist... should be GID compatible... (???)
// XXX do a version using setElementTransform(...)
function centerRibbon(ribbon, image, mode){
	mode = mode == null ? TRANSITION_MODE_DEFAULT : mode
	ribbon = ribbon == null ? getRibbon() : $(ribbon)
	image = image == null ? getImage() : $(image)

	$('.viewer').trigger('preCenteringRibbon', [ribbon, image])

	var scale = getElementScale($('.ribbon-set'))
	var target = getImageBefore(image, ribbon, null)
	var offset = 0
	var l = parseFloat(ribbon.css('left'))
	l = !isNaN(l) ? l : 0
	var w = $('.image').outerWidth(true)

	//if(ribbon.find('.image').index(image) >= 0){
	if(ribbon.find('.current.image').length > 0){
		offset = w/2 
	} 

	if(target.length > 0){
		var dl = getRelativeVisualPosition(target, image).left/scale
		l = {
			left: l + dl - (w/2) + offset
		}

	// we are at the start of a ribbon -- nothing before...
	} else {
		// get first image in ribbon...
		target = ribbon.find('.image').first() 
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
function centerRibbons(mode, no_skip_current, no_skip_hidden){
	var R = $('.viewer').height()/2
	var cur = getImage()
	var h = cur.height()

	return $('.ribbon')
		.each(function(){ 
			var ribbon = $(this)

//			// skip empty ribbons...
//			if($(this).find('.image').length == 0){
//				return
//			}

			// skip ribbon containing current image...
			if(no_skip_current == true && ribbon.find('.current.image').length > 0){
				return
			}

			// skip hidden ribbons...
			if(no_skip_hidden != true){
				/* NOTE: this is commented out as it is not really needed now
				 * 		uncomment if a need arises...
				// skip ribbons that are not visible or are not displayed...
				// NOTE: we do not make an attempt to test each and every 
				// 		way a ribbon can be hidden...
				if(ribbon.css('visibility') == 'hidden' 
						|| ribbon.css('display') == 'none'
						|| ribbon.css('opacity') == 0){
					return
				}
				*/

				// skip ribbons outside of the viewer...
				// NOTE: we are accounting for position relative to image... 
				// NOTE: we need to factor in image height as the distance is 
				// 		between cleanly ribbon centers will mean that half 
				// 		hidden ribbons will not get updated...
				var d = Math.abs(getRelativeVisualPosition(cur, ribbon).top)
				if( d - h/2 >= R ){
					return
				}
			}

			centerRibbon(ribbon, null, mode) 
		})
}



/**********************************************************************
* Event handlers...
*/

// NOTE: this is on purpose done relative...
function clickHandler(evt){
	var img = $(evt.target).closest('.image')

	if(img.length > 0){
		centerView(focusImage(img))

		centerRibbons()
	}
}


// XXX this does not work correctly because it also generates two clicks,
// 		and this messes things up...
function dblClickHandler(evt){
	//setTimeout(toggleSingleImageMode, 100)
	toggleSingleImageMode()
	return false
}




/**********************************************************************
* User actions
*/

// basic navigation actions...
function nextImage(n){
	n = n == null ? 1 : n
	var target = getImage().nextAll('.image')
	if(target.length < n){
		target = target.last()
		target = target.length == 0 ? getImage() : target
		// XXX this fires if we hit the end of the currently loaded
		// 		images while scrolling very fast rather than when we are
		// 		out of images in the current ribbon...
		flashIndicator('end')
	} else {
		target = target.eq(n-1)
	}
	return centerView(focusImage(target))
}
function prevImage(n){
	n = n == null ? 1 : n
	var target = getImage().prevAll('.image')
	if(target.length < n){
		target = target.last()
		target = target.length == 0 ? getImage() : target
		// XXX this fires if we hit the end of the currently loaded
		// 		images while scrolling very fast rather than when we are
		// 		out of images in the current ribbon...
		flashIndicator('start')
	} else {
		target = target.eq(n-1)
	}
	return centerView(focusImage(target))
}


function nextScreenImages(){
	return nextImage(Math.floor(getScreenWidthInImages())-1)
}
function prevScreenImages(){
	return prevImage(Math.floor(getScreenWidthInImages())-1)
}


// XXX revise...
function firstImage(){
	$('.viewer').trigger('requestedFirstImage', [getRibbon()])

	// if we are already there, flash the indicator...
	if(getImage().prevAll('.image').length == 0){
		flashIndicator('start')
	}
	return centerView(
		focusImage(
			getRibbon().find('.image').first()))
}
// XXX revise...
function lastImage(){
	$('.viewer').trigger('requestedLastImage', [getRibbon()])

	// if we are already there, flash the indicator...
	if(getImage().nextAll('.image').length == 0){
		flashIndicator('end')
	}
	return centerView(
		focusImage(
			getRibbon().find('.image').last()))
}


// NOTE: if moving is 'next' these will chose the image after the current's order.
// NOTE: if an image with the same order is found, moving argument has no effect.
function prevRibbon(){
	var cur = getImage()
	var target_ribbon = getRibbon(cur).prevAll('.ribbon').first()
	var target = getImageBefore(cur, target_ribbon)

	// no ribbon above...
	if(target_ribbon.length == 0){
		flashIndicator('top')
		target = getImage()
	} else {
		// first image...
		if(target.length == 0){
			target = target_ribbon.find('.image').first()
		
		} else {
			var next = target.nextAll('.image').first()
			target = next.length > 0 ? next : target
		}
	}
	var res = centerView(focusImage(target))
	$('.viewer').trigger('focusedPrevRibbon', [getRibbonIndex()])
	return res
}
function nextRibbon(){
	var cur = getImage()
	var target_ribbon = getRibbon(cur).nextAll('.ribbon').first()
	var target = getImageBefore(cur, target_ribbon)

	// no ribbon below...
	if(target_ribbon.length == 0){
		flashIndicator('bottom')
		target = getImage()
	} else {
		// first image...
		if(target.length == 0){
			target = target_ribbon.find('.image').first()
		}
	}

	var res = centerView(focusImage(target))
	$('.viewer').trigger('focusedNextRibbon', [getRibbonIndex()])
	return res
}



/******************************************************** Rotating ***/

// Compensate for viewer proportioned and rotated images.
//
// This will set the margins so as to make the rotated image offset the
// same space as it is occupying visually...
//
// NOTE: this is not needed for square image blocks.
// NOTE: if an image block is square, this will remove the margins.
function correctImageProportionsForRotation(images, container){
	container = container == null ? $('.viewer') : container

	var W = container.innerWidth()
	var H = container.innerHeight()

	var viewer_p = W > H ? 'landscape' : 'portrait'

	return $(images).each(function(i, e){
		var image = $(this)
		// orientation...
		var o = image.attr('orientation')
		o = o == null ? 0 : o
		var w = image.outerWidth()
		var h = image.outerHeight()

		// non-square image...
		if(w != h){

			var image_p = w > h ? 'landscape' : 'portrait'

			// when the image is turned 90deg/270deg and its 
			// proportions are the same as the screen...
			if((o == 90 || o == 270) && image_p == viewer_p){
				image.css({
					width: h,
					height: w,
				})
				image.css({
					'margin-top': -((w - h)/2),
					'margin-bottom': -((w - h)/2),
					'margin-left': (w - h)/2,
					'margin-right': (w - h)/2,
				})

			} else if((o == 0 || o == 180) && image_p != viewer_p){
				image.css({
					width: h,
					height: w,
				})
				image.css({
					'margin': '',
				})
			}

		// square image...
		} else {
			image.css({
				'margin': '',
			})
		}
	})
}


var _cw = {
	null: 0,
	0: 90,
	90: 180,
	180: 270,
	270: 0,
}

var _ccw = {
	null: 0,
	0: 270,
	90: 0,
	180: 90,
	270: 180,
}

// NOTE: this works only on loaded images, if something more global is
// 		needed, then one should write a GID based version (data.js)
// 		XXX do we need a GID based version?
function rotateImage(direction, image){
	var r_table = direction == 'left' ? _cw : _ccw
	image = image == null ? getImage() : $(image)
	image.each(function(i, e){
		var img = $(this)
		var o = r_table[img.attr('orientation')]
		img.attr('orientation', o)

		// account for proportions...
		correctImageProportionsForRotation(img)
	})

	$('.viewer').trigger('rotating' + direction.capitalize(), [image])

	return image
}


function rotateLeft(image){
	return rotateImage('left', image)
}
function rotateRight(image){
	return rotateImage('right', image)
}



/******************************************************** Flipping ***/

function getImageFlipState(image){
	image = image == null ? getImage() : $(image)
	var state = image.attr('flipped')

	if(state == null){
		return []
	}

	state = state.split(',').map(function(e){ return e.trim() })

	return state
}
function setImageFlipState(image, state){
	image = image == null ? getImage() : $(image)
	
	if(state.length == 0){
		image.removeAttr('flipped')
	} else if(state != null){
		image.attr('flipped', state.join(', '))
	}

	return image
}

// direction can be:
// 	- 'vertical'
// 	- 'horizontal'
//
// NOTE: this works only on loaded images, if something more global is
// 		needed, then one should write a GID based version (data.js)
// 		XXX do we need a GID based version?
function flipImage(direction, image){
	image = image == null ? getImage() : $(image)
	image.each(function(i, e){
		var img = $(this)
		var state = getImageFlipState(img)
		var i = state.indexOf(direction)

		if(i >= 0){
			state.splice(i, 1)
		} else {
			state.push(direction)
		}
		setImageFlipState(image, state)
	})

	$('.viewer').trigger('flipping' + direction.capitalize(), [image])

	return image
}


function flipVertical(image){
	return flipImage('vertical')
}
function flipHorizontal(image){
	return flipImage('horizontal')
}



/***************************************************** Image reset ***/

// Reset to original image state.
//
// This will remove flip and rotation data from an image and show it 
// as-is.
//
// NOTE: this works only on loaded images, if something more global is
// 		needed, then one should write a GID based version (data.js)
// 		XXX do we need a GID based version?
function resetToOriginalImage(image){
	image = image == null ? getImage() : $(image)

	image.each(function(i, e){
		$(e).removeAttr('flipped orientation')
	})

	$('.viewer').trigger('resetToOriginalImage' + direction.capitalize(), [image])
	
	return image
}



/********************************************************* Zooming ***/

// NOTE: n can be a float win obvious meaning -- 1.5 means fit one and 
// 		a half images...
// NOTE: fixed_proportions if true will make this set the size using the 
// 		image square, disregarding actual proportions.
// NOTE: fixed_proportions may result in and image bleading off screen.
function fitNImages(n, fixed_proportions, no_strict_fit){
	var viewer = $('.viewer')

	viewer.trigger('preFittingImages', [n])

	var image = getImage()
	var w = image.outerWidth(true)
	var h = image.outerHeight(true)

	// XXX needs testing -- might be wrong for fit-viewer + different 
	// 		viewer proportions...
	// 		...an exceptionally wide image might blead off screen...
	if(fixed_proportions){
		w = Math.min(w, h)
		h = w
	}

	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var scale = Math.min(W / (w * n), H / h)

	// special case: unless fitting one image to screen, do not fill the
	// whole height...
	// NOTE: we do not need to check width as it's already used for 
	// 		scaling...
	if(!no_strict_fit && n != 1 && h*scale == H){
		scale *= 0.8
	}

	// NOTE: if animating, the next two lines must be animated together...
	setElementScale($('.ribbon-set'), scale)
	centerView(image, 'css')

	viewer.trigger('fittingImages', [n])

	return scale
}


function zoomIn(){
	var w = getScreenWidthInImages()
	if(w > 1){
		w = w / CONFIG.zoom_step_scale
		fitNImages(w >= 1 ? w : 1)
	}
}
function zoomOut(){
	var w = getScreenWidthInImages()
	var max = getScreenWidthInImages(CONFIG.min_image_size)
	if(w <= max){
		w = w * CONFIG.zoom_step_scale
		fitNImages(w <= max ? w : max)
	}
}



/************************************************** Editor Actions ***/
// NOTE: for shiftImageRight/shiftImageLeft see sort.js, as they depend
// 		on data ordering...

function shiftImageTo(image, direction, moving, force_create_ribbon){
	if(image == null){
		image = getImage()
	}

	// account move for direction...
	// XXX get the value from some place more logical than the argument...
	var a = moving == 'prev' ? 'prevAll' : 'nextAll' 
	var b = moving == 'prev' ? 'nextAll' : 'prevAll' 
	var target = image[a]('.image').first()

	target = target.length == 0 ? image[b]('.image').first() : target

	shiftImage(direction, image, force_create_ribbon)

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
	return shiftImageTo(image, 'next', moving, true)
}



/**********************************************************************
* vim:set sw=4 ts=4 :												 */
