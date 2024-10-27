/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(window) == 'undefined'){
	return
}


var vdom = require('ext-lib/virtual-dom')

var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var ribbons = require('imagegrid/ribbons')



/*********************************************************************/
// TODO:
//	- "dry run test" -- empty render feature that if use would not break
//		anything but not draw anything either... (use this as template)
//	- virtual-dom feature
//	- preact / react feature
// 
// 
// 
//	- take care of DOM construction and update...
//	- alignment is done via .centerRibbon(..) / .centerImage(..)
//	- preview updates (XXX)
//		- update onload (a-la .ribbons._loadImagePreviewURL(..))
//		

var VirtualDOMRibbonsClassPrototype = {
	// XXX
}
VirtualDOMRibbonsClassPrototype.__proto__ = ribbons.BaseRibbons.prototype.__proto__

// XXX make this ribbons.BaseRibbons compatible....
var VirtualDOMRibbonsPrototype = {
	// XXX this is a circular ref -- I do not like it...
	parent: null,

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
		var ig = this.parent

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
		var ig = this.parent
		var current = ig.current
		target = target || state.target || current
		var size = this.state.tile_size = state.tile_size
			|| this.state.tile_size 
			|| this.getVisibleImageSize('max')
		var scale = state.scale = state.scale 
			|| ig.scale
		var data = ig.data
		var images = ig.images
		// XXX
		var ribbons = ig.ribbons
		var base = data.base == gid ? '.base' : ''
		var imgs = []

		this.state = this.state || {}
		//this.state.ribbons = this.state.ribbons || {}
		
		// XXX
		var size = this.state.tile_size = 
			this.state.tile_size 
				|| this.getVisibleImageSize('max')

		// calculate offset...
		// XXX this accounts for only one offset mode...
		// 		...make this extensible...
		// XXX
		var vsize = this.px2vmin(size / scale)
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
		var ig = this.parent
		//size = this.state.tile_size = size 
		size = size 
			|| this.state.tile_size
			|| this.getVisibleImageSize('max')
		var data = this.parent.data
		var images = this.parent.images || {}
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
		var tags = this.parent.data.getTags(gid)

		// XXX STUB: make this extensible...
		tags.indexOf('bookmark') >= 0 
			&& marks.push('bookmark')
		tags.indexOf('marked') >= 0 
			&& marks.push('marked')

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
			return this.parent.scale
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
			this.parent.dom.append(v)
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

	__init__: function(parent){
		this.parent = parent || this.parent
	},
}
VirtualDOMRibbonsPrototype.__proto__ = ribbons.BaseRibbons.prototype


var VirtualDOMRibbons =
module.VirtualDOMRibbons =
object.Constructor('VirtualDOMRibbons', 
	VirtualDOMRibbonsClassPrototype,
	VirtualDOMRibbonsPrototype)



//---------------------------------------------------------------------

var VirtualDomActions = actions.Actions({

	get dom(){
		return this.__dom },
	set dom(value){
		this.__dom = value},

	// XXX setup .ribbons...
	load: [
		function(data){
			return function(){
				// recycle the viewer if one is not given specifically...
				var viewer = data.viewer
				viewer = viewer == null ? this.dom : viewer

				if(this.dom == null){
					this.dom = viewer
					this.ribbons = new VirtualDOMRibbons()

				} else {
					this.ribbons.clear()
				}

				this.reload()
			}
		}],
	reload: ['Interface/Reload viewer',
		function(){
			this.ribbons.reset()
			this.focusImage()
		}],
	// XXX this ignores it's args...
	refresh: ['Interface/Refresh images without reloading',
		function(gids, scale){
			this.ribbons.sync()
			this.focusImage()
		}],


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
			this.ribbons.sync(target, size)

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

var VirtualDom = 
module.VirtualDom = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-vdom-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX
	],

	actions: VirtualDomActions, 

	handlers: [
		['clear',
			function(){ this.ribbons.clear() }],
		['fitImage toggleSingleImage',
			function(){ delete this.ribbons.state.tile_size }],

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
		], function(){ this.ribbons.sync() }],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
