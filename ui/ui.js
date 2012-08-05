/*********************************************************************/

/*
 * The folowing two functions will get the vertical and horizontal 
 * distance components between the pints a and A, centers of the small
 * and large squares respectively.
 * One of the squares is .field and the other is .container, 
 * which is small or big is not important.
 *
 *      +---------------+-------+
 *      |               |       |
 *      |               |       |
 *      |       + a . . | . . . | . +
 *      |       .       |       |   +- getCurrentVerticalOffset(...)
 *      |       .   + A | . . . | . +
 *      +---------------+       |
 *      |       .   .           |
 *      |       .   .           |
 *      |       .   .           |
 *      +-----------------------+
 *              .   .
 *              +-+-+
 *                +------------------- getCurrentHorizontalOffset(...)
 *
 *
 * Adding this distance to margins of one of the sqares will effectively 
 * allign the two points.
 *
 * NOTE: neither function accunts for field margins.
 *
 */

// get the vertical offset of the center of square from center of container
// NOTE: this does not account for field margins
function getCurrentVerticalOffset(image){
	if(image == null){
		image = $('.image.current')
	}

	var scale = getElementScale($('.field'))

	var ribbons = $('.ribbon')
	var ribbon = image.parents('.ribbon')
	var images = ribbon.children('.image')

	// vertical...
	var H = $('.container').height()
	var h = ribbons.outerHeight(true)
	// margin...
	var mh = h - ribbons.outerHeight()
	// current ribbon position (1-based)
	var rn = ribbons.index(ribbon) + 1
	// XXX compensating for margin error buildup... really odd!
	//	...why is this still different for the first three ribbons?!
	//		....sub-pixel error?
	// relative position to field... 
	// XXX is there a better way to get this?
	var t = rn * (h - mh/2)
	
	return -t + H/2 + h/2
}

// get the horizontal offset of the center of square from center of container
// NOTE: this does not account for field margins
function getCurrentHorizontalOffset(image){
	if(image == null){
		image = $('.image.current')
	}

	var ribbon = image.parents('.ribbon')
	var images = ribbon.children('.image')

	var W = $('.container').width()
	var w = images.outerWidth(true)
	// margin...
	// XXX do we need this?
	var mw = w - images.outerWidth()
	// current square position (1-based)
	var sn = images.index(image) + 1
	var l = sn * (w - mw/2)

	return -l + W/2 + w/2
}

function centerSquare(){

	$('.field').css({
		'margin-top': getCurrentVerticalOffset()
	})

	// horizontal...
	alignRibbon()

	centerCurrentImage()
}

function alignRibbon(image, position){
	// default values...
	if(image == null){
		image = $('.image.current')
	}
	if(position == null){
		position = 'center'
	}

	var ribbon = image.parents('.ribbon')

	// account for margined field...
	// NOTE: this enables us to cheat and shift all the ribbons just
	//       by changing field margin-left...
	var cml = parseFloat($('.field').css('margin-left'))
	if(!cml){
		cml = 0
	}
	var h_offset = getCurrentHorizontalOffset(image) - cml
	var w = $('.image').outerWidth(true)

	switch(position){
		case 'before':
			ribbon.css({'margin-left': h_offset - w/2})
			return true
		case 'center':
			ribbon.css({'margin-left': h_offset})
			return true
		case 'after':
			ribbon.css({'margin-left': h_offset + w/2})
			return true
	}
	return false
}

/* Set the transform-origin to the center of the current view...
 */
function centerOrigin(){
	var mt = parseFloat($('.field').css('margin-top'))
	var ml = parseFloat($('.field').css('margin-left'))
	var cml = parseFloat($('.current.ribbon').css('margin-left'))

	var t = parseFloat($('.field').css('top'))
	var l = parseFloat($('.field').css('left'))
	var w = $('.field').width()
	var h = $('.field').height()
	var W = $('.container').width()
	var H = $('.container').height()

	//var ot = mt + H/2 + t
	//var ol = ml + W/2 + l
	
	var ot = -getCurrentVerticalOffset() + H/2 - t
	var ol = -ml + W/2 - l

	$('.field').css({
		'transform-origin': ol + 'px ' + ot + 'px',
		'-o-transform-origin': ol + 'px ' + ot + 'px',
		'-moz-transform-origin': ol + 'px ' + ot + 'px',
		'-webkit-transform-origin': ol + 'px ' + ot + 'px',
		'-ms-transform-origin': ol + 'px ' + ot + 'px'
	})

	// XXX for debugging...
	$('.origin-marker').css({
		'top': ot,
		'left': ol
	})
}



/*********************************************************************/

// XXX need to make this work for % values...
// XXX make this usable as an event handler for .resize(...) event...
function fieldSize(W, H){
	var oW = $('.container').width()
	var oH = $('.container').height()

	var scale = getElementScale($('.field'))

	$('.container').css({
		'width': W,
		'height': H
	})

	// shift the field...
	$('.field').css({
		'margin-top': (parseFloat($('.field').css('margin-top')) + (H-oH)/2), 
		'margin-left': (parseFloat($('.field').css('margin-left')) + (W-oW)/2)
	})
}

function centerCurrentImage(){
	$('.field')
		.css({
			'top': 0,
			'left': 0
		})
		// do this after animations are done...
		.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", centerOrigin)
	// this is repeated intentionally...
	// ...needed for small shifts, while the after-animation event 
	// is for large moves.
	centerOrigin()
}


/*********************************************************************/

// NOTE: this will only return a single scale value...
function getElementScale(elem){
	//var transform = elem.css('transform')
	var vendors = ['o', 'moz', 'ms', 'webkit']
	var transform = elem.css('transform')
	var res

	// go through vendor prefixes... (hate this!)
	if(!transform || transform == 'none'){
		for(var i in vendors){
			transform = elem.css('-' + vendors[i] + '-transform')
			if(transform && transform != 'none'){
				break
			}
		}
	}
	// no transform is set...
	if(!transform || transform == 'none'){
		return 1
	}
	// get the scale value -- first argument of scale/matrix...
	return parseFloat((/(scale|matrix)\(([^,]*),.*\)/).exec(transform)[2])
}
// XXX
function setElementScale(elem, scale){
}

function scaleContainerBy(factor){
	var scale = getElementScale($('.field'))*factor 

	setContainerScale(scale)
}

function setContainerScale(scale){
	var H = $('.container').height()
	var W = $('.container').width()

	$('.field').css({
		'transform': 'scale('+scale+', '+scale+')',
		'-moz-transform': 'scale('+scale+', '+scale+')',
		'-o-transform': 'scale('+scale+', '+scale+')',
		'-ms-transform': 'scale('+scale+', '+scale+')',
		'-webkit-transform': 'scale('+scale+', '+scale+')',
	})
}

function fitImage(){
	var H = $('.container').height()
	var W = $('.container').width()

	var h = $('.image.current').height()
	var w = $('.image.current').width()

	var f = Math.min(H/h, W/w)

	setContainerScale(f)
}

function fitThreeImages(){
	var H = $('.container').height()
	var W = $('.container').width()

	var h = $('.image.current').height()
	// NOTE: this is cheating, need to get actual three widths...
	var w = $('.image.current').width()*3

	var f = Math.min(H/h, W/w)

	setContainerScale(f)
}

