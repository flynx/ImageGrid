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

// Data format...
var DATA = {
	// the ribbon cache...
	// in the simplest form this is a list of lists of GIDs
	ribbons: [
		$(new Array(100)).map(function(i){return i}).toArray()
	],
	// flat ordered list of images in current context...
	// in the simplest form this is a list of GIDs.
	order: $(new Array(100)).map(function(i){return i}).toArray(),
	// the images object, this is indexed by image GID and contains all 
	// the needed data...
	images: {
	}
}


/**********************************************************************
* Helpers
*/

// XXX need ribbon end indicators...

// XXX might need shift left/right indicators (later)...


function flashIndicator(direction){
	$({
		prev: '.up-indicator',
		next: '.down-indicator',
		// XXX not implemented yet...
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


// NOTE: this will return an empty jquery object if no image is before 
// 		the target...
// NOTE: this might return an empty target if the ribbon is empty...
// XXX need tp make this loadable ribbon compatible -- the target may 
// 		not be loaded...
function getImageBefore(image, ribbon, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	image = image == null ? $('.current.image') : $(image)
	if(ribbon == null){
		ribbon = getRibbon(image)
	}
	var images = $(ribbon).find('.image').filter(mode)
	// XXX need to process/format this correctly...
	var order = JSON.parse(image.attr('order'))
	var prev = []

	images.each(function(){
		if(order < JSON.parse($(this).attr('order'))){
			return false
		}
		prev = this
	})

	return $(prev)
}

// same as getImageBefore, but uses gids and searches in DATA...
// XXX check for corner cases...
// XXX getGIDBefore(1, 1) does not work...
function getGIDBefore(gid, ribbon){
	ribbon = DATA.ribbons[ribbon]
	var order = DATA.order

	var target = ribbon.indexOf(gid)

	if(target >= 0){
		return gid
	}

	target = order.indexOf(gid)

	var i = ribbon.length

	while(i > 0){
		i = Math.floor(ribbon.length/2)

		console.log('>>>', target, i, order.indexOf(ribbon[i]), order.indexOf(ribbon[i+1]))

		if(target >= order.indexOf(ribbon[i]) && target < order.indexOf(ribbon[i+1])){
			return ribbon[i]

		// XXX I do not understand why this works correctly, think I need some sleep...
		} else if(target < order.indexOf(ribbon[i])){
			ribbon = ribbon.slice(0, i)

		} else {
			ribbon = ribbon.slice(i)
		}
	}	
	return null
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
		index = direction == 'after' ? index + 1 : index

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
						'order': JSON.stringify(n),
						'gid': JSON.stringify(n),
						// need to strip extra classes...
						'class': 'image'
					})
	} else {
		return $('<div order="'+n+'" gid="'+n+'" class="image"/>')
	}
}

// This will create a set of new images, reusing a list of existing 
// elements if given.
// XXX do we need this???
// XXX add position...
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

function createRibbon(index){
	// make the ribbon...
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

// NOTE: negative left or right will contract the ribbon...
// XXX check what goes on if left/right are far more than length...
function extendRibbon(left, right, ribbon){
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
* Loaders
*/

// NOTE: count can be either hegative or positive, this will idicate 
// 		load direction...
// NOTE: this will not include the 'from' GID in the resulting list...
// NOTE: this can calculate the ribbon number if an image can be only 
// 		in one ribbon...
// NOTE: if an image can be in more than one ribbon, one MUST suply the
// 		correct ribbon number...
// XXX do we need more checking???
function getImageGIDs(from, count, ribbon){
	if(count == 0){
		return []
	}
	// ribbon default value...
	if(ribbon == null){
		$(DATA.ribbons).each(function(i, e){ 
			if(e.indexOf(from) >= 0){ 
				ribbon = i
				return false 
			} 
		})
	}
	// XXX checkif this is empty...
	ribbon = DATA.ribbons[ribbon]

	if(count > 0){
		var start = ribbon.indexOf(from) + 1
		return ribbon.slice(start, start + count)
	} else {
		var end = ribbon.indexOf(from)
		return ribbon.slice((Math.abs(count) >= end ? 0 : end + count), end)
	}
}

function updateImage(image, gid, size){
	image = $(image)
	if(gid == null){
		gid = JSON.parse(image.attr('gid'))
	} else {
		image.attr('gid', JSON.stringify(gid))
	}
	size = size == null ? getVisibleImageSize() : size

	image.attr({
		//order: JSON.stringify(DATA.order.indexOf(gid)),
		order: JSON.stringify(gid) 
		// XXX update attrs 
	})

	// XXX STUB
	image.text(gid)
	// XXX slect best preview by size...
	// XXX
	// XXX update classes...
	// XXX
}


// load count images around a given image/gid into the given ribbon.
//
// NOTE: this will reload the current image elements...
// NOTE: this is similar to extendRibbon(...) but different in interface...
function loadImages(image, count, ribbon){
	// XXX
}


// NOTE: this is signature-compatible with rollRibbon...
// NOTE: this will load data ONLY if it is available, otherwise this 
// 		will have no effect...
// NOTE: this can roll past the currently loaded images (n > images.length)
function rollImages(n, ribbon){
	if(n == 0){
		return $([])
	}
	ribbon = ribbon == null ? getRibbon() : $(ribbon)
	var images = ribbon.find('.image')

	var from = n > 0 ? JSON.parse(ribbon.find('.image').last().attr('gid'))
					: JSON.parse(ribbon.find('.image').first().attr('gid'))
	var gids = getImageGIDs(from, n)
	if(gids.length == 0){
		return $([])
	}
	// truncate the results to the length of images...
	if(n > images.length){
		gids.reverse().splice(images.length)
		gids.reverse()
	} else if(Math.abs(n) > images.length){
		gids.splice(images.length)
	}

	if(n < images.length){
		images = rollRibbon(gids.length * (n > 0 ? 1 : -1), ribbon)
	}

	var size = getVisibleImageSize()
	images.each(function(i, e){
		updateImage($(e), gids[i], size)
	})

	return images
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

	$('.viewer').trigger('centeringRibbon', [getRibbon(image), image])

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
// XXX this does not work in marked-only mode...
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
	var target = getImageBefore(image, ribbon, null)

	if(target.length > 0){
		var dl = getRelativeVisualPosition(target, image).left/scale
		var l = parseFloat(ribbon.css('left'))
		l = !isNaN(l) ? l : 0
		l = {left: l + dl - ($('.image').outerWidth()/2)}

	} else {
		target = ribbon.find('.image').filter(NAV_DEFAULT).first() 
		var dl = getRelativeVisualPosition(target, image).left/scale
		var l = parseFloat(ribbon.css('left'))
		l = !isNaN(l) ? l : 0
		l = {left: l + dl + ($('.image').outerWidth()/2)}
	}

	if(mode == 'animate'){
		ribbon.stop().animate(l, 100, 'linear')
	} else {
		ribbons.css(res)
	}

	$('.viewer').trigger('centeringRibbon', [ribbon, image])

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
* Event handlers...
*/

// NOTE: this is on purpose done relative...
function clickHandler(evt){
	var img = $(evt.target).closest('.image')

	centerImage(focusImage(img))

	centerRibbons()
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
	mode = mode == null ? NAV_DEFAULT : mode
	n = n == null ? 1 : n
	var target = $('.current.image').nextAll('.image' + mode)
	if(target.length < n){
		target = target.last()
		flashIndicator('end')
	} else {
		target = target.eq(n-1)
	}
	return centerImage(focusImage(target))
}
function prevImage(n, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	n = n == null ? 1 : n
	var target = $('.current.image').prevAll('.image' + mode)
	if(target.length < n){
		target = target.last()
		flashIndicator('start')
	} else {
		target = target.eq(n-1)
	}
	return centerImage(focusImage(target))
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
	return centerImage(
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
	return centerImage(
		focusImage(
			getRibbon().find('.image').filter(mode).last()))
}



// NOTE: if moving is 'next' these will chose the image after the current's order.
// NOTE: if an image with the same order is found, moving argument has no effect.
// XXX get move direction...
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
	return centerImage(focusImage(target))
}
// XXX get move direction...
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
	return centerImage(focusImage(target))
}


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




/************************************************** Editor Actions ***/

// XXX add a shift event here...
// XXX get move direction...
function _shiftImageTo(image, direction, moving, force_create_ribbon, mode){
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



/*********************************************************** Marks ***/

// XXX if this unmarks an image in marked-only mode no visible image is 
// 		going to be current...
var toggleImageMark = createCSSClassToggler('.current.image', 'marked')

// mode can be:
//	- 'ribbon'
//	- 'all'
function removeImageMarks(mode){
	// remove marks from current ribbon (default)...
	if(mode == 'ribbon' || mode == null){
		return getRibbon()
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
		return getRibbon()
			.find('.image:not(.marked)')
				.addClass('marked')

	// remove all marks...
	} else if(mode == 'all'){
		return $('.image:not(.marked)').addClass('marked')
	}
}

// NOTE: this only does it's work in the current ribbon...
function invertImageMarks(){
	return getRibbon()
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
* vim:set sw=4 ts=4 :												 */
