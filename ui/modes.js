/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// XXX make this save and restore settings...
var toggleSingleImageMode = createCSSClassToggler('.viewer', 
		'single-image-mode',
		function(action){
			if(action == 'on'){
				TRANSITION_MODE_DEFAULT = 'css'
				fitNImages(1)
			} else {
				TRANSITION_MODE_DEFAULT = 'animate'
				toggleImageProportions('square')
				fitNImages(5)
			}
		})


var toggleTheme = createCSSClassToggler('.viewer',
		[
			'gray',
			'dark',
			'light'
		])


// NOTE: this confirmsto the css toggler protocol, but is not implemented 
// 		via createCSSClassToggler as we do not need to set any classes,
// 		al least at this point...
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
* vim:set ts=4 sw=4 :                                                */
