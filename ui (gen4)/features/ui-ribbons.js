/**********************************************************************
* 
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

var RibbonsActions = actions.Actions({

	get dom(){
		return this.ribbons ? this.ribbons.viewer : undefined },
	

	// NOTE: this expects that ribbons will maintain .parent.images...
	// NOTE: when getting rid of ribbons need to also remove the .parent
	// 		reference...
	// XXX remove...
	get ribbons(){
		return this.__ribbons },
	set ribbons(ribbons){
		this.__ribbons = ribbons
		ribbons.parent = this
	},


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
				location.reload()
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


	replaceGid: [
		function(from, to){
			return function(res){
				res && this.ribbons.replaceGid(from, to)
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
		core.notUserCallable(function(gid, image){
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
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align, offset, scale)
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerRibbon(target)
		}],


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

				t = ribbons.getElemGID(t)

				this.focusImage(t, r)
			}
		}],

	// Zoom/scale protocol...
	resizing: [
		core.notUserCallable(function(unit, size, overflow){
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

	// XXX move all the stuff from UI that binds actions to ribbons...
	// XXX
})


var Ribbons = 
module.Ribbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbons-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX
	],
	suggested: [
		'ui-ribbons-edit-render',
	],

	actions: RibbonsActions, 

	handlers: [],
})



//---------------------------------------------------------------------
// XXX

var PartialRibbonsActions = actions.Actions({
})

var PartialRibbons = 
module.PartialRibbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-partial-ribbons-render',
	exclusive: ['ui-render'],
	depends: [
		// XXX this will need to reuse part of the actions defined in Ribbons...
	],
	suggested: [
		'ui-ribbons-edit-render',
	],

	actions: PartialRibbonsActions, 

	handlers: [],
})


//---------------------------------------------------------------------

var RibbonsEditActions = actions.Actions({
})


var RibbonsEdit = 
module.RibbonsEdit = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbons-edit-render',
	depends: [
		'edit',
	],

	actions: RibbonsEditActions, 

	handlers: [],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
