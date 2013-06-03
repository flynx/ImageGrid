/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true




/**********************************************************************
* Utils...
*/

// NOTE: this expects a certain structure, this it is not generic...
//function makeDrawerToggler(contentRenderer, root, element_class, mode_class){
function makeDrawerToggler(contentRenderer, root){
	var element_class = '.drawer-block'
	var toggler = createCSSClassToggler(root, 'drawer-mode overlay',
			function(action){
				// XXX
				var body = $(document.body)
				var win = $(window)

				// on...
				if(action == 'on'){
					// remove helo when we scroll to the top...
					var scroll_handler = function(){
						if(body.scrollTop() <= 0){
							toggler('off')
						}
					}

					// prepare and cleanup...
					$(element_class).remove()
					$(root).addClass('overlay')

					// build the help...
					var doc = contentRenderer()
						.addClass(element_class.replace('.', ' '))
						.on('click', function(){
							event.stopImmediatePropagation()
							return false
						})
						.css({
							cursor: 'auto',
						})
						// XXX depends on body...
						.appendTo(body)

					// add exit by click...
					// XXX depends on body...
					body
						.one('click', function(){
							toggler('off')
						})
						.css({
							cursor: 'hand',
						})

					// scroll to the help...
					// NOTE: need to set the scroll handler AFTER we 
					// 		scroll down, or it will be more of a 
					// 		tease than a help...
					var t = getRelativeVisualPosition($(root), doc).top
					body
						.animate({
							scrollTop: Math.abs(t) - 40,
						}, function(){
							// XXX depends on window...
							win
								.on('scroll', scroll_handler)
						})

				// off...
				} else {
					// things to cleanup...
					var _cleanup = function(){
						$(element_class).remove()
						$(root).removeClass('overlay')
						// XXX depends on body...
						body.click()
						win.off('scroll', scroll_handler)
					}

					// animate things if we are not at the top...
					if(body.scrollTop() > 0){
							// XXX depends on body...
							body
								.css({
									cursor: '',
								})
								.animate({
									scrollTop: 0,
								}, _cleanup) 

					// if we are at the top do things fast...
					} else {
						_cleanup()
					}
				}
			})
	return toggler
}



/**********************************************************************
* Modes
*/

// XXX make this save and restore settings...
var toggleSingleImageMode = createCSSClassToggler('.viewer', 
		'single-image-mode',
		function(action){
			// prevent reiniting...
			if(action == toggleSingleImageMode('?')){
				return false
			}
		},
		function(action){
			var w = getScreenWidthInImages()

			// single image mode...
			if(action == 'on'){
				TRANSITION_MODE_DEFAULT = 'css'

				// save things...
				SETTINGS['screen-images-ribbon-mode'] = w
				SETTINGS['image-info-ribbon-mode'] = toggleImageInfo('?')

				// load things...
				w = SETTINGS['screen-images-single-image-mode']
				w = w == null ? 1 : w
				var p = SETTINGS['single-image-mode-proportions']
				p = p == null ? 'square' : p

				// set stuff...
				toggleImageProportions(p)
				fitNImages(w)
				toggleImageInfo('off')

			// ribbon mode...
			} else {
				TRANSITION_MODE_DEFAULT = 'animate'

				// save things...
				SETTINGS['screen-images-single-image-mode'] = w
				SETTINGS['single-image-mode-proportions'] = toggleImageProportions('?')

				// load things...
				w = SETTINGS['screen-images-ribbon-mode']
				w = w == null ? DEFAULT_SCREEN_IMAGES : w

				toggleImageProportions('fit-square')
				fitNImages(w)
				var i = SETTINGS['image-info-ribbon-mode'] == 'on' ? 'on' : 'off'
				toggleImageInfo(i)
				SETTINGS['image-info-ribbon-mode'] = i
			}
		})


var SLIDESHOW_INTERVAL = 3000
var SLIDESHOW_LOOP = true
var SLIDESHOW_DIRECTION = 'next'

// TODO transitions...
// TODO a real setup UI (instead of prompt)
var toggleSlideShowMode = createCSSClassToggler('.viewer', 
		'.slideshow-mode',
		function(action){
			if(action == 'on'){
				updateStatus('Slideshow...').show()

				// interval from user...
				// XXX make this a real UI...
				var interval = prompt('Slideshow interval (sec):', SLIDESHOW_INTERVAL/1000)

				// user cancelled...
				if(interval == null){
					showStatus('Slideshow: cencelled...')
					toggleSlideShowMode('off')
					return 
				}

				SLIDESHOW_INTERVAL = isNaN(interval) ? 3000 : interval*1000

				showStatus('Slideshow: starting', SLIDESHOW_LOOP ? 'looped...' : 'unlooped...')

				toggleSingleImageMode('on')
				_slideshow_timer = setInterval(function(){
					var cur = getImage()
					// advance the image...
					var next = SLIDESHOW_DIRECTION == 'next' ? nextImage() : prevImage()

					// handle slideshow end...
					if(getImageGID(cur) == getImageGID(next)){
						if(SLIDESHOW_LOOP){
							SLIDESHOW_DIRECTION == 'next' ? firstImage() : lastImage()
						} else {
							toggleSlideShowMode('off')
							return 
						}
					}

					// center and trigger load events...
					centerRibbon()
				}, SLIDESHOW_INTERVAL)

			} else {
				window._slideshow_timer != null && clearInterval(_slideshow_timer)
				showStatus('Slideshow: stopped...')
			}
		})


var toggleTheme = createCSSClassToggler('.viewer',
		[
			'gray',
			'dark',
			'light'
		],
		// XXX does this get called for default state (gray)???
		function(action){
			SETTINGS['theme'] = action
		})


var toggleImageInfo = createCSSClassToggler('.viewer',
		'.image-info-visible',
		function(action){
			if(toggleSingleImageMode('?') == 'off'){
				SETTINGS['image-info-ribbon-mode'] = action
			}
		})


var toggleInlineImageInfo = createCSSClassToggler('.viewer', 
		'.image-info-inline-visible',
		function(action){
			if(action == 'on'){
				$(document)
					.on('mouseover', inlineImageInfoHoverHandler)
			} else {
				$(document)
					.off('mouseover', inlineImageInfoHoverHandler)
					$('.inline-image-info').remove()
			}
		})


// NOTE: this confirmsto the css toggler protocol, but is not implemented 
// 		via createCSSClassToggler as we do not need to set any classes,
// 		al least at this point...
// XXX should we use the createCSSClassToggler for this?
// XXX revise: does extra stuff...
/*
function toggleImageProportions(mode){
	// normal images...
	var image = $('.image')
	var h = image.outerHeight(true)
	var w = image.outerWidth(true)

	if(mode == '?'){
		return h != w ? 'viewer' : 'square'

	// square...
	} else if(h != w || mode == 'square'){
		mode = 'square'
		var size = Math.min(w, h)
		image.css({
			width: size,
			height: size
		})

		// account for rotation...
		correctImageProportionsForRotation(image)

		centerView(null, 'css')

	// viewer size...
	} else {
		mode = 'viewer'
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
	}

	return mode
}
*/

var toggleImageProportions = createCSSClassToggler('.viewer',
		[
			'fit-square',
			'fit-viewer'
		],
		function(action){
			var image = $('.image')
			var h = image.outerHeight(true)
			var w = image.outerWidth(true)

			// viewer proportions...
			if(action == 'fit-viewer'){
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

			// square proportions...
			} else {
				var size = Math.min(w, h)
				image.css({
					width: size,
					height: size
				})

				// account for rotation...
				correctImageProportionsForRotation(image)
				centerView(null, 'css')
			}
		})


var toggleHelp = makeDrawerToggler(
		function(){
			// XXX populate...
			// 		...load from file.
			return $('<h1>Help</h1>')
		}, '.viewer')


var toggleKeyboardHelp = makeDrawerToggler(
		function(){
			return buildKeybindingsHelpHTML(KEYBOARD_CONFIG)
		}, '.viewer')


var toggleOptionsUI = makeDrawerToggler(
		function(){
			// XXX populate...
			return $('<h1>Options</h1>')
		}, '.viewer')


// XXX needs styling and cleanup...
// XXX add a preview...
var toggleImageInfoDrawer = makeDrawerToggler(
		function(){
			var gid = getImageGID(getImage())
			var r = getRibbonIndex(getRibbon())
			var data = IMAGES[gid]
			var orientation = data.orientation
			orientation = orientation == null ? 0 : orientation
			var order = DATA.order.indexOf(gid)
			var name = data.path.split('/').pop()

			return $('<div>'+
					'<h1>"'+ name +'"</h1>'+

					'Orientation: '+ orientation +'deg<br>'+
					'GID: '+ gid +'<br>'+
					'Path: "'+ data.path +'"<br>'+
					'Order: '+ order +'<br>'+
					'Position (ribbon): '+ (DATA.ribbons[r].indexOf(gid)+1) +
						'/'+ DATA.ribbons[r].length +'<br>'+
					'Position (global): '+ (order+1) +'/'+ DATA.order.length +'<br>'+
				'</div>')
		}, '.viewer')



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
