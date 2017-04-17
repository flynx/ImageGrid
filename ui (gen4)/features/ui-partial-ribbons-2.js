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
// XXX update sequence:
// 		- if target is loaded more than 1 screen width off the edge:
// 			- jump (animate)
// 			- update ribbon
// 		- if target is not loaded or too close to edge:
// 			- update ribbon to place current at ~1 screen off the edge in 
// 				the opposite direction...
// 			- load target partially (1/2 ribbon) ~1 screen off the other edge
// 			- jump (animate)
// 			- update ribbon to place target at center of ribbon
// 		...this all feels a bit too complicated...
// XXX do we need to do most of the work here on in imagegrid/data.js???
// 		...another question would be if we can do this using existing 
// 		functionality?

var PartialRibbonsActions = actions.Actions({
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
			var data = this.data
			var ribbons = this.ribbons

			// localize transition prevention... 
			// NOTE: we can't get ribbon via target directly here as
			// 		the target might not be loaded...
			var r_gid = data.getRibbon(target)
			if(r_gid == null){
				return
			}
			// NOTE: for the initial load this may be empty...
			var r = ribbons.getRibbon(r_gid)

			// XXX test threshold...
			// XXX

			return function(){
				r.length == 0 ?
					// ribbon not loaded...
					this.resizeRibbon(target, size)
					// simply update...
					: this.ribbons
						.preventTransitions(r)
						.updateRibbonInPlace(
							this.data.getImages(target, size, 'total'), 
							r_gid,
							target)
						.restoreTransitions(r, true)
			}
		}],
	resizeRibbon: ['- Interface/Resize ribbon to n images',
		function(target, size){
			size = size 
				|| (this.config['ribbon-size-screens'] * this.screenwidth)
				|| (5 * this.screenwidth)
			var data = this.data
			var ribbons = this.ribbons

			// localize transition prevention... 
			// NOTE: we can't get ribbon via target directly here as
			// 		the target might not be loaded...
			var r_gid = data.getRibbon(target)
			if(r_gid == null){
				return
			}
			// NOTE: for the initial load this may be empty...
			var r = ribbons.getRibbon(r_gid)

			// XXX do we need to for example ignore unloaded (r.length == 0)
			// 		ribbons here, for example not load ribbons too far off 
			// 		screen??
			
			ribbons
				.preventTransitions(r)
				.updateRibbon(
					data.getImages(target, size, 'total'), 
					r_gid,
					target)
				.restoreTransitions(r, true)
		}],
})

var PartialRibbons = 
module.PartialRibbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	priority: 'high',

	tag: 'ui-partial-ribbons-2',
	exclusive: ['ui-partial-ribbons'],
	depends: [
		'ui',
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
				// XXX
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
