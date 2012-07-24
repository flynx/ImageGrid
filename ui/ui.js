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

	var zoom = $('.field').css('zoom')

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

	var zoom = $('.field').css('zoom')

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
			ribbon.css({'margin-left': h_offset + w/2})
			return true
		case 'center':
			ribbon.css({'margin-left': h_offset})
			return true
		case 'after':
			ribbon.css({'margin-left': h_offset - w/2})
			return true
	}
	return false
}



/*********************************************************************/

// XXX need to make this work for % values...
// XXX make this usable as an event handler for .resize(...) event...
function fieldSize(W, H){
	var oW = $('.container').width()
	var oH = $('.container').height()

	var zoom = $('.field').css('zoom')

	$('.container').css({
		'width': W,
		'height': H
	})

	// shift the field...
	$('.field').css({
		// compensate top/left that get changed while zooming....
		'top': H/2 * 1/zoom - H/2, 
		'left': W/2 * 1/zoom - W/2, 

		'margin-top': (parseFloat($('.field').css('margin-top')) + (H-oH)/2), 
		'margin-left': (parseFloat($('.field').css('margin-left')) + (W-oW)/2)
	})
}


/*********************************************************************/

// XXX need to fix animation jumping around... 
// XXX try transition-origin instead of compensating by moving...
function zoomContainerBy(factor){
	var zoom = $('.field').css('zoom')*factor 

	setContainerZoom(zoom)
}

function setContainerZoom(zoom){
	var H = $('.container').height()
	var W = $('.container').width()

	$('.field').css({
		'zoom': zoom,
		// this only shifts to account for zoom/scale change...
		// ...we need to factor in the position of .current within the field
		'top': H/2 * 1/zoom - H/2, 
		'left': W/2 * 1/zoom - W/2 
	})
}

function fitImage(){
	var H = $('.container').height()
	var W = $('.container').width()

	var h = $('.image.current').height()
	var w = $('.image.current').width()

	var f = Math.min(H/h, W/w)

	setContainerZoom(f)
}

function fitThreeImages(){
	var H = $('.container').height()
	var W = $('.container').width()

	var h = $('.image.current').height()
	// XXX cheating, need to get three widths...
	var w = $('.image.current').width()*3

	var f = Math.min(H/h, W/w)

	setContainerZoom(f)
}

