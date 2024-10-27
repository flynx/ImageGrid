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

		// can be:
		// 	'hybrid'
		// 	'resize'
		'ribbons-in-place-update-mode': 'resize',

		'ribbons-in-place-update-timeout': 100,

		// XXX
		'ribbon-update-timeout': 120,
	},

	// XXX trigger .alignRibbons(..) in correct spot...
	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold, preload){
			target = target instanceof jQuery 
				? this.ribbons.elemGID(target)
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
			preload = preload === undefined ? true : preload
			var data = this.data
			var ribbons = this.ribbons

			var t = Date.now()
			this.__last_ribbon_update = this.__last_ribbon_update || t
			var timeout = this.config['ribbons-in-place-update-timeout']
			var	update_timeout = this.config['ribbon-update-timeout']

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
					|| loaded > size * threshold
					// passed hard threshold -- too close to edge...
					|| (nl < w && na > nl) || (pl < w && pa > pl)){
				//console.log('RESIZE (sync)')
				this.resizeRibbon(target, size)

			// more complex cases...
			// passed threshold on the right...
			} else if((nl < update_threshold && na > nl) 
					// passed threshold on the left...
					|| (pl < update_threshold && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > size + update_threshold){
				// resize...
				if(this.config['ribbons-in-place-update-mode'] == 'resize'
						// no ribbon loaded...
						|| r.length == 0 
						// only if we are going slow...
						|| (timeout != null 
							&& (t - this.__last_ribbon_update > timeout))
						// full screen...
						|| (this.toggleSingleImage 
							&& this.toggleSingleImage('?') == 'on')){
					return function(){
						var that = this
						// sync update...
						if(update_timeout == null){
							//console.log('RESIZE (post)', t-this.__last_ribbon_update)
							this.resizeRibbon(target, size)

						// async update...
						} else {
							this.__update_timeout
								&& clearTimeout(this.__update_timeout)
							this.__update_timeout = setTimeout(function(){ 
								//console.log('RESIZE (timeout)', t-this.__last_ribbon_update)
								delete that.__update_timeout
								that.resizeRibbon(target, size) 
							}, update_timeout)
						}
					}

				// in-place update...
				// XXX this is faster than .resizeRibbon(..) but it's not
				// 		used unconditionally because I can't get rid of
				// 		sync up images being replaced...
				// 		...note that .resizeRibbon(..) is substantially 
				// 		slower (updates DOM), i.e. introduces a lag, but
				// 		the results look OK...
				// XXX approaches to try:
				// 		- wait for images to preload and only then update...
				// 		- preload images in part of a ribbon and when ready update...
				// 			...this is like the first but we wait for less images...
				} else {
					//console.log('UPDATE', t - this.__last_ribbon_update)
					var c = gids.indexOf(data.getImage('current', r_gid))
					var t = gids.indexOf(target)

					ribbons
						.preventTransitions(r)
						.updateRibbonInPlace(gids, r_gid, target)
						.restoreTransitions(r, true)
				}
			}

			this.__last_ribbon_update = t 
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
