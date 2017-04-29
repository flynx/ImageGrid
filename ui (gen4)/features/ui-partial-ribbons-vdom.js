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

// XXX DEBUG: remove when not needed...
window.vdom = vdom


//---------------------------------------------------------------------

// hooks...
function PREVIEW(ig, gid, url){
	this.ig = ig
	this.gid = gid
	this.url = url
}
PREVIEW.prototype.hook = function(elem, prop){
	this.ig.ribbons._loadImagePreviewURL(elem, this.url)
}


//---------------------------------------------------------------------

var VirtualDOMRibbonsClassPrototype = {
	// XXX ???
}

var VirtualDOMRibbonsPrototype = {
	// XXX this is a circular ref -- I do not like it...
	imagegrid: null,

	dom: null,
	vdom: null,

	// Format:
	// 	{
	// 		count: <count>,
	//
	// 		scale: <scale>,
	//
	// 		top: <offset>,
	// 		ribbons: {
	// 			<gid>: <offset>,
	// 			...
	// 		},
	// 	}
	state: null,

	// constructors...
	makeView: function(state){
		state = state || {}
		var that = this
		var ig = this.imagegrid

		var target = state.target || ig.current

		this.state = this.state || {}
		var count = state.count = state.count
			|| ig.screenwidth * (ig.config['ribbon-size-screens'] || 9)
		var s = state.scale = state.scale 
			|| ig.scale
		var top = state.top = state.top 
			|| this.state.top 
			|| ig.ribbons.getRibbonLocator().transform('y') 

		var data = ig.data
		var images = ig.images

		var ribbons = data.ribbon_order
			.map(function(gid){
				return that.makeRibbon(gid, count, state) })

		return vdom.h('div.ribbon-set', {
			key: 'ribbon-set',
			style: {
				transform: 'scale('+ s +', '+ s +')',
			}
		}, [
			vdom.h('div.ribbon-locator', {
				key: 'ribbon-locator',
				style: {
					// XXX should this be in vh???
					transform: 'translate3d(0px, '+ top +'px, 0px)',
				},
			},
			ribbons)
		])
	},
	// XXX calc offset (x) -- the only thing left to be fully usable...
	// XXX setup handlers (???)
	// XXX current image marker (???)
	makeRibbon: function(gid, count, state){
		state = state || {}
		var that = this
		var ig = this.imagegrid
		var data = ig.data
		var images = ig.images
		var base = data.base == gid ? '.base' : ''
		var imgs = []

		this.state = this.state || {}
		this.state.ribbons = this.state.ribbons || {}

		var x = this.state.ribbons[gid] = 
			(state.ribbons && state.ribbons[gid])
				|| this.state.ribbons[gid]
				// XXX calculate new offset
				// 		...this will work only for cases where nothing 
				// 		changes...
				|| parseFloat(ig.ribbons.getRibbon(gid).transform('x'))

		data.getImages(gid, count, 'total')
			.forEach(function(gid){
				// image...
				imgs.push(that.makeImage(gid))

				// marks...
				that.makeImageMarks(gid)
					.forEach(function(mark){ imgs.push(mark) })
			})

		return vdom.h('div.ribbon'+base, {
			key: 'ribbon-'+gid,

			// XXX events, hammer, ...???

			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
			},
			style: {
				transform: 'translate3d('+ x +'vmin, 0px, 0px)',
			},
		},
		imgs)
	},
	// XXX setup image handlers...
	// 		...or move them up to viewer or some other spot (viewer?)...
	makeImage: function(gid, size){
		var ig = this.imagegrid
		size = this.state.tile_size = size 
			|| this.state.tile_size 
			|| ig.ribbons.getVisibleImageSize('max')
		var data = this.imagegrid.data
		var images = this.imagegrid.images || {}
		var current = data.current == gid ? '.current' : ''

		var image = images[gid] || {}
		var seen = []
		while(image.type == 'group'){
			// error, recursive group...
			if(seen.indexOf(image.id) >= 0){
				image = images.IMAGE_DATA
				console.error('Recursive group:', gid)
				break
			}
			seen.push(image.id)

			image = that.images[image.cover]
		}
		var url = ig.images.getBestPreview(gid, size, image, true).url

		return vdom.h('div.image'+current, {
			key: 'image-'+gid,

			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
				orientation: image.orientation,
				flipped: image.flipped,

				//'preview-width': w,
				//'preview-height': h,
			},
			style: {
				backgroundImage: 'url("'+ url +'")',
			}
		})
	},
	// XXX STUB: make marks handling more extensible... (???)
	makeImageMarks: function(gid){
		var that = this
		var marks = []
		var tags = this.imagegrid.data.getTags(gid)

		// XXX STUB: make this extensible...
		tags.indexOf('bookmark') >= 0 
			&& marks.push('bookmark')
		tags.indexOf('selected') >= 0 
			&& marks.push('selected')

		return marks
			.map(function(type){
				return that.makeImageMark(gid, type) })
	},
	makeImageMark: function(gid, type){
		return vdom.h('div.mark.'+(type || ''), {
			key: 'mark-'+gid,
			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
			},
		})
	},

	// XXX add ability to hook in things like current image marker...

	// NOTE: virtual-dom architecture is designed around a fast-render-on-demand
	// 		concept, so we build the state on demand...
	sync: function(){
		var dom = this.dom = this.dom 
			// get/create the ribbon-set...
			|| this.imagegrid.ribbons.getRibbonSet(true)

		// build initial state...
		if(this.vdom == null){
			var n = this.vdom = this.makeView(this.state || {})
			var v = vdom.create(n)
			dom.replaceWith(v)
			this.dom = v

		// patch state...
		} else {
			var n = this.makeView(this.state || {})
			vdom.patch(dom, vdom.diff(this.vdom, n))
			this.vdom = n
		}

		return this
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


	// XXX
	centerImage: [
		function(target, align, offset, scale){
		}],
	centerRibbon: [
		function(target){
		}],

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
