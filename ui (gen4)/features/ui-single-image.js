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
// helper...

// XXX an ideal case would be:
//
// A)
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
// B)
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
// C)
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
// D)
//       image
//      + - - - - - - - +
//      .               .
//      +---------------+
//      | viewer        |   - image bigger than viewer in one dimension
//      |       ^       |   - block grows to fit image proportions
//      |       |       |   - need to account for individual image 
//      |       v       |     proportions
//      |               |   - drag enabled
//      +---------------+
//      .               .
//      + - - - - - - - +
//
//
// E) 
//     image
//    + - - - - - - - - - +
//    .                   .
//    . +---------------+ .
//    . | viewer        | . - image bigger than viewer 
//    . |               | . - image block same proportion as image
//    . |               | . - we just change scale
//    . |               | . - drag enabled
//    . |               | .
//    . +---------------+ .
//    .                   .
//    + - - - - - - - - - +
//
//
// XXX should this be an action???
function updateImageProportions(){
	var viewer = this.ribbons.viewer
	var image = viewer.find('.image')

	var W = viewer.width()
	var H = viewer.height()
	var w = image.width()
	var h = image.height()

	var R = W/H
	var r = w/h

	var threshold = 3
	var scale = Math.min(this.screenwidth, this.screenheight)

	// XXX the idea is that:
	// 		- up until a specific threshold:
	// 			r is 1 
	// 			we do not care about R
	// 			XXX how do we define the threshold???
	// 		- above that threshold:
	// 			r tends to R relative to ???
	// 		- when W == w && H == h
	// 			r == R
	// 		- beyond 
	// 			r tends to actual image proportions
	// 		- when (W == w || H == h) && r == actual image proportions
	// 			we change nothing...
	
	// reset image proportions to square...
	if(scale > threshold){
		image.css({
			width: '',
			height: '',
		})

	// shift image container proportions between 1 and R, from threshold
	// scale to 1...
	} else if(scale >= 1){
		// XXX
	
	// shift image container proportions between R and actual image 
	// proportions...
	} else if(W != w || H != h){
		// XXX

	// image container proportions are the same as image proportions...
	} else {
		// XXX
	}
}


//---------------------------------------------------------------------

var SingleImageActions = actions.Actions({
	config: {
		// NOTE: these will get overwritten if/when the user changes the scale...
		'single-image-scale': null,
		'ribbon-scale': null,
	},

	toggleSingleImage: ['Interface/Toggle single image view', 
		toggler.CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			'single-image-mode') ],
})


var SingleImageView =
module.SingleImageView = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view',
	depends: [
		'ui'
	],

	actions: SingleImageActions,

	handlers:[
		['fitImage.post',
			function(){ 

				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)

					this.config['single-image-scale'] = this.screenwidth

				} else {
					this.config['ribbon-scale'] = this.screenwidth
				}
			}],
		// NOTE: this is not part of the actual action above because we 
		// 		need to see if the state has changed and doing this with 
		// 		two separate pre/post callbacks (toggler callbacks) is 
		// 		harder than with two nested callbacks (action callbacks)
		// XXX this uses .screenwidth for scale, is this the right way to go?
		['toggleSingleImage.pre', 
			function(){ 
				var pre_state = this.toggleSingleImage('?')

				return function(){
					var state = this.toggleSingleImage('?')

					// singe image mode -- set image proportions...
					if(state == 'on'){
						updateImageProportions.call(this)

						// update scale...
						if(state != pre_state){
							var w = this.screenwidth
							this.config['ribbon-scale'] = w
							this.screenwidth = this.config['single-image-scale'] || w
						}

					// ribbon mode -- restore original image size...
					} else {
						this.ribbons.viewer.find('.image:not(.clone)').css({
							width: '',
							height: ''
						})

						// update scale...
						if(state != pre_state){
							var w = this.screenwidth
							this.config['single-image-scale'] = w
							this.screenwidth = this.config['ribbon-scale'] || w
						}
					}
				}
			}],
	],
})


var SingleImageViewLocalStorage =
module.SingleImageViewLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view-local-storage',
	depends: [
		'ui-single-image-view',
		'config-local-storage',
	],

	handlers:[
		// set scale...
		['load',
			function(){
				// prevent this from doing anything while no viewer...
				if(!this.ribbons || !this.ribbons.viewer || this.ribbons.viewer.length == 0){
					return
				}

				if(this.toggleSingleImage('?') == 'on'){
					this.screenwidth = this.config['single-image-scale'] || this.screenwidth

				} else {
					this.screenwidth = this.config['ribbon-scale'] || this.screenwidth
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

	tag: 'ui-single-image-view-autohide-cursor',
	depends: [
		'ui-autohide-cursor',
		'ui-single-image-view',
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



//---------------------------------------------------------------------

core.ImageGridFeatures.Feature('ui-single-image', [
	'ui-single-image-view',
	'ui-single-image-view-local-storage',

	'ui-single-image-view-autohide-cursor',
])




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
