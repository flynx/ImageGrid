/**********************************************************************
* 
*
* Base architecture:
*
* 	Two trees are maintained:
* 		- no-gui
* 		- gui
*
* 	no-gui:
* 		aggregates:
* 			data
* 			images
* 		defines universal set of actions to manage and control state
*
* 	gui:
* 		extends no-gui and adds:
* 			ribbons
* 		extends and defines a set of gui control and state actions
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> viewer')

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var data = require('data')
var images = require('images')
var ribbons = require('ribbons')



/*********************************************************************/
// helpers...

function reloadAfter(force){
	return function(){
		return function(){
			// NOTE: this may seem like cheating, but .reload() should
			// 		be very efficient, reusing all of the items loaded...
			this.reload(force)
		}
	}
}


// XXX make this compatible with multiple images...
// XXX for muptiple targets this will just do a .reload()...
function updateImagePosition(actions, target){
	if(actions.ribbons.getRibbonSet().length == 0){
		return
	}

	target = target || actions.current
	target = target instanceof jQuery 
		? actions.ribbons.getElemGID(target) 
		: target

	var source_ribbon = actions.ribbons.getElemGID(actions.ribbons.getRibbon(target))
	var source_order = actions.data.getImageOrder(target)

	return function(){
		actions.ribbons.preventTransitions()

		// XXX hack...
		if(target.constructor === Array){
			actions.reload()
			return
		}

		var target_ribbon = actions.data.getRibbon(target)

		// nothing changed...
		if(source_ribbon == target_ribbon 
				&& actions.data.getImageOrder(target) == source_order){
			return
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
					actions.ribbons.placeRibbon(to, actions.data.getRibbonOrder(target))
				}

				actions.ribbons.placeImage(target, to)
			}
		}

		if(actions.data.getImages(source_ribbon).length == 0){
			actions.ribbons.getRibbon(source_ribbon).remove()
		}

		actions.focusImage()

		actions.ribbons.restoreTransitions(true)
	}
}


// mode can be:
// 	"ribbon"	- next marked in current ribbon (default)
// 	"all"		- next marked in sequence
//
// XXX add support for tag lists...
function makeTagWalker(direction, dfl_tag){
	var meth = direction == 'next' ? 'nextImage' : 'prevImage'

	return function(tag, mode){
		mode = mode == null ? 'all' : mode
		tag = tag || dfl_tag

		// account for no tags or no images tagged...
		var lst = this.data.tags != null ? this.data.tags[tag] : []
		lst = lst || []

		if(mode == 'ribbon'){
			this[meth](this.data.getImages(lst, 'current'))

		} else {
			this[meth](lst)
		}
	}
}



/*********************************************************************/

var ImageGridFeatures =
module.ImageGridFeatures = Object.create(features.FeatureSet)



/*********************************************************************/
//
// XXX Tasks to accomplish here:
// 	- life-cycle actions/events
// 		- setup
// 		- reset
// 	- "features" and the mechanism to turn them on or off (action-sets)
//
//

var BaseActions = 
module.BaseActions = 
actions.Actions({

	config: {
		// see .direction for details...
		'steps-to-change-direction': 3,
	},

	// basic state...
	// NOTE: the setters in the following use the appropriate actions
	// 		so to avoid recursion do not use these in the specific 
	// 		actions...
	
	// Base ribbon...
	get base(){
		return this.data == null ? null : this.data.base
	},
	set base(value){
		this.setBaseRibbon(value)
	},

	// Current image...
	get current(){
		return this.data == null ? null : this.data.current
	},
	set current(value){
		this.focusImage(value)
	},

	// Current ribbon...
	get currentRibbon(){
		return this.data == null ? null : this.data.getRibbon()
	},
	set currentRibbon(value){
		this.focusRibbon(value)
	},

	// Default direction...
	//
	// This can be 'left' or 'right', other values are ignored.
	//
	// The system has inertial direction change, after >N steps of 
	// movement in one direction it takes N steps to reverse the default
	// direction.
	// The number of steps (N) is set in:
	// 		.config['steps-to-change-direction']
	//
	// NOTE: to force direction change append a '!' to the direction.
	// 		e.g. X.direction = 'left!'
	get direction(){
		return this._direction >= 0 ? 'right'
			: this._direction < 0 ? 'left'
			: 'right'
	},
	set direction(value){
		// force direction change...
		if(value.slice(-1) == '!'){
			this._direction = value == 'left!' ? -1
				: value == 'right!' ? 0
				: this._direction

		// 'update' direction...
		} else {
			value = value == 'left' ? -1 
				: value == 'right' ? 1
				: 0
			var d = (this._direction || 0) + value
			var s = this.config['steps-to-change-direction']
			s = s < 1 ? 1 : s
			// cap the direction value between -s and s-1...
			// NOTE: we use s-1 instead of s as 0/null is a positive 
			// 		direction...
			d = d >= s ? s-1 : d
			d = d < -s ? -s : d
			this._direction = d
		}
	},

	// basic life-cycle actions...
	//
	// XXX do we need to call .syncTags(..) here???
	load: ['File|Interface/',
		function(d){
			this.images = images.Images(d.images)
			this.data = data.Data(d.data)
		}],
	clear: ['File|Interface/',
		function(){
			delete this.data
			delete this.images
		}],

	// XXX should this be here???
	loadURLs: ['File/Load a URL list',
		function(lst){
			this.images = images.Images.fromArray(lst)
			this.data = data.Data.fromArray(this.images.keys())
		}],

	// XXX experimental...
	// 		...the bad thing about this is that we can not extend this,
	// 		adding new items to the resulting structure...
	// XXX is this the correct way to go???
	// 		...can we save simple attribute values???
	json: ['File/Dump state as JSON object',
		'This will collect JSON data from every available attribute '
			+'supporting the .dumpJSON() method.',
		function(){
			var res = {}
			for(var k in this){
				if(this[k] != null && this[k].dumpJSON != null){
					res[k] = this[k].dumpJSON()
				}
			}
			return res
		}],


	// basic navigation...
	//
	focusImage: ['Navigate/Focus image',
		function(img, list){
			this.data.focusImage(img, list)
		}],
	focusRibbon: ['Navigate/Focus Ribbon',
		function(target){
			var data = this.data
			var r = data.getRibbon(target)
			if(r == null){
				return
			}
			var c = data.getRibbonOrder()
			var i = data.getRibbonOrder(r)

			// NOTE: we are not changing the direction here based on 
			// 		this.direction as swap will confuse the user...
			var direction = c < i ? 'before' : 'after'

			var t = data.getImage(r, direction)

			// if there are no images in the requied direction, try the 
			// other way...
			t = t == null ? data.getImage(r, direction == 'before' ? 'after' : 'before') : t

			this.focusImage(t, r)
		}],
	setBaseRibbon: ['Edit/Set base ribbon',
		function(target){ this.data.setBase(target) }],

	// shorthands...
	// XXX do we reset direction on these???
	firstImage: ['Navigate/First image in current ribbon',
		function(all){ this.focusImage(all == null ? 'first' : 0) }],
	lastImage: ['Navigate/Last image in current ribbon',
		function(all){ this.focusImage(all == null ? 'last' : -1) }],
	// XXX these break if image at first/last position are not loaded (crop, group, ...)
	// XXX do we actually need these???
	firstGlobalImage: ['Navigate/First globally image',
		function(){ this.firstImage(true) }],
	lastGlobalImage: ['Navigate/Last globally image',
		function(){ this.lastImage(true) }],

	// XXX skip unloaded images...
	prevImage: ['Navigate/Previous image',
		function(a){ 
			// keep track of traverse direction...
			this.direction = 'left'

			if(typeof(a) == typeof(123)){
				// XXX should this force direction change???
				this.focusImage(this.data.getImage('current', -a)
						// go to the first image if it's closer than s...
						|| this.data.getImage('first'))

			} else {
				this.focusImage('prev', a) 
			}
		}],
	nextImage: ['Navigate/Next image',
		function(a){ 
			// keep track of traverse direction...
			this.direction = 'right'

			if(typeof(a) == typeof(123)){
				// XXX should this force direction change???
				this.focusImage(this.data.getImage('current', a)
						// go to the first image if it's closer than s...
						|| this.data.getImage('last'))

			} else {
				this.focusImage('next', a) 
			}
		}],

	// XXX skip unloaded images...
	prevImageInOrder: ['Navigate/Previous image in order',
		function(){ this.prevImage(this.data.getImages(this.data.order)) }],
	nextImageInOrder: ['Navigate/Next image in order',
		function(){ this.nextImage(this.data.getImages(this.data.order)) }],

	// XXX should these be here???
	prevTagged: ['Navigate/Previous image tagged with tag',
		makeTagWalker('prev')],
	nextTagged: ['Navigate/Next image tagged with tag',
		makeTagWalker('next')],

	firstRibbon: ['Navigate/First ribbon',
		function(){ this.focusRibbon('first') }],
	lastRibbon: ['Navigate/Last ribbon',
		function(){ this.focusRibbon('last') }],
	prevRibbon: ['Navigate/Previous ribbon',
		function(){ this.focusRibbon('before') }],
	nextRibbon: ['Navigate/Next ribbon',
		function(){ this.focusRibbon('after') }],


	// basic ribbon editing...
	//
	// NOTE: for all of these, current/ribbon image is a default...

	// XXX to be used for things like mark/place and dragging...
	shiftImageTo: ['Edit|Sort/',
		function(target, to){
			// XXX
		}],
	
	shiftImageUp: ['Edit/Shift image up',
		'If implicitly shifting current image (i.e. no arguments), focus '
			+'will shift to the next or previous image in the current '
			+'ribbon depending on current direction.',
		function(target){ 
			// by default we need to focus another image in the same ribbon...
			if(target == null){
				var direction = this.direction == 'right' ? 'next' : 'prev'

				var cur = this.data.getImage()
				var next = this.data.getImage(direction)
				next = next == null 
					? this.data.getImage(direction == 'next' ? 'prev' : 'next') 
					: next

				this.data.shiftImageUp(cur)
				this.focusImage(next)

			// if a specific target is given, just shift it...
			} else {
				this.data.shiftImageUp(target)
			}
		}],
	shiftImageDown: ['Edit/Shift image down',
		'If implicitly shifting current image (i.e. no arguments), focus '
			+'will shift to the next or previous image in the current '
			+'ribbon depending on current direction.',
		function(target){ 
			// by default we need to focus another image in the same ribbon...
			if(target == null){
				var direction = this.direction == 'right' ? 'next' : 'prev'

				var cur = this.data.getImage()
				var next = this.data.getImage(direction)
				next = next == null 
					? this.data.getImage(direction == 'next' ? 'prev' : 'next') 
					: next

				this.data.shiftImageDown(cur)
				this.focusImage(next)

			// if a specific target is given, just shift it...
			} else {
				this.data.shiftImageDown(target)
			}
		}],
	shiftImageUpNewRibbon: ['Edit/Shift image up to a new empty ribbon',
		function(target){
			this.data.newRibbon(target)
			this.shiftImageUp(target)
		}],
	shiftImageDownNewRibbon: ['Edit/Shift image down to a new empty ribbon',
		function(target){
			this.data.newRibbon(target, 'below')
			this.shiftImageDown(target)
		}],
	shiftImageLeft: ['Edit|Sort/Shift image left',
		function(target){ 
			if(target == null){
				this.direction = 'left'
			}
			this.data.shiftImageLeft(target) 
			this.focusImage()
		}],
	shiftImageRight: ['Edit|Sort/Shift image right',
		function(target){ 
			if(target == null){
				this.direction = 'right'
			}
			this.data.shiftImageRight(target) 
			this.focusImage()
		}],

	shiftRibbonUp: ['Edit/Shift ribbon up',
		function(target){ 
			this.data.shiftRibbonUp(target) 
			// XXX is this the right way to go/???
			this.focusImage()
		}],
	shiftRibbonDown: ['Edit/Shift ribbon down',
		function(target){ 
			this.data.shiftRibbonDown(target)
			// XXX is this the right way to go/???
			this.focusImage()
		}],

	// these operate on the current image...
	travelImageUp: ['Edit/Travel with the current image up (Shift up and keep focus)',
		function(target){
			target = target || this.current
			this.shiftImageUp(target)
			this.focusImage(target)
		}],
	travelImageDown: ['Edit/Travel with the current image down (Shift down and keep focus)',
		function(target){
			target = target || this.current
			this.shiftImageDown(target)
			this.focusImage(target)
		}],

	
	reverseImages: ['Edit|Sort/Reverse image order',
		function(){ this.data.reverseImages() }],
	reverseRibbons: ['Edit|Sort/Reverse ribbon order',
		function(){ this.data.reverseRibbons() }],

	// XXX align to ribbon...

	// XXX this also requires images...
	sortImages: ['Sort/',
		function(method){ 
		}],

	// basic image editing...
	//
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: ['Image|Edit/', 
		function(target){ 
			if(this.images != null){
				this.images.rotateImage(this.data.getImage(target), 'cw')
			}
		}],
	rotateCCW: ['Image|Edit/', 
		function(target){ 
			if(this.images != null){
				this.images.rotateImage(this.data.getImage(target), 'ccw')
			}
		}],
	flipVertical: ['Image|Edit/',
		function(target){ 
			if(this.images != null){
				this.images.flipImage(this.data.getImage(target), 'vertical')
			}
		}],
	flipHorizontal: ['Image|Edit/',
		function(target){ 
			if(this.images != null){
				this.images.flipImage(this.data.getImage(target), 'horizontal')
			}
		}],


	// tags...
	//
	// XXX mark updated...
	tag: ['Tag/Tag image(s)',
		function(tags, gids){
			gids = gids || this.current
			gids = gids.constructor !== Array ? [gids] : gids
			tags = tags.constructor !== Array ? [tags] : tags

			// data...
			this.data.tag(tags, gids)

			// images...
			var images = this.images
			gids.forEach(function(gid){
				var img = images[gid]
				if(img == null){
					img = images[gid] = {}
				}
				if(img.tags == null){
					img.tags = []
				}

				img.tags = img.tags.concat(tags).unique()

				// XXX mark updated...
			})
		}],
	// XXX mark updated...
	untag: ['Tag/Untag image(s)',
		function(tags, gids){
			gids = gids || this.current
			gids = gids.constructor !== Array ? [gids] : gids
			tags = tags.constructor !== Array ? [tags] : tags

			// data...
			this.data.untag(tags, gids)

			// images...
			var images = this.images
			gids.forEach(function(gid){
				var img = images[gid]
				if(img == null || img.tags == null){
					return
				}

				img.tags = img.tags.filter(function(tag){ return tags.indexOf(tag) < 0 })

				if(img.tags.length == 0){
					delete img.tags
				}

				// XXX mark updated...
			})
		}],
	// Sync tags...
	//
	// 	Sync both ways...
	//	.syncTags()
	//	.syncTags('both')
	//
	//	Sync from .data
	//	.syncTags('data')
	//
	//	Sync from .images
	//	.syncTags('images')
	//
	//	Sync from <images> object
	//	.syncTags(<images>)
	//
	// NOTE: mode is data.tagsToImages(..) / data.tagsFromImages(..) 
	// 		compatible...
	// NOTE: setting source to 'both' and mode to 'reset' is the same as
	// 		'images' and 'reset' as all .data tags will be lost on first 
	// 		pass...
	syncTags: ['Tag/Synchoronize tags between data and images',
		function(source, mode){
			// can't do anything if either .data or .images are not 
			// defined...
			if(this.data == null || this.images == null){
				return
			}

			source = source || 'both'
			mode = mode || 'merge'
			images = this.images
			if(typeof(source) != typeof('str')){
				images = source
				source = 'images'
			}

			if(source == 'data' || source == 'both'){
				this.data.tagsToImages(images, mode)
			}
			if(source == 'images' || source == 'both'){
				this.data.tagsFromImages(images, mode)
			}
		}],


	// crop...
	//
	crop: ['Crop/Crop image list',
		function(list, flatten){ 
			list = list || this.data.order
			if(this.crop_stack == null){
				this.crop_stack = []
			}
			this.crop_stack.push(this.data)

			if(list instanceof data.Data){
				this.data = list 

			} else {
				this.data = this.data.crop(list, flatten)
			}
		}],
	uncrop: ['Crop/Uncrop ribbons',
		function(level, restore_current, keep_crop_order){
			level = level || 1

			var cur = this.current
			var order = this.data.order

			if(this.crop_stack == null){
				return
			}

			// uncrop all...
			if(level == 'all'){
				this.data = this.crop_stack[0]
				this.crop_stack = []

			// get the element at level and drop the tail...
			} else {
				this.data = this.crop_stack.splice(-level, this.crop_stack.length)[0]
			}

			// by default set the current from the crop...
			if(!restore_current){
				this.data.focusImage(cur)
			}

			// restore order from the crop...
			if(keep_crop_order){
				this.data.order = order
				this.data.updateImagePositions()
			}

			// purge the stack...
			if(this.crop_stack.length == 0){
				delete this.crop_stack
			}
		}],
	uncropAll: ['Crop/Uncrop all',
		function(restore_current){ this.uncrop('all', restore_current) }],
	// XXX see if we need to do this on this level??
	// 		...might be a good idea to do this in data...
	uncropAndKeepOrder: ['Crop|Edit/Uncrop and keep crop image order',
		function(level, restore_current){ this.uncrop(level, restore_current, true) }],
	// XXX same as uncrop but will also try and merge changes...
	// 		- the order is simple and already done above...
	// 		- I think that levels should be relative to images, the 
	// 		  only problem here is how to deal with new ribbons...
	mergeCrop: ['Crop|Edit/Merge crop',
		function(){
			// XXX
		}],

	// XXX save a crop (catalog)...
	// XXX

	cropRibbon: ['Crop/Crop current ribbon',
		function(ribbon, flatten){
			if(typeof(ribbon) == typeof(true)){
				flatten = ribbon
				ribbon = null
			}
			ribbon = ribbon || 'current'
			this.crop(this.data.getImages(ribbon), flatten)
		}],
	cropRibbonAndAbove: ['Crop/Crop current and above ribbons',
		function(ribbon, flatten){
			if(typeof(ribbon) == typeof(true)){
				flatten = ribbon
				ribbon = null
			}
			ribbon = ribbon || this.data.getRibbon()

			var data = this.data
			var that = this

			var i = data.ribbon_order.indexOf(ribbon)
			var ribbons = data.ribbon_order.slice(0, i)
			var images = ribbons
				.reduce(function(a, b){ 
						return data.getImages(a).concat(data.getImages(b)) 
					}, data.getImages(ribbon))
				.compact()

			this.crop(data.getImages(images), flatten)
		}],
	
	// XXX should this be here???
	cropTagged: ['Tag|Crop/Crop tagged images',
		function(tags, mode, flatten){
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'
			this.crop(this.data[selector](tags), flatten)
		}],


	// grouping...
	// XXX need to tell .images about this...
	group: ['Group|Edit/Group images', 
		function(gids, group){ this.data.group(gids, group) }],
	ungroup: ['Group|Edit/Ungroup images', 
		function(gids, group){ this.data.ungroup(gids, group) }],

	// direction can be:
	// 	'next'
	// 	'prev'
	groupTo: ['Group|Edit/Group to', 
		function(target, direction){
			target = this.data.getImage(target)
			var other = this.data.getImage(target, direction == 'next' ? 1 : -1)

			// we are start/end of ribbon...
			if(other == null){
				return
			}
			
			// add into an existing group...
			if(this.data.isGroup(other)){
				this.group(target, other)

			// new group...
			} else {
				this.group([target, other])
			}
		}],
	// shorthands to .groupTo(..)
	groupBack: ['Group|Edit/Group target image with the image or group before it', 
		function(target){ this.groupTo(target, 'prev') }],
	groupForward: ['Group|Edit/Group target image with the image or group after it', 
		function(target){ this.groupTo(target, 'next') }],

	// NOTE: this will only group loaded images...
	groupMarked: ['Group|Mark/Group loaded marked images', 
		function(){ this.group(this.data.getImages(this.data.getTaggedByAny('marked'))) }],

	expandGroup: ['Group/Expand group', 
		function(target){ this.data.expandGroup(target || this.current) }],
	collapseGroup: ['Group/Collapse group', 
		function(target){ this.data.collapseGroup(target || this.current) }],

	cropGroup: ['Crop|Group/Crop group', 
		function(target){ this.crop(this.data.cropGroup(target || this.current)) }],
})


var Base =
module.Base = ImageGridFeatures.Feature({
	title: 'ImageGrid base',

	tag: 'base',

	config: {
		// see .direction for details...
		'steps-to-change-direction': 3,
	},

	actions: BaseActions,
})



//---------------------------------------------------------------------

var ViewerActions = 
module.ViewerActions = 
actions.Actions({

	/*
	// Images...
	get images(){
		return this.ribbons != null ? this.ribbons.images : null
	},
	// NOTE: if ribbons are null this will have no effect...
	set images(value){
		if(this.ribbons != null){
			this.ribbons.images = value
		}
	},
	*/

	get screenwidth(){
		return this.ribbons != null ? this.ribbons.getScreenWidthImages() : null
	},
	set screenwidth(n){
		this.fitImage(n)
	},


	load: [
		function(data){
			return function(){
				// recycle the viewer if one is not given specifically...
				var viewer = data.viewer
				viewer = viewer == null && this.ribbons != null 
					? this.ribbons.viewer 
					: viewer

				// XXX do we need to recycle the ribbons???
				if(this.ribbons != null){
					this.ribbons.clear()
				}

				// NOTE: this is done unconditionally to avoid manually 
				// 		setting images and other stuff in the future...
				this.ribbons = ribbons.Ribbons(viewer, this.images)

				// XXX is this correct???
				this.ribbons.__image_updaters = [this.updateImage.bind(this)]

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

				this.ribbons.restoreTransitions()
			}
		}],
	// NOTE: this will trigger .updateImage hooks...
	refresh: ['Interface/Refresh images without reloading',
		function(gids){
			gids = gids || '*'
			this.ribbons.updateImage(gids)
		}],
	clear: [
		function(){ this.ribbons.clear() }],

	loadURLs: [
		function(){
			return function(){
				// recycle the viewer if one is not given specifically...
				var viewer = this.ribbons != null 
					? this.ribbons.viewer 
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


	// This is called by .ribbons, the goal is to use it to hook into 
	// image updating from features and extensions...
	//
	// NOTE: not intended for calling manually, use .refresh(..) instead...
	//
	// XXX experimental...
	// 		...need this to get triggered by .ribbons
	// 		at this point manually triggering this will not do anything...
	// XXX problem: need to either redesign this or distinguish from 
	// 		other actions as I keep calling it expecting results...
	// XXX hide from user action list...
	updateImage: ['Interface/Update image (This will do nothing)',
		'This will be called by .refresh(..) and intended for use as an '
			+'trigger for handlers, and not as a callable acation.',
		function(gid, image){ }],


	// General UI stuff...
	// NOTE: this is applicable to all uses...
	toggleTheme: ['Interface/Toggle viewer theme', 
		CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			[
				'gray', 
				'dark', 
				'light'
			]) ],
	setEmptyMsg: ['Interface/Set message to be displayed when nothing is loaded.',
		function(msg, help){ this.ribbons.setEmptyMsg(msg, help) }],


	// align modes...
	// XXX these should also affect up/down navigation...
	// 		...navigate by proximity (closest to center) rather than by
	// 		order...
	// XXX skip off-screen ribbons (???)
	alignByOrder: ['Interface/Align ribbons by image order',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			// NOTE: the ordering of calls here makes it simpler to load
			// 		data into ribbons based on target gid... i.e. first
			// 		we know the section we need then align it vertically...
			this
				.centerImage(gid)
				.centerRibbon(gid)

			// if we are going fast we might skip an update... 
			if(this._align_timeout != null){
				clearTimeout(this._align_timeout)
				this._align_timeout = null
			}
			var that = this
			this._align_timeout = setTimeout(function(){
				this._align_timeout = null
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons... (???)

					// center...
					// XXX is there a 'last' special case here???
					var t = data.getImage(gid, r)
					if(t == null){
						var f = data.getImage('first', r)
						// nothing found -- empty ribbon?
						if(f == null){
							continue
						}
						that.centerImage(f, 'before')
					} else {
						that.centerImage(t, 'after')
					}
				}
			}, 50)
		}],
	alignByFirst: ['Interface/Aling ribbons except current to first image',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			this
				.centerRibbon(gid)
				.centerImage(gid)

			var that = this
			//setTimeout(function(){
				// align other ribbons...
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons...

					// XXX see if we need to do some loading...

					// center...
					var f = data.getImage('first', r)
					// nothing found -- empty ribbon?
					if(f == null){
						continue
					}
					that.centerImage(f, 'before')
				}
			//}, 0)
		}],

	// NOTE: this will align only a single image...
	// XXX do we need these low level primitives here???
	centerImage: ['Interface/Center an image in ribbon horizontally',
		function(target, align){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align)
		}],
	centerRibbon: ['Interface/Center a ribbon vertically',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerRibbon(target)
		}],

	focusImage: [
		function(target, list){
			var ribbons = this.ribbons
			var data = this.data

			// NOTE: we do not need to do anything in the alternative 
			// 		case as it's done in data/Client, so we'll just 
			// 		peek there later...
			if(data == null){
				target = ribbons.focusImage(target)
				var gid = ribbons.getElemGID(target)
			}

			return function(){
				if(data != null){
					// use the data for all the heavy lifting...
					// NOTE: this will prevent sync errors...
					var gid = data.getImage()

					target = ribbons.focusImage(gid)
				}
			}
		}],
	setBaseRibbon: [
		function(target){
			var r = this.data.getRibbon(target)
			r =  r == null ? this.ribbons.getRibbon(target) : r
			this.ribbons.setBaseRibbon(r)
		}],

	// NOTE: these prioritize whole images, i.e. each image will at least
	// 		once be fully shown.
	prevScreen: ['Navigate/Screen width back',
		function(){
			// NOTE: the 0.2 is added to compensate for alignment/scaling
			// 		errors -- 2.99 images wide counts as 3 while 2.5 as 2.
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.prevImage(w)
		}],
	nextScreen: ['Navigate/Screen width forward',
		function(){
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.nextImage(w)
		}],

	// zooming...
	//
	// Zooming is done by multiplying the current scale by config['zoom-step']
	// and rounding to nearest discrete number of images to fit on screen.
	zoomIn: ['Zoom/Zoom in',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())-1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.getScale() * d
			var n = Math.floor(this.ribbons.getScreenWidthImages(s))
		
			this.fitImage(n <= 0 ? 1 : n)
		}],
	zoomOut: ['Zoom/Zoom out',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())+1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.getScale() / d
			var n = Math.ceil(this.ribbons.getScreenWidthImages(s))

			var max = this.config['max-screen-images']
			this.fitImage(n > max ? max : n)
		}],

	fitOrig: ['Zoom/Fit to original scale',
		function(){ 
			this.ribbons.setScale(1) 
			this.refresh()
		}],
	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	// NOTE: this will add .config['fit-overflow'] to odd counts if no 
	// 		overflow if passed.
	// 		...this is done to add ability to control scroll indication.
	fitImage: ['Zoom/Fit image',
		function(count, overflow){
			if(count != null){
				overflow = overflow == false ? 0 : overflow
				var o = overflow != null ? overflow 
					: count % 2 != 1 ? 0
					: (this.config['fit-overflow'] || 0)
				count += o
			}
			this.ribbons.fitImage(count)
			this.refresh()
		}],
	fitMax: ['Zoom/Fit the maximum number of images',
		function(){ this.fitImage(this.config['max-screen-images']) }],


	// XXX the question with these is how to make these relatively 
	// 		similar across platforms...
	// 		...for this we need to get display dpi...
	fitSmall: ['Zoom/Show small image',
		function(){  }],
	fitNormal: ['Zoom/Show normal image',
		function(){  }],
	fitScreen: ['Zoom/Fit image to screen',
		function(){  }],


	fitRibbon: ['Zoom/Fit ribbon vertically',
		function(count){
			this.ribbons.fitRibbon(count)
			this.refresh()
		}],


	// NOTE: these work by getting the target position from .data...
	shiftImageTo: [ 
		function(target){ return updateImagePosition(this, target) }],
	shiftImageUp: [ 
		function(target){ return updateImagePosition(this, target) }],
	shiftImageDown: [
		function(target){ return updateImagePosition(this, target) }],
	shiftImageLeft: [
		function(target){ 
			this.ribbons.placeImage(target, -1) 
		}],
	shiftImageRight: [
		function(target){
			this.ribbons.placeImage(target, 1) 
		}],

	// XXX how should these animate???
	travelImageUp: [
		function(){
		}],
	travelImageDown: [
		function(){
		}],

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

	reverseImages: [ reloadAfter() ],
	reverseRibbons: [ reloadAfter() ],


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
			gids = gids != null && gids.constructor !== Array ? [gids] : gids
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],
	untag: [
		function(tags, gids){ 
			gids = gids != null && gids.constructor !== Array ? [gids] : gids
			return function(){
				//this.ribbons.updateImage(gids) 
				this.refresh(gids)
			}
		}],


	// group stuff...
	group: [ reloadAfter(true) ],
	ungroup: [ reloadAfter(true) ],
	groupTo: [ reloadAfter(true) ],
	groupMarked: [ reloadAfter(true) ],
	expandGroup: [ reloadAfter(true) ],
	collapseGroup: [ reloadAfter(true) ],


	// XXX BUG? reloadAfter() here does not remove some images...
	crop: [ reloadAfter(true) ],
	// XXX BUG? reloadAfter() produces an align error...
	uncrop: [ reloadAfter(true) ],
	// XXX might be a good idea to do this in a new viewer in an overlay...
	cropGroup: [ reloadAfter() ],


	// XXX experimental: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	toggleRibbonList: ['Interface/Toggle ribbons as images view',
		function(){
			if(this._full_data == null){
				// XXX do a better name here...
				this._full_data = this.data

				// generate the view...
				this.data = this.data.cropRibbons()

			} else {
				var data = this._full_data
				delete this._full_data

				// restore...
				this.data = data.mergeRibbonCrop(this.data)
			}

			this.reload()
		}],

})

var Viewer =
module.Viewer = ImageGridFeatures.Feature({
	title: 'Graphical User Interface',

	tag: 'ui',

	depends: ['base'],

	config: {
		// The maximum screen width allowed when zooming...
		'max-screen-images': 30,

		// A step (multiplier) used by .zoomIn()/.zoomOut() actions.
		// NOTE: this is rounded to the nearest whole screen width in images
		// 		and current fit-overflow added.
		'zoom-step': 1.2,

		// added to odd number of images to fit to indicate scroll ability...
		// ...this effectively sets the closest distance an image can be from
		// the viewer edge...
		'fit-overflow': 0.2,
	},

	actions: ViewerActions,

	// check if we are running in a UI context...
	// NOTE: this will prevent loading of any features dependant on the 
	// 		UI in a non UI context...
	isApplicable: function(){ 
		return typeof(window) == typeof({}) 
	},
})



//---------------------------------------------------------------------

// XXX is this the right level for this???
// 		...data seems to be a better candidate...
// XXX would be great to add a mechanism define how to reverse actions...
// 		...one way to do this at this point is to revert to last state
// 		and re-run the journal until the desired event...
// XXX need to define a clear journaling strategy in the lines of:
// 		- save state clears journal and adds a state load action
// 		- .load(..) clears journal
// XXX needs careful testing...
var Journal = 
module.Journal = ImageGridFeatures.Feature({
	title: 'Action Journal',

	tag: 'system-journal',

	depends: ['base'],

	actions: actions.Actions({
		// XXX might be good to add some kind of metadata to journal...
		journalPush: ['Journal/Add an item to journal',
			function(){
				if(this.journal == null){
					this.journal = []
				}
				//console.log('ACTION:', action, args2array(arguments))
				this.journal.push(args2array(arguments))
			}],
		clearJournal: ['Journal/Clear the action journal',
			function(){
				if(this.journal){
					delete this.journal
				}
			}],
		runJournal: ['Journal/Run journal',
			function(journal){
				var that = this
				journal.forEach(function(e){
					// load state...
					that.focusImage(e[0])
					// run action...
					that[e[1]].apply(that, e[2])
				})
			}],
	}),

	// log state, action and its args... 
	// XXX need to drop journal on save...
	// XXX rotate/truncate journal???
	// XXX need to check that all the listed actions are clean -- i.e.
	// 		running the journal will produce the same results as user 
	// 		actions that generated the journal.
	// XXX would be good if we could know the name of the action in the 
	// 		handler, thus enabling us to define a single handler rather
	// 		than generating a custom handler per action...
	handlers: [
				'clear',
				'load',
				'loadURLs',

				'setBaseRibbon',

				'shiftImageTo',
				'shiftImageUp',
				'shiftImageDown',
				'shiftImageLeft',
				'shiftImageRight',
				'shiftRibbonUp',
				'shiftRibbonDown',

				'rotateCW',
				'rotateCCW',
				'flipHorizontal',
				'flipVertical',

				'sortImages',
				'reverseImages',
				'reverseRibbons',

				'crop',
				'uncrop',

				'tag', 
				'untag',

				'group',
				'ungroup',
				'expandGroup',
				'collapseGroup',

				'runJournal',
			].map(function(action){
				return [
					action, 
					function(){
						this.journalPush(
							this.current, 
							action, 
							args2array(arguments))
					}]
			}), 
})



//---------------------------------------------------------------------

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = actions.Actions({
	// NOTE: this will force sync resize if one of the following is true:
	// 		- the target is not loaded
	// 		- we are less than screen width from the edge
	// 		- threshold is set to 0
	// XXX this is not signature compatible with data.updateRibbon(..)
	updateRibbon: ['Interface/Update partial ribbon size', 
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
					//|| this.ribbons.getImage(target).length == 0
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
	// XXX do we handle off-screen ribbons here???
	resizeRibbon: ['Interface/Resize ribbon to n images',
		function(target, size){
			size = size 
				|| (this.config['ribbon-size-screens'] * this.screenwidth)
				|| (5 * this.screenwidth)
			var data = this.data
			var ribbons = this.ribbons

			// NOTE: we can't get ribbon via target directly here as
			// 		the target might not be loaded...
			var r_gid = data.getRibbon(target)

			if(r_gid == null){
				return
			}

			// localize transition prevention... 
			// NOTE: for the initial load this may be empty...
			var r = ribbons.getRibbon(r_gid)

			// XXX do we need to for example ignore unloaded (r.length == 0)
			// 		ribbons here, for example not load ribbons too far off 
			// 		screen??
			
			ribbons
				.preventTransitions(r)
				.updateRibbon(
					data.getImages(target, size), 
					r_gid,
					target)
				.restoreTransitions(r, true)
		}]
})

// NOTE: I do not fully understand it yet, but PartialRibbons must be 
// 		setup BEFORE RibbonAlignToFirst, otherwise the later will break
// 		on shifting an image to a new ribbon...
// 			To reproduce:
// 				- setupe RibbonAlignToFirst first
// 				- go to top ribbon
// 				- shift image up
// 		XXX The two should be completely independent.... (???)
var PartialRibbons = 
module.PartialRibbons = ImageGridFeatures.Feature({
	title: 'Partial Ribbons',
	doc: 'Maintains partially loaded ribbons, this enables very lage '
		+'image sets to be hadled eficiently.',

	// NOTE: partial ribbons needs to be setup first...
	// 		...the reasons why things break otherwise is not too clear.
	priority: 'high',

	tag: 'ui-partial-ribbons',
	depends: ['ui'],


	actions: PartialRibbonsActions,

	config: {
		// number of screen widths to load...
		'ribbon-size-screens': 7,

		// number of screen widths to edge to trigger reload...
		'ribbon-resize-threshold': 1.5,

		// timeout before a non-forced ribbon size update happens after
		// the action...
		// NOTE: if set to null, the update will be sync...
		'ribbon-update-timeout': 120,
	},

	handlers: [
		['focusImage.pre centerImage.pre', 
			function(target, list){
				// NOTE: we have to do this as we are called BEFORE the 
				// 		actual focus change happens...
				// XXX is there a better way to do this???
				target = list != null ? target = this.data.getImage(target, list) : target

				this.updateRibbon(target)
			}],
		['fitImage.pre', 
			function(n){
				this.updateRibbon('current', n || 1)
			}],
		['fitRibbon.pre', 
			function(n){
				n = n || 1

				// convert target height in ribbons to width in images...
				// NOTE: this does not account for compensation that 
				// 		.updateRibbon(..) makes for fitting whole image
				// 		counts, this is a small enough error so as not
				// 		to waste time on...
				var s = this.ribbons.getScale()
				var h = this.ribbons.getScreenHeightRibbons()
				var w = this.ribbons.getScreenWidthImages()
				var nw = w / (h/n)

				this.updateRibbon('current', nw)
			}],
	],
})



//---------------------------------------------------------------------

var SingleImageActions = actions.Actions({
	toggleSingleImage: ['Interface/Toggle single image view', 
		// XXX this is wrong!!!
		CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			'single-image-mode') ],
})

// helper...
// XXX should this be an action???
function updateImageProportions(){
	// XXX
}


// XXX an ideal case would be:
//
// A)
//       viewer
//      +---------------+
//      |     image     |   - small image
//      |     +---+     |   - square image block
//      |     |   |     |   - smaller than this the block is always square
//      |     +---+     |   - we just change scale
//      |               |
//      +---------------+
//
//
// B)
//       viewer
//      +---------------+
//      | +-----------+ |   - bigger image
//      | | image     | |   - block close to viewer proportion
//      | |    <-->   | |   - image block growing parallel to viewer
//      | |           | |     longer side
//      | +-----------+ |   - this stage is not affected specific by image
//      +---------------+     proportions and can be done in bulk
//
//
// C)
//       viewer
//      +---------------+
//      | image         |   - image block same size as viewer
//      |               |   - need to account for chrome
//      |               |
//      |               |
//      |               |
//      +---------------+
//
//
// D)
//       image
//      + - - - - - - - +
//      .               .
//      +---------------+
//      | viewer        |   - image bigger than viewer in one dimension
//      |       ^       |   - block grows to fit image proportions
//      |       |       |   - need to account for individual image 
//      |       v       |     proportions
//      |               |   - drag enabled
//      +---------------+
//      .               .
//      + - - - - - - - +
//
//
// E) 
//     image
//    + - - - - - - - - - +
//    .                   .
//    . +---------------+ .
//    . | viewer        | . - image bigger than viewer 
//    . |               | . - image block same proportion as image
//    . |               | . - we just change scale
//    . |               | . - drag enabled
//    . |               | .
//    . +---------------+ .
//    .                   .
//    + - - - - - - - - - +
//
//
var SingleImageView =
module.SingleImageView = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view',
	depends: ['ui'],

	config: {
		'single-image-scale': null,
		'ribbon-scale': null,
	},

	actions: SingleImageActions,

	handlers:[
		['fitImage.post',
			function(){ 
				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)
				}
			}],
		// XXX this uses .screenwidth for scale, is this the right way to go?
		['toggleSingleImage.post', 
			function(){ 
				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)

					// update scale...
					var w = this.screenwidth
					this.config['ribbon-scale'] = w
					this.screenwidth = this.config['single-image-scale'] || w

				// ribbon mode -- restore original image size...
				} else {
					this.ribbons.viewer.find('.image:not(.clone)').css({
						width: '',
						height: ''
					})

					// update scale...
					var w = this.screenwidth
					this.config['single-image-scale'] = w
					this.screenwidth = this.config['ribbon-scale'] || w
				}
			}],
	],
})



//---------------------------------------------------------------------

// XXX this should also define up/down navigation behavior e.g. what to 
// 		focus on next/prev ribbon...
// XXX should .alignByOrder(..) be a feature-specific action or global 
// 		as it is now???
var AlignRibbonsToImageOrder = 
module.AlignRibbonsToImageOrder = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-order',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	handlers: [
		['focusImage.post', function(){ this.alignByOrder() }]
	],
})


var AlignRibbonsToFirstImage = 
module.AlignRibbonsToFirstImage = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-first',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	handlers: [
		['focusImage.post', function(){ this.alignByFirst() }],
	],
})



//---------------------------------------------------------------------

// XXX at this point this does not support target lists...
var ShiftAnimation =
module.ShiftAnimation = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-animation',
	depends: ['ui'],

	handlers: [
		['shiftImageUp.pre shiftImageDown.pre', 
			function(target){
				// XXX do not do target lists...
				if(target != null && target.constructor === Array 
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target, true)
				return function(){ s() }
			}],
		// NOTE: this will keep the shadow in place -- the shadow will not
		// 		go to the mountain, the mountain will come to the shadow ;)
		['shiftImageLeft.pre shiftImageRight.pre', 
			function(target){
				// XXX do not do target lists...
				if(target != null && target.constructor === Array
						// do not animate in single image mode...
						&& this.toggleSingleImage('?') == 'on'){
					return
				}
				var s = this.ribbons.makeShadow(target)
				return function(){ s() }
			}],
	],
})



//---------------------------------------------------------------------

var BoundsIndicatorsActions = actions.Actions({
	flashIndicator: ['Interface/Flash an indicator',
		function(direction){
			if(this.ribbons.getRibbonSet().length == 0){
				return
			}
			var cls = {
				// shift up/down...
				up: '.up-indicator',
				down: '.down-indicator',
				// hit start/end/top/bottom of view...
				start: '.start-indicator',
				end: '.end-indicator',
				top: '.top-indicator',
				bottom: '.bottom-indicator',
			}[direction]

			var indicator = this.ribbons.viewer.find(cls)

			if(indicator.length == 0){
				indicator = $('<div>')
					.addClass(cls.replace('.', '') +' '+ this.tag)
					.appendTo(this.ribbons.viewer)
			}

			return indicator
				// NOTE: this needs to be visible in all cases and key press 
				// 		rhythms... 
				.show()
				.delay(100)
				.fadeOut(300)
		}],
})

// helper...
function didAdvance(indicator){
	return function(){
		var img = this.data.current
		return function(){
			if(img == this.data.current){
				this.flashIndicator(indicator)
			}
		}
	}
}

var BoundsIndicators = 
module.BoundsIndicators = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-bounds-indicators',
	depends: ['ui'],

	actions: BoundsIndicatorsActions,

	handlers: [
		// basic navigation...
		['nextImage.pre lastImage.pre', didAdvance('end')],
		['prevImage.pre firstImage.pre', didAdvance('start')],
		['nextRibbon.pre lastRibbon.pre', didAdvance('bottom')],
		['prevRibbon.pre firstRibbon.pre', didAdvance('top')],

		// vertical shifting...
		['shiftImageUp.pre',
			function(target){ 
				target = target || this.current
				var r = this.data.getRibbonOrder(target)

				var l = this.data.getImages(r).length
				var l0 = this.data.getImages(0).length

				return function(){
					// when shifting last image of top ribbon (i.e. length == 1)
					// up the state essentially will not change...
					if((r == 0 && l == 1) 
							// we are shifting to a new empty ribbon...
							|| (r == 1 && l == 1 && l0 == 0)){
						this.flashIndicator('top')
					} else {	
						this.flashIndicator('up')
					}
				}
			}],
		['shiftImageDown.pre',
			function(target){ 
				target = target || this.current
				var r0 = this.data.getRibbonOrder(target)
				var l = this.data.getImages(r0).length

				return function(){
					var r1 = this.data.getRibbonOrder(target)
					if(r0 == r1 && r0 == this.data.ribbon_order.length-1 && l == 1){
						this.flashIndicator('bottom')
					} else {
						this.flashIndicator('down') 
					}
				}
			}],

		// horizontal shifting...
		['shiftImageLeft.pre',
			function(target){ 
				if(target == null 
						//&& actions.data.getImageOrder('ribbon') == 0){
						&& this.data.getImage('prev') == null){
					this.flashIndicator('start')
				}
			}],
		['shiftImageRight.pre',
			function(target){ 
				if(target == null 
						&& this.data.getImage('next') == null){
					this.flashIndicator('end')
				}
			}],
	],
})



//---------------------------------------------------------------------

var CurrentImageIndicatorActions = actions.Actions({
	updateCurrentImageIndicator: ['Interface/Update current image indicator',
		function(target, update_border){
			var ribbon_set = this.ribbons.getRibbonSet()

			if(ribbon_set.length == 0){
				return this
			}

			var scale = this.ribbons.getScale()
			var cur = this.ribbons.getImage(target)
			var ribbon = this.ribbons.getRibbon(target)

			var marker = ribbon.find('.current-marker')

			// get config...
			var border = this.config['current-image-border']
			var min_border = this.config['current-image-min-border']
			var border_timeout = this.config['current-image-border-timeout']
			var fadein = this.config['current-image-indicator-fadein']

			// no marker found -- either in different ribbon or not created yet...
			if(marker.length == 0){
				// get marker globally...
				marker = this.ribbons.viewer.find('.current-marker')

				// no marker exists -- create a marker...
				if(marker.length == 0){
					var marker = $('<div/>')
						.addClass('current-marker ui-current-image-indicator')
						.css({
							opacity: '0',
							top: '0px',
							left: '0px',
						})
						.appendTo(ribbon)
						.animate({
							'opacity': 1
						}, fadein)

				// add marker to current ribbon...
				} else {
					marker.appendTo(ribbon)
				}
			}

			// NOTE: we will update only the attrs that need to be updated...
			var css = {}

			var w = cur.outerWidth(true)
			var h = cur.outerHeight(true)

			// keep size same as the image...
			if(marker.outerWidth() != w || marker.outerHeight() != h){
				css.width = w
				css.height = h
			}

			// update border...
			if(update_border !== false){
				var border = Math.max(min_border, border / scale)

				// set border right away...
				if(update_border == 'before'){
					css.borderWidth = border

				// set border with a delay...
				// NOTE: this is to prevent the ugly border resize before
				// 		the scale on scale down animation starts...
				} else {
					setTimeout(function(){ 
						marker.css({ borderWidth: border }) 
					}, border_timeout)
				}
			}

			css.left = cur[0].offsetLeft

			marker.css(css)
		}],
})

var CurrentImageIndicator = 
module.CurrentImageIndicator = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator',
	depends: ['ui'],

	config: {
		'current-image-border': 3,
		'current-image-min-border': 2,

		'current-image-border-timeout': 200,
		'current-image-shift-timeout': 200,

		'current-image-indicator-fadein': 500,

		'current-image-indicator-hide-timeout': 250,

		// this can be:
		// 	'hide'			- simply hide on next/prev screen action
		// 					  and show on focus image.
		// 	'hide-show'		- hide on fast scroll through screens and 
		// 					  show when slowing down.
		'current-image-indicator-screen-nav-mode': 'hide',
	},

	actions: CurrentImageIndicatorActions,

	handlers: [
		// move marker to current image...
		['focusImage.post',
			function(){ this.updateCurrentImageIndicator() }],
		// prevent animations when focusing ribbons...
		['focusRibbon.pre',
			function(){
				var m = this.ribbons.viewer.find('.current-marker')
				this.ribbons.preventTransitions(m)
				return function(){
					this.ribbons.restoreTransitions(m)
				}
			}],
		// this is here to compensate for position change on ribbon 
		// resize...
		// NOTE: hide/show of indicator on resize appears to have solved
		// 		the jumpy animation issue.
		// 		this might cause some blinking on slow resizes (visible 
		// 		only on next/prev screen)... 
		// 		...still not sure why .preventTransitions(m) did not
		// 		do the job.
		['resizeRibbon.pre',
			function(target, s){
				var m = this.ribbons.viewer.find('.current-marker')
				// only update if marker exists and we are in current ribbon...
				if(m.length != 0 && this.currentRibbon == this.data.getRibbon(target)){
					//this.ribbons.preventTransitions(m)
					m.hide()

					return function(){
						this.updateCurrentImageIndicator(target, false)
						//this.ribbons.restoreTransitions(m, true)
						m
							.show()
							// NOTE: keeping display in inline style will
							// 		prevent the element from being hidden
							// 		by css...
							.css({display: ''})
					}
				}
			}],
		// Change border size in the appropriate spot in the animation:
		// 	- before animation when scaling up
		// 	- after when scaling down
		// This is done to make the visuals consistent...
		['fitImage.pre fitRibbon.pre',
			function(w1){ 
				var w0 = this.screenwidth
				w1 = w1 || 1
				return function(){
					this.updateCurrentImageIndicator(null, w0 > w1 ? 'before' : 'after') 
				}
			}],
		['shiftImageLeft.pre shiftImageRight.pre',
			function(){
				this.ribbons.viewer.find('.current-marker').hide()
				if(this._current_image_indicator_timeout != null){
					clearTimeout(this._current_image_indicator_timeout)
					delete this._current_image_indicator_timeout
				}
				return function(){
					var ribbons = this.ribbons
					var fadein = this.config['current-image-indicator-fadein']
					this._current_image_indicator_timeout = setTimeout(function(){ 
						ribbons.viewer.find('.current-marker').fadeIn(fadein)
					}, this.config['current-image-shift-timeout'])
				}
			}],
	],
})


var CurrentImageIndicatorHideOnFastScreenNav = 
module.CurrentImageIndicatorHideOnFastScreenNav = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-fast-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],


	handlers: [
		// hide indicator on screen next/prev...
		//
		// XXX experimental -- not sure if we need this...
		// XXX need to think about the trigger mechanics here and make 
		// 		them more natural...
		['prevScreen.pre nextScreen.pre',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')
				var t = this.config['current-image-indicator-hide-timeout']

				var cur = this.current

				return function(){
					var that = this

					// delay fadeout...
					if(cur != this.current 
							&& m.css('opacity') == 1
							&& this.__current_indicator_t0 == null){
						this.__current_indicator_t0 = setTimeout(function(){
							delete that.__current_indicator_t0

							m.css({ opacity: 0 })
						}, t)
					}

					// cancel/delay previous fadein...
					if(this.__current_indicator_t1 != null){
						clearTimeout(this.__current_indicator_t1)
					}

					// cancel fadeout and do fadein...
					this.__current_indicator_t1 = setTimeout(function(){
						delete that.__current_indicator_t1

						// cancel fadeout...
						if(that.__current_indicator_t0 != null){
							clearTimeout(that.__current_indicator_t0)
							delete that.__current_indicator_t0
						} 

						// show...
						m.animate({ opacity: '1' })
					}, t-50)
				}
			}],
	],
})

var CurrentImageIndicatorHideOnScreenNav = 
module.CurrentImageIndicatorHideOnScreenNav = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-screen-nav',


	depends: [
		'ui',
		'ui-current-image-indicator'
	],
	exclusive: ['ui-current-image-indicator-hide'],


	handlers: [
		// 	this does the following:
		// 		- hide on screen jump
		// 		- show on any other action
		//
		// NOTE: we use .pre events here to see if we have moved...
		['prevScreen.post nextScreen.post',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')

				m.css({ opacity: 0 })
			}],
		['focusImage.post',
			function(){ 
				var m = this.ribbons.viewer.find('.current-marker')

				m.css({ opacity: '' })
			}],
	],
})



//---------------------------------------------------------------------

// XXX
var ImageStateIndicator = 
module.ImageStateIndicator = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-image-state-indicator',
	depends: ['ui'],
})



//---------------------------------------------------------------------

// XXX
var GlobalStateIndicator = 
module.GlobalStateIndicator = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-global-state-indicator',
	depends: ['ui'],
})



//---------------------------------------------------------------------
// XXX revise names...

// widgets...
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

// This will wrap the actions adding a contextual .preventClosing() method, 
// if called it will prevent the list from closing on open event and give 
// the user control over when to close the base list...
//
// XXX this may be a source for race conditions...
// 		scenario:
// 			- an action is run while a menu runs a state changing action
//			- state restoration will overwrite the effects fo the BG action
// XXX .preventClosing(..) mechanism needs revision...
// 		...might be a better idea to add a permanent action to work with 
// 		modal overlays and to define strict rules under which such overlays 
// 		operate, like:
// 			- only the top overlay is active and can receive events
// 			- an overlay is closed on open event
// 			- an overlay can be prevented from closing only while handling
// 				an open event
// 			- an overlay can close itself or the previous overlay during
// 				its open event
//
// 		Proposed API:
// 			getOverlay(context) 
// 				-> overlay object
// 				-> null
// 					returns an overlay controller for a given container
// 					NOTE: if no overlay is open this returns null
//					NOTE: this might be implemented as an action.
//					NOTE: this returns an object that represents only 
//						the top overlay
//					NOTE: this should either extend the overlay client
//						or encapsulate it (preferred), providing a method to access 
//						it (something like: .client prop or 
//						.getCleint() method)...
// 			.preventClosing()
// 				prevent closing of an overlay after this open event is
// 				handled
// 			.close()
//
//
var makeActionLister = function(list, filter, pre_order){
	pre_order = typeof(filter) == typeof(true) ? filter : pre_order
	filter = typeof(filter) == typeof(true) ? null : filter

	return function(path){
		var that = this
		var paths = this.getPath()
		var actions = {}

		// pre-order the main categories...
		if(pre_order){
			this.config['action-category-order'].forEach(function(k){
				actions[k] = null
			})
		}

		var closingPrevented = false

		// build the action list...
		Object.keys(paths).forEach(function(k){
			var n = paths[k][0]
			var k = filter ? filter(k, n) : k

			// pass args to listers...
			if(k.slice(-1) == '*'){
				actions[k] = function(){

					// XXX this may cause race conditions as we are 
					// 		splitting the state in two and then 
					// 		overwriting one...
					var a = Object.create(that)
					a.preventClosing = function(){ 
						closingPrevented = true 
						return o
					}

					var res = a[n].apply(a, arguments)

					// cleanup -- restore data that was updated by action...
					// NOTE: we do not need to worry about partial 
					// 		updates as they are done in place...
					Object.keys(a).forEach(function(n){
						if(n != 'preventClosing'){
							that[n] = a[n]
						}
					})

					return res
				}
			// ignore args of actions...
			} else {
				actions[k] = function(){

					// XXX this may cause race conditions as we are 
					// 		splitting the state in two and then 
					// 		overwriting one...
					var a = Object.create(that)
					a.preventClosing = function(){ 
						closingPrevented = true 
						return o
					}

					var res = a[n]()

					// cleanup -- restore data that was updated by action...
					// NOTE: we do not need to worry about partial 
					// 		updates as they are done in place...
					Object.keys(a).forEach(function(n){
						if(n != 'preventClosing'){
							that[n] = a[n]
						}
					})

					return res
				}
			}
		})

		var o = overlay.Overlay($('body'), 
			list(null, actions, path)
				.open(function(evt){ 
					if(!closingPrevented){
						o.close() 
					}
					closingPrevented = false
				}))

		// XXX DEBUG
		//window.LIST = o.client

		return this
	}
}

var ActionTreeActions = actions.Actions({
	// XXX move this to a generic modal overlay feature...
	getOverlay: ['Interface/Get overlay object',
		function(){
		}],

	browseActions: ['Interface/Browse actions',
		makeActionLister(browse.makePathList, true)],

	listActions:['Interface/List actions',
		makeActionLister(browse.makeList, 
			// format the doc to: <name> (<category>, ..)
			// NOTE: this a bit naive...
			function(k){ 
				var l = k.split(/[\\\/\|]/)
				var a = l.pop()
				return a +' ('+ l.join(', ') +')'
			})],

	// XXX this is just a test...
	embededListerTest: ['Interface|Test/Lister test (embeded)/*',
		function(path, make){
			make('a/')
			make('b/')
			make('c/')
		}],
	floatingListerTest: ['Interface|Test/Lister test (floating)...',
		function(path){
			var parent = this.preventClosing ? this.preventClosing() : null

			// we got an argument and can exit...
			if(path){
				console.log('PATH:', path)
				return
			}

			// load the UI...
			var that = this
			var list = function(path, make){
				
				make('a/')
				make('b/')
				make('c/')
			}

			var o = overlay.Overlay($('body'), 
				browse.makePathList(null, {
					'a/*': list,
					'b/*': list,
					'c/*': list,
				})
					.open(function(evt, path){ 
						o.close() 

						// close the parent ui...
						parent 
							&& parent.close 
							&& parent.close()

						that.floatingListerTest(path)
					}))
					.close(function(){
						parent 
							&& parent.focus 
							&& parent.focus()
					})
		}],
	// XXX make this nw only...
	pathListerTest: ['Interface|Test/Path lister test (floating)...',
		function(path){
			var parent = this.preventClosing ? this.preventClosing() : null

			// we got an argument and can exit...
			if(path){
				console.log('PATH:', path)
				return
			}

			var that = this

			var o = overlay.Overlay($('body'), 
				require('./lib/widget/browse-walk').makeWalk(null, '/')
					.open(function(evt, path){ 
						o.close() 

						// close the parent ui...
						parent 
							&& parent.close 
							&& parent.close()

						that.pathListerTest(path)
					}))
					.close(function(){
						parent 
							&& parent.focus 
							&& parent.focus()
					})
		}],
	drawerTest:['Interface|Test/Drawer widget test',
		function(){
			drawer.Drawer($('body'), 
				$('<div>')
					.css({
						position: 'relative',
						background: 'white',
						height: '300px',
					})
					.append($('<h1>')
						.text('Drawer test...'))
					.append($('<p>')
						.text('With some text.')),
				{
					focusable: true,
				})
		}],
})

var ActionTree = 
module.ActionTree = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-action-tree',
	depends: ['ui'],

	config: {
		'action-category-order': [
			'File',
			'Edit',
			'Navigate',
		],
	},

	actions: ActionTreeActions,
})



//---------------------------------------------------------------------
// XXX console / log / status bar
// XXX title bar



//---------------------------------------------------------------------

// XXX experimental...
// 		...not sure if this is the right way to go...
// XXX need to get the minimal size and not the width as results will 
// 		depend on viewer format...
var AutoSingleImage = 
module.AutoSingleImage = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'auto-single-image',

	config: {
		'auto-single-image-in': 2,
		'auto-single-image-out': 7,
	},

	handlers: [
		['fitImage.pre',
			function(count){
				count = count || 1

				if(this.toggleSingleImage('?') == 'off' 
						&& count < this.config['auto-single-image-in']
						&& count < this.screenwidth){
					this.toggleSingleImage()

				} else if(this.toggleSingleImage('?') == 'on' 
						&& count >= this.config['auto-single-image-out']
						&& count > this.screenwidth){
					this.toggleSingleImage()
				}
			}],
	],
})



//---------------------------------------------------------------------

// XXX should we rename this to "select"???

// target can be:
// 		'all'
// 		'loaded'
// 		'ribbon'	- current ribbon
// 		ribbon		- specific ribbon (gid)
// 		Array
//
// XXX make this a real toggler... ???
function makeTagTogglerAction(tag){
	return function(target, action){
		if(target == '?' || target == 'on' || target == 'off'){
			var x = action
			action = target
			target = x
		}
		target = target || 'current'
		target = target == 'all' 
				|| target == 'loaded' 
				|| target in this.data.ribbons 
					? this.data.getImages(target)
			: target == 'ribbon' ? this.data.getImages('current')
			: target
		target = target.constructor !== Array ? [target] : target

		// on...
		if(action == 'on'){
			this.tag(tag, target)
			var res = 'on'

		// off...
		} else if(action == 'off'){
			this.untag(tag, target)
			var res = 'off'

		// next...
		} else if(action != '?'){
			var res = []
			var that = this
			target.forEach(function(t){
				if(that.data.getTags(t).indexOf(tag) < 0){
					that.tag(tag, t)
					res.push('on')
				} else {
					that.untag(tag, t)
					res.push('off')
				}
			})
			res = res.length == 1 ? res[0] : res

		// ?
		} else if(action == '?'){
			var res = this.data.toggleTag(tag, target, '?')
			res = res.length == 1 ? res[0] : res
		}

		return res 
	}
}


// XXX .toggleMarkBlock(..) not done yet...
var ImageMarkActions = actions.Actions({

	// a shorthand...
	// NOTE: this will return a copy...
	get marked(){
		if(this.data == null 
				|| this.data.tags == null
				|| !('selected' in this.data.tags)){
			return []
		}
		return this.data.tags['selected'].slice()
	},

	// Common use-cases:
	// 	Toggle mark on current image
	// 	.toggleMark()
	//
	// 	Mark current ribbon
	// 	.toggleMark('ribbon', 'on')
	//
	// 	Unmark all loaded images
	// 	.toggleMark('loaded', 'off')
	//
	// 	Invert marks on current ribbon
	// 	.toggleMark('ribbon')
	//
	toggleMark: ['Mark/Toggle image mark',
		makeTagTogglerAction('selected')],
	// XXX
	toggleMarkBlock: ['Mark/Toggle block marks',
		'A block is a set of adjacent images either marked on unmarked '
			+'in the same way',
		function(target){
			var cur = this.toggleMark(target, '?')

			// get all the next/prev gids until we get a state other than cur...
			// XXX
		}],

	markTagged: ['Mark/Mark images by tags',
		function(tags, mode){
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'

			var that = this
			this.data[selector](tags).forEach(function(gid){
				that.toggleMark(gid, 'on')
			})
		}],

	// XXX do we need first/last marked???
	prevMarked: ['Mark|Navigate/Previous marked image',
		function(mode){ this.prevTagged('selected', mode) }],
	nextMarked: ['Mark|Navigate/Next marked image',
		function(mode){ this.nextTagged('selected', mode) }],

	cropMarked: ['Mark|Crop/Crop marked images',
		function(flatten){ this.cropTagged('selected', 'any', flatten) }],
})


// NOTE: this is usable without ribbons...
var ImageMarks = 
module.ImageMarks = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-marks',

	depends: ['base'],

	actions: ImageMarkActions,

	handlers: [
		// XXX is this the right way to go???
		['updateImage', function(gid, img){
			// update only when ribbons are preset... 
			if(this.ribbons != null){
				if(this.toggleMark(gid, '?') == 'on'){
					this.ribbons.toggleImageMark(gid, 'selected', 'on')
				} else {
					this.ribbons.toggleImageMark(gid, 'selected', 'off')
				}
			}
		}],
	],
})



//---------------------------------------------------------------------
var ImageBookmarkActions = actions.Actions({

	// a shorthand...
	// NOTE: this will return a copy...
	get bookmarked(){
		if(this.data == null 
				|| this.data.tags == null
				|| !('bookmark' in this.data.tags)){
			return []
		}
		return this.data.tags['bookmark'].slice()
	},

	toggleBookmark: ['Bookmark/Toggle image bookmark',
		makeTagTogglerAction('bookmark')],
	// action can be:
	// 	'on'	- toggle all on
	// 	'off'	- toggle all off
	// 	'next'	- toggle each image to next state
	toggleBookmarkOnMarked: ['Bookmark|Mark/Toggle bookmark on maked images',
		function(action){ 
			return this.toggleBookmark(this.data.getTaggedByAny('selected'), action) 
		}],

	prevBookmarked: ['Bookmark|Navigate/Previous bookmarked image',
		function(mode){ this.prevTagged('bookmark', mode) }],
	nextBookmarked: ['Bookmark|Navigate/Next bookmarked image',
		function(mode){ this.nextTagged('bookmark', mode) }],

	cropBookmarked: ['Bookmark|Crop/Crop bookmarked images',
		function(flatten){ this.cropTagged('bookmark', 'any', flatten) }],
})


// NOTE: this is usable without ribbons...
var ImageBookmarks = 
module.ImageBookmarks = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-bookmarks',

	depends: ['base'],

	actions: ImageBookmarkActions,

	handlers: [
		// XXX is this the right way to go???
		['updateImage', function(gid, img){
			// update only when ribbons are preset... 
			if(this.ribbons != null){
				if(this.toggleBookmark(gid, '?') == 'on'){
					this.ribbons.toggleImageMark(gid, 'bookmark', 'on')
				} else {
					this.ribbons.toggleImageMark(gid, 'bookmark', 'off')
				}
			}
		}],
	],
})



//---------------------------------------------------------------------

var AppControlActions = actions.Actions({
	// XXX revise these...
	close: ['File|Interface/Cloase viewer',
		function(){
			// XXX should we do anything else here like auto-save???
			window.close() 
		}],
	toggleFullScreen: ['Interface/Toggle full screen mode',
		function(){
			// XXX where should toggleFullscreenMode(..) be defined...
			toggleFullscreenMode() 
		}],
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(){
			if(window.showDevTools != null){
				showDevTools() 
			}
		}],
})


// XXX this needs a better .isApplicable(..)
var AppControl = 
module.AppControl = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'app-control',

	actions: AppControlActions,

	// XXX test if in:
	// 	- chrome app
	// 	- nw
	// 	- mobile
	isApplicable: function(){
		return window.nodejs != null
	},
})



//---------------------------------------------------------------------
// XXX at this point this is a stub...
var FileSystemLoader = 
module.FileSystemLoader = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-loader',

	isApplicable: function(){
		return window.nodejs != null
	},
})



//---------------------------------------------------------------------
// Meta features...
//
// XXX need to make a set of basic configurations:
// 		- commandline		- everything but no UI
// 		- viewer-minimal	- basic browser compatible viewer
// 		- viewer			- full viewer
// 		- editor			- editing capability
//

ImageGridFeatures.Feature('viewer-testing', [
	'base',

	'ui',

	// features...
	'ui-ribbon-align-to-order',
	'ui-single-image-view',
	'ui-partial-ribbons',

	'image-marks',
	'image-bookmarks',

	'fs-loader',
	'app-control',

	// chrome...
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		// NOTE: only one of these can be set...
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
	'ui-image-state-indicator',
	'ui-global-state-indicator',
	'ui-action-tree',

	// experimental and optional features...
	//'auto-single-image',
	
	// XXX not yet fully tested...
	'system-journal',
])

ImageGridFeatures.Feature('viewer-minimal', [
	'base',
	'ui',
	'ui-ribbon-align-to-order',
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
	'ui-action-tree',
])

ImageGridFeatures.Feature('viewer', [
	'viewer-minimal',
])

ImageGridFeatures.Feature('viewer-partial', [
	'viewer',
	'ui-partial-ribbons',
])



//---------------------------------------------------------------------

var ExperimentActions = actions.Actions({
	/* trying an argument mutation method... (FAILED: arguments is mutable)
	argumentMutation: [
		function(a, b){
			console.log('ACTIONS ARGS:', a, b)
		}],
	*/
})

var ExperimentFeature = 
module.ExperimentFeature = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'experiments',

	isApplicable: function(actions){
		return actions.experimental
	},

	actions: ExperimentActions,

	handlers: [
		/* trying an argument mutation method... (FAILED: arguments is mutable)
		['argumentMutation.pre', 
			function(a, b){
				console.log('EVENT ARGS:', a, b)
				arguments[0] += 1
				arguments[1] += 1
			}],
		*/
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
