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
// XXX do we need to do most of the work here on in imagegrid/data.js???
// 		...another question would be if we can do this using existing 
// 		functionality?

var PartialRibbonsActions = actions.Actions({
	config: {
		'ribbon-size-screens': 7,

		// the amount of screen widths to keep around the current image...
		'ribbon-update-threshold': 1.2,

		// the oversize multiplier limit when we resize the ribbon down...
		'ribbon-resize-threshold': 2,
	},

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
				|| 9) * w
			threshold = threshold == 0 ? threshold
				: (threshold 
					|| this.config['ribbon-resize-threshold'] 
					|| 2)
			var update_threshold = (this.config['ribbon-update-threshold'] || 2)  * w
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

			// next/prev loaded... 
			var img = this.ribbons.getImage(target)
			var nl = img.nextAll('.image:not(.clone)').length
			var pl = img.prevAll('.image:not(.clone)').length
			var loaded = nl + pl + 1

			// next/prev available...
			// NOTE: we subtract 1 to remove the current and make these 
			// 		compatible with: nl, pl
			var na = this.data.getImages(target, size, 'after').length - 1
			var pa = this.data.getImages(target, size, 'before').length - 1

			//console.log(`-- loaded: ${loaded} size: ${size}`)

			// full resize...
			// ribbon not loaded...
			if(r.length == 0
					// ribbon shorter than we expect...
					|| (loaded < size && na + pa > loaded)
					|| loaded > size * threshold){
				//console.log(`RESIZE: ${loaded} -> ${size}`)
				this.resizeRibbon(target, size)

			// soft-update...
			} else if(na + pa < nl + pl
					// passed threshold on the right...
					|| (nl < update_threshold && na > nl) 
					// passed threshold on the left...
					|| (pl < update_threshold && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > size + update_threshold){
				//console.log('UPDATE')
				r.length == 0 ?
					// ribbon not loaded...
					this.resizeRibbon(target, size)
					// simply update...
					: this.ribbons
						.preventTransitions(r)
						.updateRibbonInPlace(
							this.data.getImages(target, loaded, 'total'), 
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
				this.updateRibbon()
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
