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
				fitNImages(DEFAULT_SCREEN_IMAGES)
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
	// normal images...
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

		// account for rotation...
		correctImageProportionsForRotation(image)

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

		// account for rotation...
		correctImageProportionsForRotation(image)

		centerView(null, 'css')
		return 'viewer'
	}

}


var toggleKeyboardHelp = createCSSClassToggler('.viewer', 'help-mode overlay',
		function(action){
			var body = $(document.body)
			var win = $(window)

			// on...
			if(action == 'on'){
				// remove helo when we scroll to the top...
				var scroll_handler = function(){
					if(body.scrollTop() <= 0){
						toggleKeyboardHelp('off')
					}
				}

				// prepare and cleanup...
				$('.keyboard-help').remove()
				$('.viewer').addClass('overlay')

				// build the help...
				var doc = buildKeybindingsHelpHTML(KEYBOARD_CONFIG)
					.css({
						cursor: 'hand',
					})
					.appendTo(body)

				// add exit by click...
				body
					.one('click', function(){
						toggleKeyboardHelp('off')
					})

				// scroll to the help...
				// NOTE: need to set the scroll handler AFTER we 
				// 		scroll down, or it will be more of a 
				// 		tease than a help...
				var t = getRelativeVisualPosition($('.viewer'), doc).top
				body
					.animate({
						scrollTop: Math.abs(t) - 40,
					}, function(){
						win
							.on('scroll', scroll_handler)
					})

			// off...
			} else {
				var _cleanup = function(){
					$('.keyboard-help').remove()
					$('.viewer').removeClass('overlay')
					body.click()
					win.off('scroll', scroll_handler)
				}

				if(body.scrollTop() > 0){
						body
							.animate({
								scrollTop: 0,
							}, _cleanup) 
				} else {
					_cleanup()
				}
			}
		})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
