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
var NAV_DEFAULT = NAV_ALL

var NAV_RIBBON_ALL = ''
var NAV_RIBBON_VISIBLE = ':visible'
var NAV_RIBBON_DEFAULT = NAV_RIBBON_ALL
//var NAV_RIBBON_DEFAULT = NAV_RIBBON_VISIBLE

var TRANSITION_MODE_DEFAULT = 'animate'

var MAX_SCREEN_IMAGES = 12
var ZOOM_SCALE = 1.2



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
		.delay(100)
		.fadeOut(300)
}


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


function getRibbon(image){
	image = image == null ? getImage() : $(image)
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


// Calculate relative position between two elements
//
// NOTE: tried to make this as brain-dead-stupidly-simple as possible...
//		...looks spectacular comparing to either gen2 or gen1 ;)
// NOTE: if used during an animation/transition this will give the 
// 		position at the exact frame of the animation, this might not be
// 		the desired "final" data...
// XXX account for rotated images...
// 		need to keep this generic but still account for rotation...
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
function getScreenWidthInImages(size){
	size = size == null ? getVisibleImageSize() : size
	return $('.viewer').innerWidth() / size
}


// NOTE: this will return an empty jquery object if no image is before 
// 		the target...
// NOTE: this might return an empty target if the ribbon is empty...
// NOTE: this only "sees" the loaded images, for a full check use 
// 		getGIDBefore(...) that will check the full data...
function getImageBefore(image, ribbon, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	image = image == null ? getImage() : $(image)
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


// Update an info element
//
// align can be:
// 	- top
// 	- bottom
//
// If target is an existing info container (class: overlay-info) then 
// just fill that.
function updateInfo(elem, data, target){
	var viewer = $('.viewer')
	target = target == null ? viewer : $(target)
	elem = elem == null ? $('.overlay-info') : $(elem)

	if(elem.length == 0){
		elem = $('<div/>')
	}

	elem
		.addClass('overlay-info')
		.html('')
		.off()

	if(typeof(data) == typeof('abc')){
		elem.html(data)
	} else {
		elem.append(data)
	}

	return elem 
		.appendTo(target)
}


function showInfo(elem, data, target){
	elem = elem == null ? $('.overlay-info') : elem
	elem = data == null ? elem : updateInfo(elem, data, traget)
	return elem.fadeIn()
}


function hideInfo(elem){
	elem = elem == null ? $('.overlay-info') : elem
	return elem.fadeOut()
}


// Update status message
//
// NOTE: this will update message content and return it as-is, things 
// 		like showing the message are to be done manually...
// 		see: showStatus(...) and showErrorStatus(...) for a higher level
// 		API...
// NOTE: in addition to showing user status, this will also log the 
// 		satus to browser console...
// NOTE: the message will be logged to console via either console.log(...)
// 		or console.error(...), if the message starts with "Error".
// NOTE: if message is null, then just return the status element...
//
// XXX add abbility to append and clear status...
function updateStatus(message){

	var elem = $('.global-status')
	if(elem.length == 0){
		elem = $('<div class="global-status"/>')
	}
	if(message == null){
		return elem
	}

	if(typeof(message) == typeof('s') && /^error.*/i.test(message)){
		console.error.apply(console, arguments)
	} else {
		console.log.apply(console, arguments)
	}

	if(arguments.length > 1){
		message = Array.apply(Array, arguments).join(' ')
	}

	return updateInfo(elem, message)
}


// Same as updateInfo(...) but will aslo show and animate-close the message
function showStatus(message){
	return updateStatus.apply(null, arguments)
		.stop()
		.show()
		.delay(500)
		.fadeOut(800)
}


// Same as showStatus(...) but will always add 'Error: ' to the start 
// of the message
//
// NOTE: this will show the message but will not hide it.
function showErrorStatus(message){
	message = Array.apply(Array, arguments)
	message.splice(0, 0, 'Error:')
	return updateStatus.apply(null, message)
		.one('click', function(){ $(this).fadeOut() })
		.stop()
		.show()
}


// shorthand methods...
function hideStatus(){
	// yes, this indeed looks funny -- to hide a status you need to show
	// it without any arguments... ;)
	return showStatus()
}
function getStatus(){
	return updateStatus()
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
		.filter('*' + NAV_RIBBON_DEFAULT)
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

	if(img.filter(NAV_VISIBLE).length > 0){
		centerView(focusImage(img))

		centerRibbons()
	}
}


// XXX for some reason this messes up alignment for the initial view...
function dblClickHandler(evt){
	toggleSingleImageMode()
}




/**********************************************************************
* User actions
*/

// basic navigation actions...
function nextImage(n, mode){
	mode = mode == null ? NAV_DEFAULT : mode
	n = n == null ? 1 : n
	var target = getImage().nextAll('.image' + mode)
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
	var target = getImage().prevAll('.image' + mode)
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
	if(getImage().prevAll('.image' + mode).length == 0){
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
	if(getImage().nextAll('.image' + mode).length == 0){
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
function prevRibbon(mode){
	mode = mode == null ? NAV_DEFAULT : mode
	var cur = getImage()
	var target = getImageBefore(cur, 
			getRibbon(cur).prevAll('.ribbon' + NAV_RIBBON_DEFAULT).first())

	// first image...
	if(target.length == 0){
		// XXX too complex???
		target = getRibbon(cur)
					.prevAll('.ribbon' + NAV_RIBBON_DEFAULT).first()
						.find('.image' + mode).first()
	
	} else {
		var next = target.nextAll('.image' + mode).first()
		target = next.length > 0 ? next : target
	}
	return centerView(focusImage(target))
}
function nextRibbon(mode){
	mode = mode == null ? NAV_DEFAULT : mode
	var cur = getImage()
	var target = getImageBefore(cur, 
			getRibbon(cur).nextAll('.ribbon' + NAV_RIBBON_DEFAULT).first())

	// first image...
	if(target.length == 0){
		// XXX too complex???
		target = getRibbon(cur)
					.nextAll('.ribbon' + NAV_RIBBON_DEFAULT).first()
						.find('.image' + mode).first()
	}
	return centerView(focusImage(target))
}



/******************************************************** Rotating ***/

function correctImageProportionsForRotation(images){
	var viewer = $('.viewer')
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()
	// NOTE: this is here because we are comparing proportions of two 
	// 		very differently sized elements, and though the proportions 
	// 		may be the same, the actual result may be vastly different
	// 		due of pixel rounding...
	// 			Real example:
	// 				Viewer:	826x601
	// 				Image: 413x300
	// 					ratio 1:  W/H - w/h = -0.002290626733222556
	// 					ratio 2: W/w - H/h = -0.0033333333333334103
	// NOTE: this might get out of hand for close to square viewer...
	// 		...one way to cheat out of this is to round any ratio
	// 		close to 1 to 1.
	// XXX find a better way out of this, avoiding floats...
	var rounding_error = 0.007

	$(images).each(function(i, e){
		var image = $(this)
		// orientation...
		var o = image.attr('orientation')
		o = o == null ? 0 : o
		var w = image.outerWidth()
		var h = image.outerHeight()

		if(w != h){
			var proportions = W/H - w/h

			// when the image is turned 90deg/270deg and its 
			// proportions are the same as the screen...
			if((o == 90 || o == 270) && Math.abs(proportions) < rounding_error ){
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
			} else if((o == 0 || o == 180) && Math.abs(proportions) > rounding_error ){
				image.css({
					width: h,
					height: w,
				})
				image.css({
					'margin': '',
				})
			}

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

function rotateImage(direction, image){
	var r_table = direction == 'left' ? _cw : _ccw
	image = image == null ? getImage() : $(image)
	image.each(function(i, e){
		var img = $(this)
		var o = r_table[img.attr('orientation')]
		img.attr('orientation', o)

		// account for proportions...
		correctImageProportionsForRotation(img, direction)
	})

	$('.viewer').trigger('rotating' + direction.capitalize(), [image])
}


function rotateLeft(image){
	rotateImage('left', image)
}
function rotateRight(image){
	rotateImage('right', image)
}



/******************************************************** Flipping ***/

function flipVertical(image){
	// XXX
}


function flipHorizontal(image){
	// XXX
}



/********************************************************* Zooming ***/

function fitNImages(n){
	var image = getImage()
	var w = image.outerWidth(true)
	var h = image.outerHeight(true)

	var viewer = $('.viewer')
	var W = viewer.innerWidth()
	var H = viewer.innerHeight()

	var scale = Math.min(W / (w * n), H / h)

	// NOTE: if animating, the next two likes must be animated together...
	setElementScale($('.ribbon-set'), scale)
	centerView(image, 'css')

	$('.viewer').trigger('fittingImages', [n])
}


// NOTE: here we measure image height as width may change depending on 
// 		proportions...
function zoomIn(){
	//var w = getScreenWidthInImages(getVisibleImageSize('height'))
	var w = getScreenWidthInImages()
	if(w > 1){
		w = w / ZOOM_SCALE
		fitNImages(w >= 1 ? w : 1)
	}
}
function zoomOut(){
	//var w = getScreenWidthInImages(getVisibleImageSize('height'))
	var w = getScreenWidthInImages()
	if(w <= MAX_SCREEN_IMAGES){
		w = w * ZOOM_SCALE
		fitNImages(w <= MAX_SCREEN_IMAGES ? w : MAX_SCREEN_IMAGES)
	}
}



/************************************************** Editor Actions ***/

function shiftImageTo(image, direction, moving, force_create_ribbon, mode){
	if(image == null){
		image = getImage()
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




/**********************************************************************
* vim:set sw=4 ts=4 :												 */
