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


function FORCE(value){
	this.value = value
}
FORCE.prototype.hook = function(elem, prop){
	elem.style[prop] = this.value
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
	//
	// 		ribbons: {
	// 			<gid>: <offset>,
	// 			...
	// 		},
	// 	}
	state: null,

	// constructors...
	// XXX calculate top...
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
			// XXX do a real calculation...
			|| ig.ribbons.getRibbonLocator().transform('y') 

		var data = ig.data
		var images = ig.images

		var ribbons = data.ribbon_order
			.map(function(gid){
				return that.makeRibbon(gid, target, count, state) })

		return vdom.h('div.ribbon-set', {
			//key: 'ribbon-set',
			style: {
				transform: 'scale('+ s +', '+ s +')',
			}
		}, [
			vdom.h('div.ribbon-locator', {
				//key: 'ribbon-locator',
				style: {
					// XXX should this be in vh???
					transform: 'translate3d(0px, '+ top +'px, 0px)',
				},
			},
			ribbons)
		])
	},
	// XXX setup handlers (???)
	// XXX current image marker (???)
	// XXX STUB: make aligning more extensible... (???)
	makeRibbon: function(gid, target, count, state){
		state = state || {}
		var that = this
		var ig = this.imagegrid
		var current = ig.current
		target = target || state.target || current
		var size = this.state.tile_size = state.tile_size
			|| this.state.tile_size 
			|| ig.ribbons.getVisibleImageSize('max')
		var scale = state.scale = state.scale 
			|| ig.scale
		var data = ig.data
		var images = ig.images
		var ribbons = ig.ribbons
		var base = data.base == gid ? '.base' : ''
		var imgs = []

		this.state = this.state || {}
		//this.state.ribbons = this.state.ribbons || {}
		
		// XXX
		var size = this.state.tile_size = 
			this.state.tile_size 
				|| ig.ribbons.getVisibleImageSize('max')

		// calculate offset...
		// XXX this accounts for only one offset mode...
		// 		...make this extensible...
		var vsize = ribbons.px2vmin(size / scale)
		var ref = data.getImage(target, 'before', gid)
		var offset = ref == target ? vsize / 2 
			: ref != null ? vsize 
			: 0
		ref = ref || data.getImage(target, 'after', gid)

		// build the images...
		//var gids = data.getImages(gid, count, 'total')
		var gids = data.getImages(ref, count, 'total')
		gids
			.forEach(function(gid){
				// image...
				imgs.push(that.makeImage(gid, size))

				// marks...
				that.makeImageMarks(gid)
					.forEach(function(mark){ imgs.push(mark) })
			})

		// continue offset calculation...
		var l = gids.indexOf(ref)
		var x = (-(l * vsize) - offset)

		return vdom.h('div.ribbon'+base, {
			//key: 'ribbon-'+gid,

			// XXX events, hammer, ...???

			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
			},
			/*/ XXX
			style: {
				// XXX calling .centerImage(..) prevents this from updating...
				transform: 'translate3d('+ x +'vmin, 0px, 0px)',
			},
			//*/
		},
		imgs)
	},
	// XXX setup image handlers...
	// 		...or move them up to viewer or some other spot (viewer?)...
	// XXX update image previews...
	makeImage: function(gid, size){
		var ig = this.imagegrid
		//size = this.state.tile_size = size 
		size = size 
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
			//key: 'image-'+gid,

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
			//key: 'mark-'+type+'-'+gid,
			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
			},
		})
	},

	// XXX add ability to hook in things like current image marker...
	
	clear: function(){
		delete this.state
		delete this.dom
		delete this.vdom
		return this
	},

	// NOTE: virtual-dom architecture is designed around a fast-render-on-demand
	// 		concept, so we build the state on demand...
	sync: function(target, size){
		var dom = this.dom = this.dom 
			// get/create the ribbon-set...
			|| this.imagegrid.ribbons.getRibbonSet(true)

		var state = this.state ? Object.create(this.state) : {}
		target && (state.target = target)
		size && (state.count = size)

		// build initial state...
		if(this.vdom == null){
			var n = this.vdom = this.makeView(state)
			var v = vdom.create(n)
			dom.replaceWith(v)
			this.dom = v

		// patch state...
		} else {
			var n = this.makeView(state)
			var diff = vdom.diff(this.vdom, n)
			vdom.patch(dom, diff)
			this.vdom = n
		}

		return this
	},
	// XXX should this do a full or partial .clear()???
	reset: function(){
		delete this.dom
		delete this.vdom
		if(this.state){ 
			delete this.state.tile_size 
		}

		return this
			.sync()
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
		//
		// NOTE: for all jump animations to run this must be at least 3
		// 		screen widths...
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

			size = 5

			// XXX add threshold test -- we do not need this on every action...

			this.virtualdom.sync(target, size)
			this.centerViewer(target)
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
				console.warn('EXPERIMENTAL: '
					+'starting virtual-dom version of partial ribbons...') }],

		['clear',
			function(){ this.virtualdom.clear() }],
		['fitImage toggleSingleImage',
			function(){ delete this.virtualdom.state.tile_size }],

		['focusImage.pre', 
			function(target){ 
				var img = this.ribbons.getImage(target)

				// in-place update...
				// XXX this is very rigid, need to make this more 
				// 		flexible and not hinder fast nav...
				if(img.length > 0){
					setTimeout((function(){
						this.ribbons.preventTransitions()
						this.updateRibbon(this.current) 
						this.ribbons.restoreTransitions()
					}).bind(this), 200)

				// long-jump...
				} else {
					this.updateRibbon(target) 
				}
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
