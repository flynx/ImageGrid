/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')



/*********************************************************************/
//
// Change image proportions depending on scale...
//
// A) Small image -- min(screenwidth, screenheight) > threshold
//
//       viewer
//      +---------------+
//      |     image     |   - small image
//      |     +---+     |   - square image block
//      |     |   |     |   - smaller than this the block is always square
//      |     +---+     |   - we just change scale
//      |               |
//      +---------------+
//
//
// B) min(screenwidth, screenheight) <= threshold
//
//       viewer
//      +---------------+
//      | +-----------+ |   - bigger image
//      | | image     | |   - block close to viewer proportion
//      | |    <-->   | |   - image block growing parallel to viewer
//      | |           | |     longer side
//      | +-----------+ |   - this stage is not affected specific by image
//      +---------------+     proportions and can be done in bulk
//
//
// C) fullscreen -- min(screenwidth, screenheight) == 1
//
//       viewer
//      +---------------+
//      | image         |   - image block same size as viewer
//      |               |   - need to account for chrome
//      |               |
//      |               |
//      |               |
//      +---------------+
//
//
// D) zoomed in -- min(screenwidth, screenheight) < 1 (blocked, no drag)
//
//     image
//    + - - - - - - - - - +
//    .                   .
//    . +---------------+ .
//    . | viewer        | . - image bigger than viewer 
//    . |               | . - image block same proportion as image
//    . |               | . - we just change scale
//    . |               | . - drag enabled (XXX not implemented)
//    . |               | . - next/prev image keeps drag position
//    . +---------------+ .
//    .                   . - use tiles instead very large images (XXX ???)
//    + - - - - - - - - - +
//
//
// NOTE: this in part does the same job as .ribbons.correctImageProportionsForRotation(..)
//

var SingleImageActions = actions.Actions({
	config: {
		// View scale...
		//
		// NOTE: these will get overwritten if/when the user changes the scale...
		'single-image-scale': 1.2,
		'ribbon-scale': 5,

		// Set scale 'units' for different viewes...
		//
		// NOTE: the units are actually properties used to get/set the values.
		'single-image-scale-unit': 'screenfit',
		'ribbon-scale-unit': 'screenwidth',

		// The threshold from which the image block starts to tend to 
		// screen proportions...
		// 	- Above this the block is square.
		// 	- At 1 the block is the same proportions as the screen.
		// 	- between this and 1 the block is proportionally between a
		// 		square and screen proportions.
		//
		// NOTE: setting this to null or to -1 will disable the feature...
		'single-image-proportions-threshold': 2,

		// XXX HACK...
		'-single-image-redraw-on-focus': true,
	},

	updateImageProportions: ['- Interface/',
		function(){
			var that = this
			var threshold = this.config['single-image-proportions-threshold']

			if(!threshold || threshold == -1){
				return
			}

			var viewer = this.ribbons.viewer
			var img = this.ribbons.getImage()

			var w = img.outerWidth()
			var h = img.outerHeight()

			// inner diameter
			var di = Math.min(h, w)
			// outer diameter -- (m)ax
			var dm = Math.max(h, w)
			
			//var c = Math.min(this.screenwidth, this.screenheight)
			var c = this.screenfit 

			// change proportions...
			if(c < threshold){
				var images = viewer.find('.ribbon .image')

				var W = viewer.width()
				var H = viewer.height()

				// inner diameter
				var Di = Math.min(W, H)
				// outer diameter -- (m)ax
				var Dm = Math.max(W, H)


				// get dimensional scale....
				var s = Di / di 
				// image dimension delta...
				var d = 
					// the maximum difference between image and screen proportions...
					(Dm / s - di) 
						// coefficient: 0 : c == threshold  ->  1 : c == 1
						* (threshold/c - 1)
				// new size...
				var n = di + d

				// the amount to compensate ribbon offset for per image...
				var x = n - dm


				if(n == dm){
					return
				}

				getAnimationFrame(function(){
					that.ribbons.preventTransitions()

					// horizontal viewer...
					if(Di == H){
						var a = 'width'
						var b = 'height'

					// vertical viewer...
					} else {
						var a = 'height'
						var b = 'width'
					}

					images
						.each(function(_, img){
							var o = img.getAttribute('orientation')
							o = o == null ? 0 : o

							// rotated images...
							if(o == 90 || o == 270){
								img.style[a] = ''
								img.style[b] = n + 'px'

								img.style.margin = -(n - di)/2 +'px '+ (n - di)/2 +'px'

							} else {
								img.style[a] = n + 'px'
								img.style[b] = ''

								img.style.margin = ''
							}
						})
				
					that.ribbons
						.centerImage()
						.restoreTransitions(true)
				})

			// reset proportions to square...
			} else if(w != h) {
				var images = viewer.find('.ribbon .image')

				getAnimationFrame(function(){
					that.ribbons.preventTransitions()

					images
						.each(function(_, img){
							img.style.width = ''
							img.style.height = ''

							img.style.margin = ''
						})

					that.ribbons
						.centerImage()
						.restoreTransitions(true)
				})
			}
		}],


	toggleSingleImage: ['Interface/Toggle single image view', 
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			'single-image-mode',
			function(state){
				if(state == 'on'){
					this.pushWorkspace()

					if(this.workspaces['single-image'] == null){
						this.loadWorkspace('ui-chrome-hidden') 
						this.saveWorkspace('single-image') 
					}

					this.loadWorkspace('single-image') 

				} else {
					this.popWorkspace()
				}
			})],
})


// XXX HACK: we are forcing redraw of images in some conditions (when 
// 		they are close to their original size) to compensate for chrome
// 		rendering them blurry off screen in these conditions...
// 		XXX I would not bother and leave this as-is but this makes the 
// 			image jump in size slightly when redrawing...
var SingleImageView =
module.SingleImageView = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image',
	depends: [
		'ui'
	],
	suggested: [
		'ui-single-image-local-storage',
		'ui-single-image-autohide-cursor',
	],

	actions: SingleImageActions,

	handlers:[
		['resizing.post',
			function(){ 
				// prevent this from doing anything while no viewer...
				if(!this.ribbons 
						|| !this.ribbons.viewer 
						|| this.ribbons.getRibbonSet().length == 0){
					return
				}

				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					this.updateImageProportions()

					this.config['single-image-scale'] = 
						this[this.config['single-image-scale-unit']]

				} else {
					this.config['ribbon-scale'] = 
						this[this.config['ribbon-scale-unit']] 
				}
			}],
		// update new images...
		['resizeRibbon',
			function(){
				if(this.toggleSingleImage('?') == 'on'){
					this.updateImageProportions()
				}
			}],
		// NOTE: this is not part of the actual action above because we 
		// 		need to see if the state has changed and doing this with 
		// 		two separate pre/post callbacks (toggler callbacks) is 
		// 		harder than with two nested callbacks (action callbacks)
		['toggleSingleImage.pre', 
			function(){ 
				var pre_state = this.toggleSingleImage('?')

				return function(){
					var that = this
					var state = this.toggleSingleImage('?')

					// singe image mode -- set image proportions...
					if(state == 'on'){
						// update scale...
						if(state != pre_state){
							this.config['ribbon-scale'] = 
								this[this.config['ribbon-scale-unit']] 

							this[this.config['single-image-scale-unit']] =
								this.config['single-image-scale']
									|| this[this.config['single-image-scale-unit']]
						}

						this.updateImageProportions()

					// ribbon mode -- restore original image size...
					} else {
						// reset image container size...
						this.ribbons.viewer.find('.image:not(.clone)')
							.each(function(_, img){
								img.style.width = ''
								img.style.height = ''

								img.style.margin = ''
							})

						// align ribbons...
						this.alignRibbons('now')

						// update scale...
						if(state != pre_state){
							this.config['single-image-scale'] = 
								this[this.config['single-image-scale-unit']]

							this[this.config['ribbon-scale-unit']] =
								this.config['ribbon-scale']
									|| this[this.config['ribbon-scale-unit']] 
						}
					}
				}
			}],

		// Force browser to redraw off-screen images...
		//
		// This appears that chrome cheats by not resizing off-screen
		// images properly after changing scale...
		//
		// XXX this is still not perfect...
		// 		...if needed do a .reload() / ctrl-r
		[[
			'resizing.post',
			'toggleSingleImage.pre', 
		], 
			function(){ 
				this.__did_resize = true 
			}],
		[[
			'focusImage', 
			'toggleSingleImage',
		], 
			function(){
				var img = this.ribbons.getImage()
				var d = Math.max(img.attr('preview-width')*1, img.attr('preview-width')*1)
				var D = this.ribbons.getVisibleImageSize('max')

				if(this.config['-single-image-redraw-on-focus']
						&& this.toggleSingleImage('?') == 'on'
						&& this.__did_resize
						// only when close to original preview size
						&& Math.abs(D-d)/D < 0.30){

					// this forces chrome to redraw off-screen images...
					this.scale = this.scale

					// reset the resize flag...
					delete this.__did_resize
				}
			}],
	],
})


var SingleImageViewLocalStorage =
module.SingleImageViewLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-local-storage',
	depends: [
		'ui-single-image',
		'config-local-storage',
	],

	handlers:[
		// set scale...
		['load.pre',
			function(){
				// NOTE: at this stage the viewer is not yet ready, and
				// 		we need to save these for when it is, thus avoiding
				// 		stray actions overwriting the config with defaults
				// 		when not finding a value in the viewer...
				var rscale = this.config['ribbon-scale']
					|| this[this.config['ribbon-scale-unit']] 
				var iscale = this.config['single-image-scale']
					|| this[this.config['single-image-scale-unit']]

				return function(){
					// prevent this from doing anything while no viewer...
					if(!this.ribbons 
							|| !this.ribbons.viewer 
							|| this.ribbons.getRibbonSet().length == 0){
						return
					}

					if(this.toggleSingleImage('?') == 'on'){
						this[this.config['single-image-scale-unit']] = iscale

					} else {
						this[this.config['ribbon-scale-unit']] = rscale
					}
				}
			}],
	],
})



//---------------------------------------------------------------------

// This will store/restore autohide state for single-image and ribbon 
// views...
//
// NOTE: chrome 49 + devtools open appears to prevent the cursor from being hidden...
//
// XXX hiding cursor on navigation for some reason does not work...
var SingleImageAutoHideCursor = 
module.SingleImageAutoHideCursor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-autohide-cursor',
	depends: [
		'ui-autohide-cursor',
		'ui-single-image',
	],

	config: {
		'cursor-autohide-single-image-view': 'on',
		'cursor-autohide-ribbon-view': 'off',

		//'cursor-autohide-on-navigate': true, 
	},

	handlers: [
		// setup...
		['load',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-single-image-view'
					: 'cursor-autohide-ribbon-view'

				this.toggleAutoHideCursor(this.config[mode] || 'off')
			}],
		// store state for each mode...
		['toggleAutoHideCursor',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-single-image-view'
					: 'cursor-autohide-ribbon-view'

				this.config[mode] = this.toggleAutoHideCursor('?')
			}],
		// restore state per mode...
		['toggleSingleImage', 
			function(){
				if(this.toggleSingleImage('?') == 'on'){
					this.toggleAutoHideCursor(this.config['cursor-autohide-single-image-view'])

				} else {
					this.toggleAutoHideCursor(this.config['cursor-autohide-ribbon-view'])
				}
			}],
		/* XXX for some reason this does not work...
		// autohide on navigation...
		['focusImage', 
			function(){
				//if(this.config['cursor-autohide-on-navigate'] 
				//		&& this.toggleAutoHideCursor('?') == 'on'){
				//	this.toggleAutoHideCursor('on')
				//}
				if(this.config['cursor-autohide-on-navigate'] 
						&& this.toggleAutoHideCursor('?') == 'on'
						&& this.ribbons.viewer.prop('cursor-autohide')){
					this.ribbons.viewer
						.addClass('cursor-hidden')
				}
			}],
		*/
	]
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
