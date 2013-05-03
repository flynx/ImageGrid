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
*
*
**********************************************************************/


/**********************************************************************
* Helpers
*/

// XXX need ribbon end indicators...

// XXX might need shift left/right indicators (later)...


function flashIndicator(direction){
	$(direction == 'prev' ? '.up-indicator' : '.down-indicator')
		// NOTE: this needs to be visible in all cases and key press 
		// 		rhythms... 
		.show()
		.delay(20)
		.fadeOut(200)
}


// ...tried to make this as brain-dead-stupidly-simple as possible...
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


// NOTE: in strict mode this will return null if no image is before the
// 		target...
// NOTE: if this can't find an image if an order less, it will return 
// 		the first image in ribbon...
// NOTE: this might return an empty target if the ribbon is empty...
// XXX need tp make this loadable ribbon compatible -- the target may 
// 		not be loaded...
function getImageBefore(image, ribbon, mode, strict){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	image = image == null ? $('.current.image') : $(image)
	if(ribbon == null){
		ribbon = image.closest('.ribbon')
	}
	var images = $(ribbon).find('.image').filter(mode)
	// XXX need to process/format this correctly...
	var order = JSON.parse(image.attr('order'))
	var prev = strict ? [] : images.first()

	images.each(function(){
		if(order < $(this).attr('order')){
			return false
		}
		prev = this
	})

	return $(prev)
}


function shiftTo(image, ribbon){
	var target = getImageBefore(image, ribbon, NAV_ALL)
	var cur_ribbon = image.closest('.ribbon')

	// insert before the first image if nothing is before the target...
	if(target.length == 0){
		image.prependTo($(ribbon))

	} else {
		image.insertAfter(target)
	}

	// if removing last image out of a ribbon, remove the ribbon....
	if(cur_ribbon.find('.image').length == 0){
		cur_ribbon.remove()
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
	var old_ribbon = image.closest('.ribbon')
	var ribbon = old_ribbon[direction]('.ribbon')

	// need to create a new ribbon...
	if(ribbon.length == 0 || force_create_ribbon == true){
		ribbon = createRibbon()['insert' + (direction == 'prev' 
												? 'Before' 
												: 'After')](old_ribbon)
		shiftTo(image, ribbon)
	} else {
		shiftTo(image, ribbon)
	}
	return image
}



/**********************************************************************
* Constructors
*/

// NOTE: to avoid state sync problems this should clone an image if 
//		one is available...
function createImage(n){
	if(n == null){
		if(window._n == null){
			window._n = 0
		}
		n = _n
		_n += 1
	}
	var img = $('.image')
	if(img.length > 0){
		return img.first().clone()
					.attr({
						'order': n,
						// need to strip extra classes...
						'class': 'image'
					})
	} else {
		return $('<div order="'+n+'" class="image"/>')
	}
}

// This will create a set of new images, reusing a list of existing 
// elements if given.
// XXX do we need this???
function createImages(need, have){
	have = have == null ? [] : have

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

function createRibbon(){
	return $('<div class="ribbon"/>')
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
			centerImage(null, 'css')
			return
		} 
		// there is a marked image in this ribbon...
		var target = getImageBefore(cur, null)
		if(target.length > 0){
			centerImage(focusImage(target), 'css')
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
		centerImage(null, 'css')
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
		centerImage(null, 'css')
		return 'viewer'
	}
}


/**********************************************************************
* Layout
*/

function focusImage(image){
	image.closest('.viewer').find('.current.image').removeClass('current')
	return image.addClass('current')
}


/*
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


// This appears to work well with scaling...
// XXX make this more configurable...
function centerImage(image, mode){
	if(mode == null){
		//mode = 'css'
		mode = 'animate'
	}
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

	return image
}


// Center a ribbon...
//
// This behaves differently for different ribbons:
// 	- ribbon containing the target (given) image
// 		center relative to the .viewer via .ribbon-set
// 		calls centerImage(...) directly
// 		both top and left are used...
// 	- any other ribbon
// 		center relative to target (given) via the ribbon left
// 		only left coordinate is changed...
//
// NOTE: image defaults to $('.current.image').
//
// XXX might be good to merge this and centerImage...
// 		...or make a generic centering function...
//
// XXX this produces errors in marked-only mode...
function centerRibbon(ribbon, image, mode){
	if(mode == null){
		//mode = 'css'
		mode = 'animate'
	}
	ribbon = $(ribbon)
	image = image == null ? $('.current.image') : $(image)

	// if centering current ribbon, just center the image...
	if(ribbon.find('.image').index(image) >= 0){
		centerImage(image, mode)
		// XXX should this return a ribbon or the target image???
		return ribbon
	}

	var scale = getElementScale($('.ribbon-set'))
	var target = getImageBefore(null, ribbon, null, true)

	if(target.length > 0){
		var dl = getRelativeVisualPosition(target, image).left/scale
		var l = parseFloat(ribbon.css('left'))
		l = !isNaN(l) ? l : 0
		l = {left: l + dl - ($('.image').outerWidth()/2)}

	} else {
		var dl = getRelativeVisualPosition(
					ribbon.find('.image').filter(NAV_DEFAULT).first(), 
					image).left/scale
		var l = parseFloat(ribbon.css('left'))
		l = !isNaN(l) ? l : 0
		l = {left: l + dl + ($('.image').outerWidth()/2)}
	}

	if(mode == 'animate'){
		ribbon.stop().animate(l, 100, 'linear')
	} else {
		ribbons.css(res)
	}

	// XXX should this return a ribbon or the target image???
	return ribbon
}

// a shorthand...
function centerRibbons(mode){
	return $('.ribbon')
		.filter(':visible')
		.each(function(){ centerRibbon($(this), null, mode) })
}



/**********************************************************************
* Infinite ribbon machinery
*/

// XXX need mechanics to populate the images or to connect such 
//		functionality...
//		...this is to be done in the loader...

// NOTE: negative left or right will contract the ribbon...
function extendRibbon(left, right, ribbon){
	ribbon = ribbon == null ? 
				$('.current.image').closest('.ribbon') 
				: $(ribbon)
	left = left == null ? 0 : left
	right = right == null ? 0 : right
	var images = ribbon.children('.image')
	var removed = []
	var res = {
		left: [],
		right: []
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

	// compensate for the truncation...
	// XXX do we need to split this into a separate function?
	// 		...the rest of the function if pretty generic...
	// XXX for some odd reason this behaves erratically when the page 
	// 		is zoomed...
	if(left != 0){
		var l = parseFloat(ribbon.css('left'))
		l = isNaN(l) ? 0 : l
		ribbon.css({
			left: l + (-left * parseFloat(images.outerWidth()))
		})
	}

	return res
}


// Roll the ribbon n positions to the left.
//
// NOTE: if n is negative the ribbon will be rolled right.
// NOTE: rollRibbon(N, R) is equivalent to extendRibbon(-N, N, R)
// NOTE: this will return a single list of relocated elements...
function rollRibbon(n, ribbon){
	var res = extendRibbon(-n, n, ribbon)
	return n > 0 ? res.right : res.left
}




/**********************************************************************
* User actions
*/

// NOTE: NAV_ALL might not be practical...
var NAV_ALL = '*'
var NAV_VISIBLE = ':visible'
var NAV_MARKED = '.marked:visible'

var NAV_DEFAULT = NAV_VISIBLE


// basic navigation actions...
function nextImage(n, mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	n = n == null ? 1 : n
	var target = $('.current.image').nextAll('.image' + mode)
	target = target.length < n ?  target.last() : target.eq(n-1)
	return centerImage(focusImage(target))
}
function prevImage(n, mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	n = n == null ? 1 : n
	var target = $('.current.image').prevAll('.image' + mode)
	target = target.length < n ? target.last() : target.eq(n-1)
	return centerImage(focusImage(target))
}
function nextScreenImages(mode){
	return nextImage(Math.round(getScreenWidthInImages()), mode)
}
function prevScreenImages(mode){
	return prevImage(Math.round(getScreenWidthInImages()), mode)
}
function firstImage(mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	return centerImage(
		focusImage(
			$('.current.image').closest('.ribbon').find('.image').filter(mode).first()))
}
function lastImage(mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	return centerImage(
		focusImage(
			$('.current.image').closest('.ribbon').find('.image').filter(mode).last()))
}



// NOTE: if moving is 'next' these will chose the image after the current's order.
// NOTE: if an image with the same order is found, moving argument has no effect.
// XXX get move direction...
function prevRibbon(moving, mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	var cur = $('.current.image')
	var target = getImageBefore(cur, cur.closest('.ribbon').prevAll('.ribbon:visible').first())
	if(moving == 'next' && cur.attr('order') != target.attr('order')){
		var next = target.nextAll('.image' + mode).first()
		target = next.length > 0 ? next : target
	}
	return centerImage(focusImage(target))
}
// XXX get move direction...
function nextRibbon(moving, mode){
	if(mode == null){
		mode = NAV_DEFAULT
	}
	var cur = $('.current.image')
	var target = getImageBefore(cur, cur.closest('.ribbon').nextAll('.ribbon:visible').first())
	if(moving == 'next' && cur.attr('order') != target.attr('order')){
		var next = target.nextAll('.image' + mode).first()
		target = next.length > 0 ? next : target
	}
	return centerImage(focusImage(target))
}



// XXX get move direction...
function _shiftImageTo(image, direction, moving, force_create_ribbon, mode){
	if(image == null){
		image = $('.current.image')
	}
	if(mode == null){
		mode = NAV_DEFAULT
	}

	// account move for direction...
	// XXX get the value from some place more logical than the argument...
	var a = moving == 'prev' ? 'prevAll' : 'nextAll' 
	var b = moving == 'prev' ? 'nextAll' : 'prevAll' 
	var target = image[a]('.image' + mode).first()

	target = target.length == 0 ? image[b]().first() : target

	// XXX should this be in here or coupled later via an event???
	flashIndicator(direction)

	shiftImage(direction, image, force_create_ribbon)
	// XXX does this need to be animated???
	return centerImage(focusImage(target), 'css')
}
function shiftImageUp(image, moving){
	return _shiftImageTo(image, 'prev', moving)
}
function shiftImageDown(image, moving){
	return _shiftImageTo(image, 'next')
}
function shiftImageUpNewRibbon(image, moving){
	return _shiftImageTo(image, 'prev', moving, true)
}
function shiftImageDownNewRibbon(image, moving){
	return _shiftImageTo(image, 'prev', moving, false)
}


// TODO manual image ordering (shiftLeft/shiftRight functions)
// XXX

function fitNImages(n){
	var image = $('.current.image')
	var size = image.outerHeight(true)

	var viewer = $('.viewer')
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var scale = Math.min(W / (size * n), H / size)

	// XXX if animating, the next two likes must be animated together...
	setElementScale($('.ribbon-set'), scale)
	centerImage(image, 'css')
}



// Marks...

// XXX if this unmarks an image in marked-only mode no visible image is 
// 		going to be current...
var toggleImageMark = createCSSClassToggler('.current.image', 'marked')

// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		return $('.current.image')
			.closest('.ribbon')
				.find('.marked')
					.removeClass('marked')

	// remove all marks...
	} else if(mode == 'all'){
		return $('.marked')
			.removeClass('marked')
	} 
}

function markAll(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		return $('.current.image')
			.closest('.ribbon')
				.find('.image:not(.marked)')
					.addClass('marked')

	// remove all marks...
	} else if(mode == 'all'){
		return $('.image:not(.marked)').addClass('marked')
	}
}

// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	return $('.current.image')
		.closest('.ribbon')
			.find('.image')
				.toggleClass('marked')
}

// this will toggle marks in the current continuous section of marked 
// or unmarked images...
function toggleImageMarkBlock(image){
	if(image == null){
		image = $('.current.image')
	}
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
* Event handlers...
*/

// NOTE: this is on purpose done relative...
function clickHandler(evt){
	var img = $(evt.target).closest('.image')

	centerImage( focusImage(img) )
}




/**********************************************************************
* vim:set sw=4 ts=4 :												 */
