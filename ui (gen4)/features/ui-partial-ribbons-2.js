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

var PartialRibbonsActions = actions.Actions({
	config: {
		// Number of screen widths to load...
		'ribbon-size-screens': 7,

		// Amount of screen widths to keep around the current image...
		'ribbon-update-threshold': 1.2,

		// Oversize multiplier limit when we resize the ribbon down...
		'ribbon-resize-threshold': 2,

		// Sets size of ribbons in single image mode...
		'ribbons-resize-single-image': 21,
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
			// NOTE: we do not include target in counts...
			var gids = this.data.getImages(target, size, 'total')
			var na = gids.slice(gids.indexOf(target)+1).length
			var pa = gids.slice(0, gids.indexOf(target)).length

			// full resize...
			if(threshold == 0
					// ribbon not loaded...
					|| img.length == 0
					// ribbon shorter than we expect...
					|| (loaded < size && na + pa > loaded)
					// ribbon too long...
					|| loaded > size * threshold){
				//console.log('RESIZE')
				this.resizeRibbon(target, size)
			//*/

			/*/ XXX long jump condition......
			if(img.length != 0 
					&& (r.length == 0
						// ribbon shorter than we expect...
						|| (loaded < size && na + pa > loaded)
						// ribbon too long...
						|| loaded > size * threshold)){
				console.log('RESIZE')
				this.resizeRibbon(target, size)

			// image is off screen -- align off then animate...
			// 		1) initial state
			// 			T	<-	[---|---x---|---------------]
			// 		2) load new state but align off screen 
			// 					[-------T-------|-------|---]
			// 		3) animate
			// 					[---|---T---|---------------]
			// XXX this makes the draw worse...
			} else if(img.length == 0 ){
				console.log('LONG-JUMP')
				r.length == 0 ?
					// ribbon not loaded...
					this.resizeRibbon(target, size)
					// simply update...
					: this.ribbons
						.preventTransitions(r)
						.updateRibbonInPlace(
							gids,
							r_gid, 
							data.getImageOrder(this.current) > data.getImageOrder(target) ?
								gids[gids.length - w]
								: gids[w])
						.restoreTransitions(r, true)
			//*/

			// in-place update...
			// passed threshold on the right...
			} else if((nl < update_threshold && na > nl) 
					// passed threshold on the left...
					|| (pl < update_threshold && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > size + update_threshold){
				//console.log('UPDATE')
				(r.length == 0 
					|| (this.toggleSingleImage 
						&& this.toggleSingleImage('?') == 'on')) ?
					// resize...
					this.resizeRibbon(target, size)
					// simply update...
					: this.ribbons
						.preventTransitions(r)
						.updateRibbonInPlace(
							gids,
							r_gid, 
							// XXX this makes the animation of the ribbon 
							// 		a bit smoother but messes up the indicator 
							// 		a bit...
							// 		...this needs the update process to happen 
							// 		very fast comparing to the animation itself
							// 		to stay in sync...
							//gids.indexOf(this.current) >= 0 ? 'current' : target)
							// XXX STUB: this makes the ribbon animation a bit
							// 		jumpy but does not touch the indicator 
							// 		animation...
							target)
						.restoreTransitions(r, true)
			}
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
		['resizing.post',
			function(_, unit, size){
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
