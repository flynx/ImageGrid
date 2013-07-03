/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var SLIDESHOW_INTERVAL = 3000
var SLIDESHOW_LOOP = true
var SLIDESHOW_DIRECTION = 'next'



/**********************************************************************
* Utils...
*/

// NOTE: this expects a certain structure, this it is not generic...
//function makeDrawerToggler(contentRenderer, root, element_class, mode_class){
function makeDrawerToggler(contentRenderer, root){
	var element_class = '.drawer-block'
	var toggler = createCSSClassToggler(
			root, 
			'drawer-mode overlay',
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
					showInOverlay($(root))

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
						hideOverlay($(root))
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
var toggleSingleImageMode = createCSSClassToggler(
		'.viewer', 
		'single-image-mode',
		function(action){
			// prevent reentering...
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
				SETTINGS['ribbon-mode-screen-images'] = w
				SETTINGS['ribbon-mode-image-info'] = toggleImageInfo('?')

				// load things...
				w = SETTINGS['single-image-mode-screen-images']
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
				SETTINGS['single-image-mode-screen-images'] = w
				SETTINGS['single-image-mode-proportions'] = toggleImageProportions('?')

				// load things...
				w = SETTINGS['ribbon-mode-screen-images']
				w = w == null ? DEFAULT_SCREEN_IMAGES : w

				toggleImageProportions('none')
				fitNImages(w)
				var i = SETTINGS['ribbon-mode-image-info'] == 'on' ? 'on' : 'off'
				toggleImageInfo(i)
				SETTINGS['ribbon-mode-image-info'] = i

				centerRibbons()
			}
		})


// XXX make this not conflict with marked-only-mode, better yet, make them
// 		one single mode...
var toggleSingleRibbonMode = createCSSClassToggler(
		'.viewer',
		'single-ribbon-mode cropped-mode',
		function(action){
			// prevent reentering...
			if(action == 'on' && $('.viewer').hasClass('cropped-mode')
					|| action == toggleSingleRibbonMode('?')){
				return false
			}
		},
		function(action){
			if(action == 'on'){
				ALL_DATA = cropDataToGIDs(DATA.ribbons[getRibbonIndex()].slice())
			} else {
				var cur = DATA.current
				DATA = ALL_DATA
				DATA.current = cur
				reloadViewer()
				updateImages()
			}
		})


// TODO transitions...
// TODO a real setup UI (instead of prompt)
var toggleSlideShowMode = createCSSClassToggler(
		'.viewer', 
		'.slideshow-mode',
		function(action){
			if(action == 'on'){
				updateStatus('Slideshow...').show()

				// interval from user...
				//var interval = prompt('Slideshow interval (sec):', SLIDESHOW_INTERVAL/1000)
				formDialog($('.viewer'), 'Slideshow', {
						'Interval': (SLIDESHOW_INTERVAL/1000) + 'sec',
						'Looping': SLIDESHOW_LOOP ? true : false,
						'Reverse direction': SLIDESHOW_DIRECTION == 'prev' ? true : false
				}, 'Start')
					.done(function(data){
						var looping = data['Looping']
						var reverse = data['Reverse direction']

						SLIDESHOW_LOOP = looping
						SLIDESHOW_DIRECTION = reverse == true ? 'prev' : 'next'

						// parse interval...
						var interval_raw = data['Interval']
						// units...
						var M = 1000
						if(/ms|msec|milsec|millisecond[s]/i.test(interval_raw)){
							M = 1
						} else if(/(s|sec|second[s])/i.test(interval_raw)){
							M = 1000
						} else if(/m|min|minute[s]/i.test(interval_raw)){
							M = 1000*60
						}
						// fractions...
						if(/[0-9]+\/[0-9]+/.test(interval_raw)){
							var parts = interval_raw.split('/')
							var interval = parseFloat(parts[0]) / parseFloat(parts[1])
						} else {
							var interval = parseFloat(interval_raw)
						}
						SLIDESHOW_INTERVAL = isNaN(interval) ? 3000 : interval*M

						console.log('>>>', data, interval)

						showStatus('Slideshow: starting:', SLIDESHOW_INTERVAL/1000 +'sec,', SLIDESHOW_LOOP ? 'looped...' : 'unlooped...')
					
						// XXX is this the correct way to go???
						hideOverlay($('.viewer'))

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
					})
					// user cancelled...
					.fail(function(){
						toggleSlideShowMode('off')
					})

			} else {
				window._slideshow_timer != null && clearInterval(_slideshow_timer)
				showStatus('Slideshow: canceled.')
				hideOverlay($('.viewer'))
			}
		})


var toggleTheme = createCSSClassToggler(
		'.viewer',
		[
			'gray',
			'dark',
			'light'
		],
		// XXX does this get called for default state (gray)???
		function(action){
			SETTINGS['global-theme'] = action
		})


var toggleImageInfo = createCSSClassToggler(
		'.viewer',
		'.image-info-visible',
		function(action){
			if(toggleSingleImageMode('?') == 'off'){
				SETTINGS['ribbon-mode-image-info'] = action
			}
		})


var toggleInlineImageInfo = createCSSClassToggler(
		'.viewer', 
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


var toggleImageProportions = createCSSClassToggler(
		'.viewer',
		[
			'none',
			'fit-viewer'
		],
		function(action){
			// prevent reentering...
			if(action == toggleImageProportions('?')){
				return false
			}
		},
		function(action){
			var image = $('.image')
			var h = image.outerHeight(true)
			var w = image.outerWidth(true)

			// viewer proportions...
			// XXX going into here twice for a rotated 90/270 image will 
			// 		set it back to square...
			// 		...can't even begin to imagine what can affect this!
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
