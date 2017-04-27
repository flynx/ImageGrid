/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var vdom = require('ext-lib/virtual-dom')

var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// XXX EXPERIMENT: use virtual-dom to do ribbon updates...
// 		- create and maintain a full ribbon view from .ribbon-set and down...
// 		- sync with dom only when needed...
// 			- on direct edits (use .update() / .reload() ???)
// 			- on .updateRibbon(..) -- lazily and when needed...
// 		- see if we can offload the vdom logic to a worker...
// XXX using virtual-dom...
// 			- make the below functions into methods...
// 			- add .sync() to sync-up the DOM with virtual dom...
// 				...this would lead to .updateRibbon(..) to only need to 
// 				figure out when to call .sync()
// XXX Q: should this be a special imagegrid/ribbons.js implementation
//		or a different level API??
//		...maybe: imagegrid/ribbons-vdom.js as a completely standalone
//		module that would be mixed with imagegrid/ribbons.js -- sounds 
//		a bit too complicated, overkill??
// XXX Q: how should we handle "sync" stuff???
// 			things like toggling marks or rotating an image...
// 			
// 			
//---------------------------------------------------------------------

window.vdom = vdom


//---------------------------------------------------------------------

// attribute hooks...
function GID(value){
	this.value = JSON.stringify(value)
		.replace(/^"(.*)"$/g, '$1') }
GID.prototype.hook = function(elem, prop){
    elem.setAttribute(prop, this.value) }

function VALUE(value){
	this.value = value || '' }
VALUE.prototype.hook = function(elem, prop){
    this.value != '' 
		&& elem.setAttribute(prop, this.value) }


//---------------------------------------------------------------------

var VirtualDOMRibbonsClassPrototype = {
}

// XXX need a way to link this to the context...
var VirtualDOMRibbonsPrototype = {

	dom: null,
	vdom: null,
	// XXX this is a circular ref -- I do not like it...
	imagegrid: null,

	// constructors...
	// XXX get vertical offset and scale...
	makeView: function(count){
		var data = imagegrid.data
		var images = imagegrid.images

		// XXX
		var s = 1
		var x = 0

		var ribbons = data.ribbon_order
			.map(function(gid){
				return makeRibbon(gid, data, images, count) })

		return vdom.h('div.ribbon-set', {
			key: 'ribbon-set',
			style: {
				transform: 'scale('+ s +', '+ s +')',
			}
		}, [
			vdom.h('div.ribbon-locator', {
				key: 'ribbon-locator',
				style: {
					transform: 'translate3d(0px, '+ x +'px, 0px)',
				},
			},
			ribbons)
		])
	},
	// XXX calc/get count if not given explicitly...
	// XXX calc offset (y)...
	// XXX should we setup handlers here???
	makeRibbon: function(gid, count){
		var data = imagegrid.data
		var images = imagegrid.images

		var imgs = []

		// XXX
		var y = 0

		data.getImages(gid, count, 'total')
			.forEach(function(gid){
				imgs.push(makeImage(gid, data, images))
				makeImageMarks(gid, data, images)
					.forEach(function(mark){ 
						imgs.push(mark) })
			})
		return vdom.h('div.ribbon', {
			key: 'ribbon-'+gid,

			gid: new GID(gid),

			// XXX events, hammer, ...???

			style: {
				transform: 'translate3d('+ y +'px, 0px, 0px)',
			},
		},
		imgs)
	},
	// XXX handle previews -- hook???
	// NOTE: at this point this does not account for previews at all...
	makeImage: function(gid){
		var data = imagegrid.data
		var images = imagegrid.images || {}

		var image = images[gid] || {}
		var current = data.current == gid ? '.current' : ''

		// XXX stuff needed to get a preview:
		// 		- image tile size -- .ribbons.getVisibleImageSize(..)
		// 		- preview url -- .ribbons.getBestPreview(..)
		// 		- actual preview size -- w and h
		// XXX need a strategy on how to update images...

		return vdom.h('div.image'+current, {
			key: 'image-'+gid,

			gid: new GID(gid),

			orientation: new VALUE(image.orientation),
			flipped: new VALUE(image.flipped),

			// XXX preview stuff...
			//'preview-width': new VALUE(w),
			//'preview-height': new VALUE(h),
			//style: {
			//	backgroundImage: 'url('+ url +')',
			//}
		})
	},
	// XXX get marks...
	makeImageMarks: function(gid){
		// XXX get marks...
		var marks = []

		return marks
			.map(function(type){
				return makeImageMark(gid, type, data, images) })
	},
	makeImageMark: function(gid, type){
		return vdom.h('div.mark'+(type || ''), {
			key: 'mark-'+gid,
			gid: new GID(gid),
		})
	},

	
	__init__: function(imagegrid){
		this.imagegrid = imagegrid
	},
}

var VirtualDOMRibbons =
module.VirtualDOMRibbons =
object.makeConstructor('VirtualDOMRibbons', 
	VirtualDOMRibbonsClassPrototype,
	VirtualDOMRibbonsPrototype)



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

	get virtualdom(){
		return (this.__virtual_dom = this.__virtual_dom || VirtualDOMRibbons(this)) },


	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold, preload){
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

	tag: 'ui-partial-ribbons-vdom',
	exclusive: ['ui-partial-ribbons'],
	depends: [
		'ui',
	],
	suggested: [
		'ui-partial-ribbons-precache',
	],

	actions: PartialRibbonsActions, 

	handlers: [
		['start',
			function(){
				console.warn(
					'EXPERIMENTAL: starting virtual-dom version of partial ribbons...') }],
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
