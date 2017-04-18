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

var core = require('features/core')



/*********************************************************************/

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
// XXX try using .ribbons.resizeRibbon(..) for basic tasks...
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = actions.Actions({
	config: {
		// Number of screen widths to load...
		'ribbon-size-screens': 7,

		// Number of screen widths to edge to trigger reload...
		'ribbon-resize-threshold': 1.5,

		// Timeout before a non-forced ribbon size update happens after
		// the action...
		// NOTE: if set to null, the update will be sync...
		'ribbon-update-timeout': 120,
	},

	// NOTE: this will force sync resize if one of the following is true:
	// 		- the target is not loaded
	// 		- we are less than screen width from the edge
	// 		- threshold is set to 0
	// XXX this is not signature compatible with data.updateRibbon(..)
	// XXX do not do anything for off-screen ribbons...
	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target)
					|| this.data.getImage(target, 'after'))

			w = w || this.screenwidth

			// get config data and normalize...
			size = (size 
				|| this.config['ribbon-size-screens'] 
				|| 5) * w
			threshold = threshold == 0 ? threshold
				: (threshold 
					|| this.config['ribbon-resize-threshold'] 
					|| 1) * w

			var timeout = this.config['ribbon-update-timeout']

			// next/prev loaded... 
			var img = this.ribbons.getImage(target)
			var nl = img.nextAll('.image:not(.clone)').length
			var pl = img.prevAll('.image:not(.clone)').length

			// next/prev available...
			// NOTE: we subtract 1 to remove the current and make these 
			// 		compatible with: nl, pl
			var na = this.data.getImages(target, size, 'after').length - 1
			var pa = this.data.getImages(target, size, 'before').length - 1

			// do the update...
			// no threshold means force load...
			if(threshold == 0 
					// the target is not loaded...
					|| img.length == 0
					// passed hard threshold on the right...
					|| (nl < w && na > nl) 
					// passed hard threshold on the left...
					|| (pl < w && pa > pl)){

				this.resizeRibbon(target, size)

			// do a late resize...
			// loaded more than we need (crop?)...
			} else if(na + pa < nl + pl
					// passed threshold on the right...
					|| (nl < threshold && na > nl) 
					// passed threshold on the left...
					|| (pl < threshold && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > size + threshold){

				return function(){
					// sync update...
					if(timeout == null){
						this.resizeRibbon(target, size)

					// async update...
					} else {
						// XXX need to check if we are too close to the edge...
						var that = this
						//setTimeout(function(){ that.resizeRibbon(target, size) }, 0)
						if(this.__update_timeout){
							clearTimeout(this.__update_timeout)
						}
						this.__update_timeout = setTimeout(function(){ 
							delete that.__update_timeout
							that.resizeRibbon(target, size) 
						}, timeout)
					}
				}
			}
		}],
})

// NOTE: I do not fully understand it yet, but PartialRibbons must be 
// 		setup BEFORE RibbonAlignToFirst, otherwise the later will break
// 		on shifting an image to a new ribbon...
// 			To reproduce:
// 				- setupe RibbonAlignToFirst first
// 				- go to top ribbon
// 				- shift image up
// 		XXX The two should be completely independent.... (???)
var PartialRibbons = 
module.PartialRibbons = core.ImageGridFeatures.Feature({
	title: 'Partial Ribbons',
	doc: core.doc`Maintains partially loaded ribbons, this enables very large
	image sets to be handled efficiently.`,

	// NOTE: partial ribbons needs to be setup first...
	// 		...the reasons why things break otherwise is not too clear.
	priority: 'high',

	tag: 'ui-partial-ribbons',
	exclusive: ['ui-partial-ribbons'],
	depends: [
		'ui'
	],
	suggested: [
		'ui-partial-ribbons-precache',
	],


	actions: PartialRibbonsActions,

	handlers: [
		['focusImage.pre centerImage.pre', 
			function(target, list){
				// NOTE: we have to do this as we are called BEFORE the 
				// 		actual focus change happens...
				// XXX is there a better way to do this???
				target = list != null ? target = this.data.getImage(target, list) : target

				this.updateRibbon(target)
			}],
		['resizing.pre',
			function(unit, size){
				// keep constant size in single image...
				if(this.toggleSingleImage && this.toggleSingleImage('?') == 'on'){
					this.updateRibbon(
						'current', 
						this.config['ribbons-resize-single-image'] || 13)

				} else if(unit == 'scale'){
					this.updateRibbon('current', this.screenwidth / size || 1)

				} else if(unit == 'screenwidth'){
					this.updateRibbon('current', size || 1)

				} else if(unit == 'screenheight'){
					size = size || 1

					// convert target height in ribbons to width in images...
					// NOTE: this does not account for compensation that 
					// 		.updateRibbon(..) makes for fitting whole image
					// 		counts, this is a small enough error so as not
					// 		to waste time on...
					var s = this.ribbons.scale()
					var h = this.ribbons.getScreenHeightRibbons()
					var w = this.ribbons.getScreenWidthImages()
					var nw = w / (h/size)

					this.updateRibbon('current', nw)
				}
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
