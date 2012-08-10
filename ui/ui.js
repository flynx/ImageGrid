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



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
