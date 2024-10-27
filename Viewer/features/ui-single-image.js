/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

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

		// Scales for small and normal image sizes...
		'fit-small-scale': 4,
		'fit-normal-scale': 1.2,

		'fit-custom-scale': {},

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

		// Config defaults to set on first init of single image mode...
		//
		// NOTE: the keys set here will be handled by the 'single-image'
		// 		workspace...
		'single-image-config-defaults': {
			'ribbon-focus-mode': 'order',
			'shifts-affect-direction': 'off',
		},

		'single-image-toggle-on-click': true,
	},

	// XXX make this accept args for debuging...
	// XXX should this size images via vmin rather than px???
	updateImageProportions: ['- Interface/',
		function(){
			var that = this
			var threshold = this.config['single-image-proportions-threshold']

			if(!threshold || threshold == -1){
				return
			}

			var viewer = this.dom

			var ribbon = this.ribbons.getRibbon()
			var images = viewer.find('.ribbon .image')

			// no images loaded...
			if(images.length == 0){
				return
			}

			var w = this.ribbons.getVisibleImageSize('width', 1)
			var h = this.ribbons.getVisibleImageSize('height', 1)

			// inner diameter
			var di = Math.min(h, w)
			// outer diameter -- (m)ax
			var dm = Math.max(h, w)
			
			//var c = Math.min(this.screenwidth, this.screenheight)
			var c = this.screenfit 

			// change proportions...
			if(c < threshold){
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
				/*/ XXX for some reason 'vmin' ignores scale...
				var n = ((di + d) / di) * 100
				//*/

				// XXX not sure why we need to get animation frame here...
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
								/*/ XXX for some reason 'vmin' ignores scale...
								img.style[b] = n + 'vmin'
								img.style.margin = -(n - 100)/2 +'vmin '+ (n - 100)/2 +'vmin'
								//*/

							} else {
								img.style[a] = n + 'px'
								/*/ XXX for some reason 'vmin' ignores scale...
								img.style[a] = n + 'vmin'
								//*/
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

	toggleSingleImage: ['Interface/Single image view', 
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			'single-image-mode',
			function(state){
				if(state == 'on'){
					this.pushWorkspace()

					// base the single image defaults of ui-chrome-hidden...
					if(this.workspaces['single-image'] == null){
						this.loadWorkspace('ui-chrome-hidden') 
						this.mergeConfig('single-image-config-defaults')
						this.saveWorkspace('single-image')
					}

					this.loadWorkspace('single-image') 

				} else {
					this.popWorkspace()
				}
			})],
	

	// basic single image view sizing...
	fitSmall: ['Zoom/Show small image',
		function(){ this.screenfit = this.config['fit-small-scale'] || 4 }],
	setSmallScale: ['Zoom/Set small size to current',
		function(value){ 
			this.config['fit-small-scale']
				= value === null ? 4 : (value || this.screenfit) }],
	fitNormal: ['Zoom/Show normal image',
		function(){ this.screenfit = this.config['fit-normal-scale'] || 1.2 }],
	setNormalScale: ['Zoom/Set normal size to current',
		function(value){ 
			this.config['fit-normal-scale'] 
				= value === null ? 1.2 : (value || this.screenfit) }],
	
	fitCustom: ['- Zoom/Show cusotm size image',
		function(n){
			if(n == null){
				return
			}

			var s = this.config['fit-custom-scale'][n]

			if(s == null){
				return	
			}

			this.screenfit = s
		}],
	setCustomSize: ['- Zoom/Set image cusotm size',
		function(n, value){
			if(n == null){
				return
			}

			var sizes = this.config['fit-custom-scale']

			// reset...
			if(value === null){
				if(sizes && n in sizes){
					delete sizes[n]
				}

			// set...
			} else {
				sizes = sizes && JSON.parse(JSON.stringify(sizes)) || {}
				sizes[n] = value || this.screenfit
			}

			// NOTE: we are resetting this for it to be stored correctly...
			if(sizes){
				this.config['fit-custom-scale'] = sizes
			}
		}],
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
		'ui',
		'util',
	],
	suggested: [
		'ui-single-image-local-storage',
		'ui-single-image-cursor',
	],

	actions: SingleImageActions,

	handlers:[
		['load.pre',
			function(){ 
				this.toggleSingleImage('?') == 'on'
					&& this.toggleSingleImage('off') }],
		// update config...
		//['resizing.post',
		['resizingDone resizingWindow',
			function(){ 
				// prevent this from doing anything while no viewer...
				if(!this.ribbons 
						|| !this.dom 
						|| this.ribbons.getRibbonSet().length == 0){
					return
				}

				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					this.updateImageProportions()

					this.config['single-image-scale'] 
						= this[this.config['single-image-scale-unit']]

				} else {
					this.config['ribbon-scale'] 
						= this[this.config['ribbon-scale-unit']] 
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
							// save ribbon state...
							this.config['ribbon-scale']
								= this[this.config['ribbon-scale-unit']] 

							// change state...
							this[this.config['single-image-scale-unit']]
								= this.config['single-image-scale']
								= this.config['single-image-scale']
									|| this[this.config['single-image-scale-unit']]
						}

						this.updateImageProportions()

					// ribbon mode -- restore original image size...
					} else {
						this.ribbons
							.preventTransitions()
							// reset image container size...
							.viewer.find('.image:not(.clone)')
								.each(function(_, img){
									img.style.width = ''
									img.style.height = ''
									img.style.margin = ''
								})
						this
							// align ribbons...
							.alignRibbons('now')
							.ribbons
								.restoreTransitions(true)

						// update scale...
						if(state != pre_state){
							// save single image view state...
							this.config['single-image-scale']
								= this[this.config['single-image-scale-unit']]

							// change state...
							this[this.config['ribbon-scale-unit']]
								= this.config['ribbon-scale']
								= this.config['ribbon-scale']
									|| this[this.config['ribbon-scale-unit']] 
						}
					}
				}
			}],

		// current image clicked...
		['imageOuterBlockClick.pre',
			function(gid){
				if(gid == this.current
						&& this.config['single-image-toggle-on-click']
						&& this.toggleSingleImage('?') == 'off'){
					this.toggleSingleImage() 
				}
			}],
		['imageClick.pre',
			function(gid){
				gid == this.current
					&& this.config['single-image-toggle-on-click']
					&& this.toggleSingleImage() 
			}],

		// Workspace...
		// 	...set ribbon focus mode to order (default) in single image mode...
		['saveWorkspace',
			core.makeWorkspaceConfigWriter(
				function(){ 
					return Object.keys(this.config['single-image-config-defaults'] || {}) })],
		// XXX not sure if manual calling of togglers is the right way 
		// 		to go here + it's redundant...
		// 		...the reasoning is that togglers can be bound to, so we
		// 		need to call the bound code...
		['loadWorkspace',
			core.makeWorkspaceConfigLoader(
				function(){ 
					return Object.keys(this.config['single-image-config-defaults'] || {}) },
				// NOTE: options toggled by togglers are triggered here...
				// 		XXX do not like this -- manual...
				function(workspace){
					'ribbon-focus-mode' in workspace
						&& this.toggleRibbonFocusMode(workspace['ribbon-focus-mode'])
					'shifts-affect-direction' in workspace
						&& this.toggleShiftsAffectDirection
						&& this.toggleShiftsAffectDirection(workspace['shifts-affect-direction'])
				})],
	],
})


var SingleImageViewLocalStorage =
module.SingleImageViewLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-local-storage',
	depends: [
		'ui-single-image',
		//'localstorage-config',
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
							|| !this.dom 
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
var SingleImageCursor = 
module.SingleImageCursor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-cursor',
	depends: [
		'ui-cursor',
		'ui-single-image',
	],

	config: {
		'cursor-autohide-on-timeout-single-image-view': 'on',
		'cursor-autohide-on-timeout-ribbon-view': 'off',
	},

	handlers: [
		// setup...
		['start',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-on-timeout-single-image-view'
					: 'cursor-autohide-on-timeout-ribbon-view'

				this.toggleAutoHideCursorTimeout(this.config[mode] || 'off')
			}],
		// store state for each mode...
		['toggleAutoHideCursorTimeout',
			function(){
				var mode = this.toggleSingleImage('?') == 'on' ? 
					'cursor-autohide-on-timeout-single-image-view'
					: 'cursor-autohide-on-timeout-ribbon-view'

				this.config[mode] = this.toggleAutoHideCursorTimeout('?')
			}],
		// restore state per mode...
		['toggleSingleImage', 
			function(){
				if(this.toggleSingleImage('?') == 'on'){
					this.toggleAutoHideCursorTimeout(this.config['cursor-autohide-on-timeout-single-image-view'])

				} else {
					this.toggleAutoHideCursorTimeout(this.config['cursor-autohide-on-timeout-ribbon-view'])

					// XXX for some reason this is not working...
					this.toggleHiddenCursor(this.config['cursor-autohide-on-timeout-ribbon-view'])
				}
			}],
	]
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
