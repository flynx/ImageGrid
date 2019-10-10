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
if(typeof(window) != 'undefined'){
	window.vdom = vdom
}


//---------------------------------------------------------------------

var Ribbons = {
	//dom: null,

	// utils...
	px2v: null,
	px2vw: null,
	px2vh: null,
	px2vmin: null,
	px2vmax: null,
	preventTransitions: null,
	restoreTransitions: null,
	noTransitions: null,
	noTransitionsDeep: null,
	elemGID: null,
	replaceGID: null,

	makeShadow: null,

	parent: null,
	images: null,

	scale: null,
	rotate: null,

	getVisibleImageSize: null,
	getScreenWidthImages: null,
	getScreenHeightRibbons: null,

	// element getters...
	//getRibbonSet: null,
	//getRibbonLocator: null,
	//getImage: null,
	//getImageMarks: null,
	//getImageByPosition: null,
	//getRibbon: null,
	//getRibbonOrder: null,
	
	// XXX
	addImageEventHandler: function(evt, handler){
	},
	addRibbonEventHandler: function(evt, handler){
	},

	//placeRibbon: null,
	//placeImage: null,

	callImageUpdaters: null,
	_loadImagePreviewURL: null,
	//load_img_sync: null,
	updateImage: null,

	//updateRibbon: null,
	//updateRibbonInPlace: null,
	//resizeRibbon: null,

	//updateData: null,

	//clearEmptyRibbons: null,

	//focusImage: null,

	//setBaseRibbon: null,

	//toggleImageMark: null,

	//rotateImage: null,
	//getImageRotation: null,
	//rotateCW: null,
	//rotateCCW: null,
	//flipImage: null,
	//getImageFlip: null,
	//flipVertical: null,
	//flipHorizontal: null,

	// XXX
	_calcImageProportions: null,
	correctImageProportionsForRotation: null,

	centerRibbon: null,
	centerImage: null,

	fitImage: null,
	fitRibbon: null,

	clear: null,
	//clone: null,

	__init__: null,
}


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
//
//	- take care of DOM construction and update...
//	- alignment is done via .centerRibbon(..) / .centerImage(..)
//	- preview updates (XXX)
//		- update onload (a-la .ribbons._loadImagePreviewURL(..))

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
	makeView: function(state, initial){
		state = state || {}
		var that = this
		var ig = this.imagegrid

		var target = state.target || ig.current

		this.state = this.state || {}
		var count = state.count = state.count
			|| ig.screenwidth * (ig.config['ribbon-size-screens'] || 9)
		var s = state.scale = state.scale 
			|| ig.scale

		var data = ig.data
		var images = ig.images

		var ribbons = data.ribbon_order
			.map(function(gid){
				return that.makeRibbon(gid, target, count, state, initial) })

		return vdom.h('div.ribbon-set', 
			{
				//key: 'ribbon-set',
				style: {
					transform: 'scale('+ s +', '+ s +')',
				}
			}, [
				// current image indicator...
				vdom.h('div.current-marker'),

				// ribbon locator...
				vdom.h('div.ribbon-locator', 
					{
						//key: 'ribbon-locator',
					},
					ribbons),
			])
	},
	// XXX setup handlers (???)
	// XXX STUB: make aligning more extensible... (???)
	makeRibbon: function(gid, target, count, state, initial){
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

		// XXX not sure about this...
		var style = initial ? { transform: 'translate3d(120vw, 0, 0)' } : {}

		return vdom.h('div.ribbon'+base, {
			//key: 'ribbon-'+gid,

			// XXX events, hammer, ...???

			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
			},

			style: style,
		},
		imgs)
	},
	// XXX setup image handlers...
	// XXX update image previews...
	// XXX update image proportions for rotated images... (???)
	makeImage: function(gid, size){
		var ig = this.imagegrid
		//size = this.state.tile_size = size 
		size = size 
			|| this.state.tile_size
			|| ig.ribbons.getVisibleImageSize('max')
		var data = this.imagegrid.data
		var images = this.imagegrid.images || {}
		var current = data.current == gid ? '.current' : ''

		// resolve group preview cover...
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
			// XXX BUG:
			// 		- setting this makes the images some times not change previews...
			// 		- removing this breaks .current class setting...
			key: 'image-'+gid,

			attributes: {
				gid: JSON.stringify(gid)
					.replace(/^"(.*)"$/g, '$1'),
				orientation: image.orientation,
				flipped: image.flipped,

				// XXX preview size -- get this onload from image...
				//'preview-width': ..,
				//'preview-height': ..,
			},
			style: {
				// XXX need to update this onload if changing preview 
				// 		of same image...
				backgroundImage: 'url("'+ url +'")',
			}
		})
	},
	// XXX STUB: make marks handling extensible... (???)
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
				return vdom.h('div.mark.'+(type || ''), {
					key: 'mark-'+type+'-'+gid,
					attributes: {
						gid: JSON.stringify(gid)
							.replace(/^"(.*)"$/g, '$1'),
					},
				})
			})
	},

	// XXX add ability to hook in things like current image marker...
	

	// XXX these need .getImage(..) / .getRibbon(..) / .getRibbonLocator(..)
	centerRibbon: function(target){
		var ribbon = this.getRibbon(target)
		var locator = this.getRibbonLocator() 

		if(locator.length != 0 && ribbon.length != 0){
			var t = ribbon[0].offsetTop
			var h = ribbon[0].offsetHeight

			locator.transform({ x: 0, y: this.px2vh(-(t + h/2)) + 'vh', z: 0 }) 
		}
		return this
	},
	centerImage: function(target, mode){
		target = this.getImage(target)
		var ribbon = this.getRibbon(target)

		if(ribbon.length != 0){
			var l = target[0].offsetLeft
			var w = target[0].offsetWidth

			var image_offset = mode == 'before' ? 0
				: mode == 'after' ? w
				: w/2

			ribbon.transform({x: -this.px2vmin(l + image_offset) + 'vmin', y: 0, z: 0}) 
		}
		return this
	},

	scale: function(scale){
		if(scale){
			this.state.scale = scale
			this.sync()

		} else {
			return this.imagegrid.scale
		}
	},

	// XXX not sure how to proceed with these...
	setImageHandler: function(evt, handler){
	},
	setRibbonHandler: function(evt, handler){
	},



	clear: function(){
		this.dom
			&& this.dom.remove()

		delete this.state
		delete this.dom
		delete this.vdom

		return this
	},

	// NOTE: virtual-dom architecture is designed around a fast-render-on-demand
	// 		concept, so we build the state on demand...
	// XXX get scale from config on initial load...
	sync: function(target, size){
		var dom = this.dom

		var state = this.state ? Object.create(this.state) : {}
		target && (state.target = target)
		size && (state.count = size)

		// build initial state...
		if(this.vdom == null){
			var n = this.vdom = this.makeView(state, true)
			var v = vdom.create(n)
			this.imagegrid.dom.append(v)
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
	// XXX BUG: current image indicator resets but does not get shown...
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
object.Constructor('VirtualDOMRibbons', 
	VirtualDOMRibbonsClassPrototype,
	VirtualDOMRibbonsPrototype)



/*********************************************************************/
// XXX TODO:
// 		- shifting images/ribbons
// 			- use .virtualdom.sync() + shadow animation instead of .ribbons.*
// 				...the added marker div messes up virtual-dom...
// 			- would be nice to make this an alternative feature...
// 				...split out ribbon editing into a feature and do two 
// 				implementations, the original and virtualdom...
// 		- image update (try and avoid external edits and do it in .virtualdom)
// 			- image size/proportions (single image view)...
// 			- preview update...
// 		- make marks more modular...
// 			- ranges
// 				

var PartialRibbonsActions = actions.Actions({
	config: {
		// Number of screen widths to load...
		//
		// NOTE: for all jump animations to run this must be at least 3
		// 		screen widths...
		'ribbon-size-screens': 7,


	},

	get virtualdom(){
		return (this.__virtual_dom = this.__virtual_dom || VirtualDOMRibbons(this)) },


	// XXX
	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold){
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

			// XXX DEBUG
			//size = 5

			// XXX for some reason this does not set the .current class 
			// 		on the right image...
			this.virtualdom.sync(target, size)

			// XXX HACK: this fixes a bug in virtual-dom where .current
			// 		is not synced correctly...
			// 		...one theory I have is that we change the class 
			// 		manually, dom gets diffed and no change is detected
			// 		then the object gets recycled and the .current class
			// 		ends up on a different element...
			this.ribbons.focusImage(target)

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

		// disabled stuff...
		// XXX is this the right spot for these...
		'-ui-image-marks',
		'-ui-image-bookmarks',
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

		// XXX account for fast navigation...
		['focusImage.pre', 
			function(target){ 
				var img = this.ribbons.getImage(target)

				// in-place update...
				if(img.length > 0){
					// XXX need to account for running out of images and
					// 		not only on the current ribbon...
					if(!this.__partial_ribbon_update){
						this.__partial_ribbon_update = setTimeout((function(){
							delete this.__partial_ribbon_update
							this.ribbons.preventTransitions()

							this
								.updateRibbon(this.current)
								// NOTE: we are doing this manually because we
								// 		are running after the handler is done 
								// 		thus missing the base call...
								.alignRibbons(null, null, true)

							this.ribbons.restoreTransitions()
						}).bind(this), 150)
					}

				// long-jump...
				} else {
					if(this.__partial_ribbon_update){
						clearTimeout(this.__partial_ribbon_update)
						delete this.__partial_ribbon_update
					}

					this.updateRibbon(target) 
				}
			}],

		// marks...
		[[
			'toggleMark',
			'toggleBookmark',
		//], function(){ this.updateRibbon() }],
		], function(){ this.virtualdom.sync() }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
