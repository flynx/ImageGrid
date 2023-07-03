/**********************************************************************
* 
*
* Features:
* 	- ui-ribbons-render
* 	- ui-ribbons-edit-render
* 	- ui-partial-ribbons
*	- ui-animation
*		manage UI non-css animations...
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

var ribbons = require('imagegrid/ribbons')



/*********************************************************************/
// helpers...

// XXX make this compatible with multiple images...
// XXX for muptiple targets this will just do a .reload()...
var updateImagePosition =
function updateImagePosition(actions, target){
	var s = actions.ribbons.getRibbonLocator()

	if(s.length == 0){
		return
	}

	target = target || actions.current
	target = target instanceof jQuery 
		? actions.ribbons.elemGID(target) 
		: target

	var source_ribbon = actions.ribbons.elemGID(actions.ribbons.getRibbon(target))
	var source_order = actions.data.getImageOrder(target)

	return function(){
		actions.ribbons.preventTransitions(s)
		var end = function(){
			// XXX not sure why this does not work without a setTimeout(..)
			//actions.ribbons.restoreTransitions(s, true)
			setTimeout(function(){ 
				actions.ribbons.restoreTransitions(s, true) }, 0) }

		// XXX hack???
		if(target instanceof Array){
			actions.reload(true)
			return end()
		}

		var target_ribbon = actions.data.getRibbon(target)

		// nothing changed...
		if(source_ribbon == target_ribbon 
				&& actions.data.getImageOrder(target) == source_order){
			return end()
		}

		// place image at position...
		var to = actions.data.getImage(target, 'next')
		if(to != null){
			actions.ribbons.placeImage(target, to, 'before')

		} else {
			// place image after position...
			to = actions.data.getImage(target, 'prev')
			if(to != null){
				actions.ribbons.placeImage(target, to, 'after')

			// new ribbon...
			} else {
				to = actions.data.getRibbon(target)

				if(actions.ribbons.getRibbon(to).length == 0){
					actions.ribbons
						.placeRibbon(to, actions.data.getRibbonOrder(target))
				}

				actions.ribbons.placeImage(target, to)
			}
		}

		if(actions.data.getImages(source_ribbon).length == 0){
			actions.ribbons.getRibbon(source_ribbon).remove()
		}

		actions.focusImage()

		return end()
	}
}



/*********************************************************************/
// Base ribbons viewer...

var RibbonsActions = 
actions.Actions({

	get dom(){
		return this.ribbons ? this.ribbons.viewer : undefined },
	

	load: [
		function(data){
			return function(){
				// recycle the viewer if one is not given specifically...
				var viewer = data.viewer
				viewer = viewer == null && this.ribbons != null 
					? this.dom 
					: viewer

				if(this.ribbons == null){
					this.ribbons = ribbons.Ribbons(viewer, this.images)
					// XXX is this correct???
					this.ribbons.__image_updaters = [this.updateImage.bind(this)]

					this.dom.trigger('ig.attached')

				} else {
					this.ribbons.clear()
					this.ribbons.images = this.images
				}

				this.reload()
			}
		}],
	// NOTE: this will pass the .ribbons.updateData(..) a custom ribbon 
	// 		updater if one is defined here as .updateRibbon(target) action
	//
	// XXX HACK: two sins:
	// 		- actions.updateRibbon(..) and ribbons.updateRibbon(..)
	// 		  are NOT signature compatible...
	// 		- we depend on the internals of a custom add-on feature
	reload: ['Interface/Reload viewer',
		function(force){
			// full reload...
			if(force == 'full'){
				//this.stop()
				/*
				killAllWorkers()
					.done(function(){
						reload() 
					})
				*/
				return location.reload()
			}

			this.ribbons.preventTransitions()

			// NOTE: this essentially sets the update threshold to 0...
			// XXX this should be a custom arg...
			force = force ? 0 : null

			return function(){
				// see if we've got a custom ribbon updater...
				var that = this
				var settings = this.updateRibbon != null 
					// XXX this should be: { updateRibbon: this.updateRibbon.bind(this) }
					? { updateRibbon: function(_, ribbon){ 
							return that.updateRibbon(ribbon, null, null, force) 
						} }
					: null

				this.ribbons.updateData(this.data, settings)

				this
					// XXX should this be here???
					.refresh()
					.focusImage()

				// XXX HACK to make browser redraw images...
				this.scale = this.scale

				this.ribbons.restoreTransitions()
			}
		}],
	// NOTE: this will trigger .updateImage hooks...
	refresh: ['Interface/Refresh images without reloading',
		function(gids, scale){
			gids = gids || '*'
			var size = scale != null ? 
				this.ribbons.getVisibleImageSize('min', scale)
				: null

			this.ribbons.updateImage(gids, null, size)
		}],
	clear: [
		function(){ this.ribbons && this.ribbons.clear() }],
	// XXX do we need clone???
	clone: [function(full){
		return function(res){
			if(this.ribbons){
				// NOTE: this is a bit wasteful as .ribbons will clone 
				// 		their ref to .images that we will throw away...
				res.ribbons = this.ribbons.clone()
				res.ribbons.images = res.images
			} 
		}
	}],


	replaceGID: [
		function(from, to){
			return function(res){
				res && this.ribbons.replaceGID(from, to)
			}
		}],


	// This is called by .ribbons, the goal is to use it to hook into 
	// image updating from features and extensions...
	//
	// NOTE: not intended for calling manually, use .refresh(..) instead...
	//
	// XXX EXPERIMENTAL...
	// 		...need this to get triggered by .ribbons
	// 		at this point manually triggering this will not do anything...
	// XXX problem: need to either redesign this or distinguish from 
	// 		other actions as I keep calling it expecting results...
	// XXX hide from user action list... (???)
	updateImage: ['- Interface/Update image (do not use directly)',
		'This is called by .refresh(..) and intended for use as an '
			+'trigger for handlers, and not as a user-callable acation.',
		core.Event(function(gid, image){
			// This is the image update protocol root function
			//
			// Not for direct use.
		})],

	// NOTE: this not used directly, mainly designed as a utility to be 
	// 		used for various partial ribbon implementations...
	// XXX do we handle off-screen ribbons here???
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


	// NOTE: this will align only a single image...
	// XXX do we need these low level primitives here???
	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align, offset, scale){
			target = target instanceof jQuery 
				? this.ribbons.elemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align, offset, scale)
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.elemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerRibbon(target)
		}],


	// XXX should these be here, in ui or in ribbons???
	// XXX these are identical to features/ui-preact-render.js
	focusImage: [
		function(target, list){
			return function(){
				this.ribbons.focusImage(this.data != null ? this.current : target) } }],
	focusRibbon: [
		function(target, mode){
			mode = mode || this.config['ribbon-focus-mode']

			var c = this.data.getRibbonOrder()
			var i = this.data.getRibbonOrder(target)
			// NOTE: we are not changing the direction here based on 
			// 		this.direction as swap will confuse the user...
			var direction = c < i ? 'before' : 'after'

			if(mode == 'visual'){
				var ribbons = this.ribbons
				var r = this.data.getRibbon(target)
				var t = ribbons.getImageByPosition('current', r)

				if(t.length > 1){
					t = t.eq(direction == 'before' ? 0 : 1)
				}

				t = ribbons.elemGID(t)

				this.focusImage(t, r)
			}
		}],


	// Zoom/scale protocol...
	resizing: [
		core.Event(function(unit, size, overflow){
			// This is a resizing protocol root function.
			//
			// This will never be used directly, but will wrap protocol user
			// functions.
			//
			// As an example see: .viewScale(..)

			var that = this
			// stop currently running transition...
			this.ribbons.scale(this.ribbons.scale())

			// transitionend handler...
			if(!this.__resize_handler){
				this.__resize_handler = function(){
					that.__post_resize
						&& that.resizingDone() 
					delete that.__post_resize
				}
			}
			this.ribbons.getRibbonSet()
				.off('transitionend', this.__resize_handler)
				.on('transitionend', this.__resize_handler)

			// timeout handler...
			this.__post_resize && clearTimeout(this.__post_resize)
			return function(){
				this.__post_resize = setTimeout(
					this.__resize_handler, 
					this.config['resize-done-timeout'] || 300)
			}
		})],

	viewScale: ['- Zoom/',
		function(scale){
			if(scale == null || scale == '?'){
				return this.ribbons != null ? this.ribbons.scale() : null
			}

			this.resizing.chainCall(this, function(){
				this.ribbons 
					&& scale 
					&& this.ribbons.scale(scale)
				// NOTE: we pass explicit scale here to compensate for animation...
				this.refresh('*', scale)
			}, 'scale', scale)
		}],
	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	// NOTE: this will add .config['fit-overflow'] to odd counts if no 
	// 		overflow if passed.
	// 		...this is done to add ability to control scroll indication.
	fitImage: ['Zoom/Fit image',
		function(count, overflow){
			if(count == '?'){
				return this.ribbons != null ? 
					this.ribbons.getScreenWidthImages() 
					: null
			}

			this.resizing.chainCall(this, function(){
				if(count != null){
					overflow = overflow == false ? 0 : overflow
					var o = overflow != null ? overflow 
						: count % 2 != 1 ? 0
						: (this.config['fit-overflow'] || 0)
					count += o
				}
				// XXX .ribbons...
				this.ribbons.fitImage(count)
				// NOTE: we pass explicit scale here to compensate for animation...
				this.refresh('*', this.ribbons.getScreenWidthImages(1) / count)
			}, 'screenwidth', count, overflow)
		}],
	// NOTE: this does not account for ribbon spacing...
	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count, whole){
			if(count == '?'){
				return this.ribbons != null ? 
					this.ribbons.getScreenHeightRibbons() 
					: null
			}

			this.resizing.chainCall(this, function(){
				// XXX .ribbons...
				this.ribbons.fitRibbon(count, whole)
				// NOTE: we pass explicit scale here to compensate for animation...
				this.refresh('*', this.ribbons.getScreenHeightRibbons(1, whole) / count)
			}, 'screenheight', count, whole)
		}],


	ribbonRotation: ['- Interface|Ribbon/', 
		function(a){ 
			if(arguments.length > 0){
				this.ribbons.rotate(a)

			} else {
				return this.ribbons.rotate() || 0
			}
		}],
})


var Ribbons = 
module.Ribbons = 
core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbons-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX this causes a dependency loop -- ui <-> ui-render...
		//'ui',
		'base',
	],
	suggested: [
		'ui-animation',
		'ui-ribbons-edit-render',
		'ui-partial-ribbons',
	],

	isApplicable: function(){ return this.runtime.browser },

	actions: RibbonsActions, 

	handlers: [],
})



//---------------------------------------------------------------------
// Edit...

var RibbonsEditActions = 
actions.Actions({
	setBaseRibbon: [
		function(target){
			var r = this.data.getRibbon(target)
			r =  r == null ? this.ribbons.getRibbon(target) : r
			this.ribbons.setBaseRibbon(r)
		}],
	shiftImageLeft: [
		function(target){ this.ribbons.placeImage(target, -1) }],
	shiftImageRight: [
		function(target){ this.ribbons.placeImage(target, 1) }],
	shiftRibbonUp: [
		function(target){
			target = this.ribbons.getRibbon(target)
			var i = this.ribbons.getRibbonOrder(target)
			if(i > 0){
				this.ribbons.placeRibbon(target, i-1)
			}
		}],
	shiftRibbonDown: [
		function(target){
			target = this.ribbons.getRibbon(target)
			var i = this.ribbons.getRibbonOrder(target)
			if(i < this.data.ribbon_order.length-1){
				this.ribbons.placeRibbon(target, i+1)
			}
		}],

	// basic image editing...
	//
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: [ 
		function(target){ this.ribbons.rotateCW(target) }],
	rotateCCW: [ 
		function(target){ this.ribbons.rotateCCW(target) }],
	flipVertical: [ 
		function(target){ this.ribbons.flipVertical(target, 'view') }],
	flipHorizontal: [
		function(target){ this.ribbons.flipHorizontal(target, 'view') }],

	// tags...
	tag: [ 
		function(tags, gids){ 
			gids = (gids instanceof Array || gids == null) ? gids : [gids]
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],
	untag: [
		function(tags, gids){ 
			gids = (gids instanceof Array || gids == null) ? gids : [gids]
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],
})

var RibbonsEdit = 
module.RibbonsEdit = 
core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbons-edit-render',
	depends: [
		'ui',
		'edit',
		'tags',
		'sort',
		'crop',
		'image-group',
		'ui-ribbons-render',
	],

	actions: RibbonsEditActions, 

	handlers: [
		[[
			'shiftImageTo.pre',
			'shiftImageUp.pre',
			'shiftImageDown.pre',
		], 
			function(target){ 
				return updateImagePosition(this, target) }],

		// reloading and updating...
		[[
			'sortImages',
			'alignToRibbon',
			'group',
			'ungroup',
			'groupTo',
			'groupMarked',
			'expandGroup',
			'collapseGroup',
			'crop',
			'uncrop',
			'addToCrop',
			'removeFromCrop',
			'reverseImages',
		], 
			function(target){ 
				return this.reload(true) }],
		[[
			'reverseRibbons',
			'cropGroup',
			'syncTags',
		], 
			function(target){ 
				return this.reload() }],
	],
})



/*********************************************************************/
// Partial ribbons...

// XXX try using .ribbons.resizeRibbon(..) for basic tasks...
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX .updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = 
actions.Actions({
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
				? this.ribbons.elemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target, 'before')
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

var PartialRibbons = 
module.PartialRibbons = 
core.ImageGridFeatures.Feature({
	title: 'Partial Ribbons',
	doc: core.doc`Maintains partially loaded ribbons, this enables very large
	image sets to be handled efficiently.`,

	// NOTE: partial ribbons needs to be setup first...
	// 		...the reasons why things break otherwise is not too clear.
	priority: 'high',

	tag: 'ui-partial-ribbons',
	exclusive: ['ui-partial-ribbons'],
	depends: [
		'ui',
		'ui-ribbons-render',
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
				target = list != null ? this.data.getImage(target, list) : target

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



/*********************************************************************/
// Animation...

// XXX at this point this does not support target lists...
// XXX shift up/down to new ribbon is not too correct...
// XXX depends on .ribbons.makeShadow(..)...
var ShiftAnimation =
module.ShiftAnimation = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-animation',
	depends: [
		'ui',
		'ui-ribbons-render',
	],
	// NOTE: this will allow the animations to start as early as possible
	// 		in the action call...
	priority: 'high',

	config: {
		// XXX make this duration...
		'shadow-animation-delay': 200,
		'shadow-animation-start-delay': 0,
	},

	handlers: [
		//['shiftImageUp.pre shiftImageDown.pre '
		//		+'travelImageUp.pre travelImageDown.pre', 
		['shiftImageUp.pre shiftImageDown.pre',
			function(target){
				// XXX do not do target lists...
				if(target != null && target instanceof Array 
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target, true, 
					// XXX make this duration...
					this.config['shadow-animation-delay'],
					this.config['shadow-animation-start-delay'])
				return function(){ s() }
			}],
		// NOTE: this will keep the shadow in place -- the shadow will not
		// 		go to the mountain, the mountain will come to the shadow ;)
		['shiftImageLeft.pre shiftImageRight.pre', 
			function(target){
				// XXX do not do target lists...
				if(target != null && target instanceof Array
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target, undefined,
					// XXX make this duration...
					this.config['shadow-animation-delay'],
					this.config['shadow-animation-start-delay'])
				return function(){ s() }
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
