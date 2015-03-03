/**********************************************************************
* 
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
//
// XXX Tasks to accomplish here:
// 	- life-cycle actions/events
// 		- setup
// 		- reset
// 	- "features" and the mechanism to turn them on or off (action-sets)
//
//

var Client = 
module.Client = 
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
	load: [
		function(d){
			this.images = images.Images(d.images)
			this.data = data.Data(d.data)
		}],
	clear: [
		function(){
			delete this.data
			delete this.images
		}],

	// XXX should this be here???
	loadURLs: ['Load a URL list',
		function(lst){
			this.images = images.Images.fromArray(lst)
			this.data = data.Data.fromArray(this.images.keys())
		}],

	// XXX experimental...
	// 		...the bad thing about this is that we can not extend this,
	// 		adding new items to the resulting structure...
	// XXX is this the correct way to go???
	// 		...can we save simple attribute values???
	json: ['Dump state as JSOM object',
		'This will collect JSON data from every afailable attribute '
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
	focusImage: ['Focus image',
		function(img, list){
			this.data.focusImage(img, list)
		}],
	focusRibbon: ['Focus Ribbon',
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
	setBaseRibbon: ['Set base ribbon',
		function(target){ this.data.setBase(target) }],

	// shorthands...
	// XXX do we reset direction on these???
	firstImage: ['Focus first image in current ribbon',
		function(all){ this.focusImage(all == null ? 'first' : 0) }],
	lastImage: ['Focus last image in current ribbon',
		function(all){ this.focusImage(all == null ? 'last' : -1) }],
	// XXX these break if image at first/last position are not loaded (crop, group, ...)
	// XXX do we actually need these???
	firstGlobalImage: ['Get first globally image',
		function(){ this.firstImage(true) }],
	lastGlobalImage: ['Get last globally image',
		function(){ this.lastImage(true) }],

	// XXX skip unloaded images...
	prevImage: ['Focus previous image',
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
	nextImage: ['Focus next image',
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
	prevImageInOrder: ['Focus previous image in order',
		function(){ this.prevImage(this.data.getImages(this.data.order)) }],
	nextImageInOrder: ['Focus next image in order',
		function(){ this.nextImage(this.data.getImages(this.data.order)) }],

	// XXX should these be here???
	prevTagged: ['Focus previous image tagged with tag',
		makeTagWalker('prev')],
	nextTagged: ['Focus next image tagged with tag',
		makeTagWalker('next')],

	firstRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('first') }],
	lastRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('last') }],
	prevRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('before') }],
	nextRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('after') }],


	// basic ribbon editing...
	//
	// NOTE: for all of these, current/ribbon image is a default...

	// XXX to be used for things like mark/place and dragging...
	shiftImageTo: ['',
		function(target, to){
			// XXX
		}],
	
	shiftImageUp: ['Shift image up',
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
	shiftImageDown: ['Shift image down',
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
	shiftImageUpNewRibbon: ['Shift image up to a new empty ribbon',
		function(target){
			this.data.newRibbon(target)
			this.shiftImageUp(target)
		}],
	shiftImageDownNewRibbon: ['Shift image down to a new empty ribbon',
		function(target){
			this.data.newRibbon(target, 'below')
			this.shiftImageDown(target)
		}],
	shiftImageLeft: ['Shift image left',
		function(target){ 
			if(target == null){
				this.direction = 'left'
			}
			this.data.shiftImageLeft(target) 
			this.focusImage()
		}],
	shiftImageRight: ['Shift image right',
		function(target){ 
			if(target == null){
				this.direction = 'right'
			}
			this.data.shiftImageRight(target) 
			this.focusImage()
		}],

	shiftRibbonUp: ['Shift ribbon up',
		function(target){ 
			this.data.shiftRibbonUp(target) 
			// XXX is this the right way to go/???
			this.focusImage()
		}],
	shiftRibbonDown: ['Shift ribbon down',
		function(target){ 
			this.data.shiftRibbonDown(target)
			// XXX is this the right way to go/???
			this.focusImage()
		}],

	// these operate on the current image...
	travelImageUp: ['Travel with the current image up (Shift up and keep focus)',
		function(target){
			target = target || this.current
			this.shiftImageUp(target)
			this.focusImage(target)
		}],
	travelImageDown: ['Travel with the current image down (Shift down and keep focus)',
		function(target){
			target = target || this.current
			this.shiftImageDown(target)
			this.focusImage(target)
		}],

	
	reverseImages: ['Reverse image order',
		function(){ this.data.reverseImages() }],
	reverseRibbons: ['Reverse ribbon order',
		function(){ this.data.reverseRibbons() }],

	// XXX align to ribbon...

	// XXX this also requires images...
	sortImages: [
		function(method){ 
		}],

	// basic image editing...
	//
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: [ 
		function(target){ 
			if(this.images != null){
				this.images.rotateImage(this.data.getImage(target), 'cw')
			}
		}],
	rotateCCW: [ 
		function(target){ 
			if(this.images != null){
				this.images.rotateImage(this.data.getImage(target), 'ccw')
			}
		}],
	flipVertical: [ 
		function(target){ 
			if(this.images != null){
				this.images.flipImage(this.data.getImage(target), 'vertical')
			}
		}],
	flipHorizontal: [
		function(target){ 
			if(this.images != null){
				this.images.flipImage(this.data.getImage(target), 'horizontal')
			}
		}],


	// tags...
	//
	// XXX mark updated...
	tag: ['Tag image(s)',
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
	untag: ['Untag image(s)',
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
	syncTags: ['Synchoronize tags between data and images',
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
	crop: [ 
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
	uncrop: ['Uncrop ribbons',
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
				this.data.sortImages()
			}

			// purge the stack...
			if(this.crop_stack.length == 0){
				delete this.crop_stack
			}
		}],
	uncropAll: ['',
		function(restore_current){ this.uncrop('all', restore_current) }],
	// XXX see if we need to do this on this level??
	// 		...might be a good idea to do this in data...
	uncropAndKeepOrder: ['Uncrop and keep crop image order',
		function(level, restore_current){ this.uncrop(level, restore_current, true) }],
	// XXX same as uncrop but will also try and merge changes...
	// 		- the order is simple and already done above...
	// 		- I think that levels should be relative to images, the 
	// 		  only problem here is how to deal with new ribbons...
	mergeCrop: ['',
		function(){
			// XXX
		}],

	// XXX save a crop (catalog)...
	// XXX

	cropRibbon: ['Crop current ribbon',
		function(ribbon, flatten){
			ribbon = ribbon || 'current'
			this.crop(this.data.getImages(ribbon), flatten)
		}],
	cropRibbonAndAbove: ['Crop current and above ribbons',
		function(ribbon, flatten){
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
	cropTagged: ['',
		function(tags, mode, flatten){
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'
			this.crop(this.data[selector](tags), flatten)
		}],


	// grouping...
	// XXX need to tell .images about this...
	group: ['Group images', 
		function(gids, group){ this.data.group(gids, group) }],
	ungroup: ['Ungroup images', 
		function(gids, group){ this.data.ungroup(gids, group) }],

	// direction can be:
	// 	'next'
	// 	'prev'
	groupTo: ['', 
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
	groupBack: ['Group target image with the image/group before it', 
		function(target){ this.groupTo(target, 'prev') }],
	groupForward: ['Group target image with the image/group after it', 
		function(target){ this.groupTo(target, 'next') }],

	// NOTE: this will only group loaded images...
	groupMarked: ['Group loaded marked images', 
		function(){ this.group(this.data.getImages(this.data.getTaggedByAny('marked'))) }],

	expandGroup: ['', 
		function(target){ this.data.expandGroup(target || this.current) }],
	collapseGroup: ['', 
		function(target){ this.data.collapseGroup(target || this.current) }],

	cropGroup: ['', 
		function(target){ this.crop(this.data.cropGroup(target || this.current)) }],
})



// XXX do partial loading...
var Viewer = 
module.Viewer = 
actions.Actions(Client, {

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
	// 		updater if one is defined here as .updateRibbon(target)
	// XXX HACK: tow sins:
	// 		- actions.updateRibbon(..) and ribbons.updateRibbon(..)
	// 		  are NOT signature compatible...
	// 		- we depend on the internals of a custom add-on feature
	reload: ['Reload viewer',
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
							that.updateRibbon(ribbon, null, null, force) 
						} }
					: null

				this.ribbons.updateData(this.data, settings)
				// XXX should this be here???
				this.refresh()
				this.focusImage()

				this.ribbons.restoreTransitions()
			}
		}],
	// NOTE: this will trigger .updateImage hooks...
	refresh: ['Refresh images without reloading',
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
	updateImage: ['This will do nothing',
		'This will be called by .refresh(..) and intended for use as an '
			+'trigger for handlers, and not as a callable acation.',
		function(gid, image){ }],


	// General UI stuff...
	// NOTE: this is applicable to all uses...
	toggleTheme: ['Toggle viewer theme', 
		CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			[
				'gray', 
				'dark', 
				'light'
			]) ],
	setEmptyMsg: ['Set message to be displayed when nothing is loaded.',
		function(msg, help){ this.ribbons.setEmptyMsg(msg, help) }],


	// align modes...
	// XXX these should also affect up/down navigation...
	// 		...navigate by proximity (closest to center) rather than by
	// 		order...
	// XXX skip off-screen ribbons (???)
	alignByOrder: ['Align ribbons by image order',
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
	alignByFirst: ['Aling ribbons except current to first image',
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
	centerImage: ['Center an image in ribbon horizontally',
		function(target, align){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align)
		}],
	centerRibbon: ['Center a ribbon vertically',
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
	prevScreen: ['Focus previous image one screen width away',
		function(){
			// NOTE: the 0.2 is added to compensate for alignment/scaling
			// 		errors -- 2.99 images wide counts as 3 while 2.5 as 2.
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.prevImage(w)
		}],
	nextScreen: ['Focus next image one screen width away',
		function(){
			var w = Math.floor(this.ribbons.getScreenWidthImages() + 0.2)
			w += (w % 2) - 1
			this.nextImage(w)
		}],

	// zooming...
	//
	// Zooming is done by multiplying the current scale by config['zoom-step']
	// and rounding to nearest discrete number of images to fit on screen.
	zoomIn: ['Zoom in',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())-1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.getScale() * d
			var n = Math.floor(this.ribbons.getScreenWidthImages(s))
		
			this.fitImage(n <= 0 ? 1 : n)
		}],
	zoomOut: ['Zoom out',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())+1
			var d = this.config['zoom-step'] || 1.2
			var s = a.ribbons.getScale() / d
			var n = Math.ceil(this.ribbons.getScreenWidthImages(s))

			var max = this.config['max-screen-images']
			this.fitImage(n > max ? max : n)
		}],

	fitOrig: ['Fit to original scale',
		function(){ 
			this.ribbons.setScale(1) 
			this.refresh()
		}],
	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	// NOTE: this will add .config['fit-overflow'] to odd counts if no 
	// 		overflow if passed.
	// 		...this is done to add ability to control scroll indication.
	fitImage: ['Fit image',
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
	fitMax: ['Fit the maximum number of images',
		function(){ this.fitImage(this.config['max-screen-images']) }],


	// XXX the question with these is how to make these relatively 
	// 		similar across platforms...
	// 		...for this we need to get display dpi...
	fitSmall: ['Show small image',
		function(){  }],
	fitNormal: ['Show normal image',
		function(){  }],
	fitScreen: ['Fit image to screen',
		function(){  }],


	fitRibbon: ['Fit ribbon vertically',
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


	crop: [ reloadAfter() ],
	uncrop: [ reloadAfter() ],
	// XXX might be a good idea to do this in a new viewer in an overlay...
	cropGroup: [ reloadAfter() ],


	// XXX experimental: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	toggleRibbonList: ['Toggle ribbons as images view',
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



/*********************************************************************/

var ImageGridFeatures =
module.ImageGridFeatures = Object.create(features.FeatureSet)



//---------------------------------------------------------------------

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = actions.Actions({
	// NOTE: this will force sync resize if one of the following is true:
	// 		- the target is not loaded
	// 		- we are less that screen width from the edge
	// 		- threshold is set to 0
	// XXX this is not signature compatible with data.updateRibbon(..)
	updateRibbon: ['Update partial ribbon size', 
		function(target, w, size, threshold){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: this.data.getImage(target)

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
			var nl = this.ribbons.getImage(target).nextAll('.image:not(.clone)').length
			var pl = this.ribbons.getImage(target).prevAll('.image:not(.clone)').length

			// next/prev available...
			// NOTE: we subtract 1 to remove the current and make these 
			// 		compatible with: nl, pl
			var na = this.data.getImages(target, size, 'after').length - 1
			var pa = this.data.getImages(target, size, 'before').length - 1

			// do the update...
			// no threshold beans force load...
			if(threshold == 0 
					// the target is not loaded...
					|| this.ribbons.getImage(target).length == 0
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
							delete this.__update_timeout
							that.resizeRibbon(target, size) 
						}, timeout)
					}
				}
			}
		}],
	resizeRibbon: ['Resize ribbon to n images',
		function(target, size){
			size = size 
				|| (this.config['ribbon-size-screens'] * this.screenwidth)
				|| (5 * this.screenwidth)
			var data = this.data
			var ribbons = this.ribbons

			// NOTE: we can't get ribbon via target directly here as
			// 		the target might not be loaded...
			var r_gid = data.getRibbon(target)

			// localize transition prevention... 
			var r = ribbons.getRibbon(r_gid)

			if(r.length > 0){
				ribbons
					.preventTransitions(r)
					.updateRibbon(
						data.getImages(target, size), 
						r_gid,
						target)
					.restoreTransitions(r, true)
			}
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
module.PartialRibbons = features.Feature(ImageGridFeatures, {
	title: 'Partial Ribbons',
	doc: 'Maintains partially loaded ribbons, this enables very lage '
		+'image sets to be hadled eficiently.',

	// NOTE: partial ribbons needs to be setup first...
	// 		...the reasons why things break otherwise is not too clear.
	priority: 'high',

	tag: 'ui-partial-ribbons',


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
	toggleSingleImage: ['Toggle single image view', 
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
module.SingleImageView = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-single-image-view',

	actions: SingleImageActions,

	handlers:[
		['fitImage.post',
			function(){ 
				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)
				}
			}],
		['toggleSingleImage.post', 
			function(){ 
				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)

				// ribbon mode -- restore original image size...
				} else {
					this.ribbons.viewer.find('.image:not(.clone)').css({
						width: '',
						height: ''
					})
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
module.AlignRibbonsToImageOrder = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-order',
	exclusive: ['ui-ribbon-align'],

	handlers: [
		['focusImage.post', function(){ this.alignByOrder() }]
	],
})


var AlignRibbonsToFirstImage = 
module.AlignRibbonsToFirstImage = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-first',
	exclusive: ['ui-ribbon-align'],

	handlers: [
		['focusImage.post', function(){ this.alignByFirst() }],
	],
})



//---------------------------------------------------------------------

// XXX at this point this does not support target lists...
var ShiftAnimation =
module.ShiftAnimation = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-animation',

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
	flashIndicator: ['Flash an indicator',
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
module.BoundsIndicators = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-bounds-indicators',

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
	updateCurrentImageIndicator: ['Update current image indicator',
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
module.CurrentImageIndicator = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator',

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
module.CurrentImageIndicatorHideOnFastScreenNav = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-fast-screen-nav',


	depends: ['ui-current-image-indicator'],
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
module.CurrentImageIndicatorHideOnScreenNav = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-current-image-indicator-hide-on-screen-nav',


	depends: ['ui-current-image-indicator'],
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
module.ImageStateIndicator = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-image-state-indicator',
})



//---------------------------------------------------------------------

// XXX
var GlobalStateIndicator = 
module.GlobalStateIndicator = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'ui-global-state-indicator',
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
module.AutoSingleImage = features.Feature(ImageGridFeatures, {
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
	toggleMark: ['Toggle image mark',
		makeTagTogglerAction('selected')],
	// XXX
	toggleMarkBlock: ['Toggle block marks',
		'A block is a set of adjacent images either marked on unmarked '
			+'in the same way',
		function(target){
			var cur = this.toggleMark(target, '?')

			// get all the next/prev gids until we get a state other than cur...
			// XXX
		}],

	markTagged: ['Mark images by tags',
		function(tags, mode){
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'

			var that = this
			this.data[selector](tags).forEach(function(gid){
				that.toggleMark(gid, 'on')
			})
		}],

	// XXX do we need first/last marked???
	prevMarked: ['Focus previous marked image',
		function(mode){ this.prevTagged('selected', mode) }],
	nextMarked: ['Focus next marked image',
		function(mode){ this.nextTagged('selected', mode) }],

	cropMarked: ['Crop marked images',
		function(flatten){ this.cropTagged('selected', 'any', flatten) }],
})


// NOTE: this is usable without ribbons...
var ImageMarks = 
module.ImageMarks = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'image-marks',

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

	toggleBookmark: ['',
		makeTagTogglerAction('bookmark')],
	// action can be:
	// 	'on'	- toggle all on
	// 	'off'	- toggle all off
	// 	'next'	- toggle each image to next state
	toggleBookmarkOnMarked: ['',
		function(action){ 
			return this.toggleBookmark(this.data.getTaggedByAny('selected'), action) 
		}],

	prevBookmarked: ['',
		function(mode){ this.prevTagged('bookmark', mode) }],
	nextBookmarked: ['',
		function(mode){ this.nextTagged('bookmark', mode) }],

	cropBookmarked: ['',
		function(flatten){ this.cropTagged('bookmark', 'any', flatten) }],
})


// NOTE: this is usable without ribbons...
var ImageBookmarks = 
module.ImageBookmarks = features.Feature(ImageGridFeatures, {
	title: '',
	doc: '',

	tag: 'image-bookmarks',

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
	close: ['Cloase viewer',
		function(){
			// XXX should we do anything else here like auto-save???
			window.close() 
		}],
	toggleFullScreen: ['',
		function(){
			// XXX where should toggleFullscreenMode(..) be defined...
			toggleFullscreenMode() 
		}],
	showDevTools: ['',
		function(){
			if(window.showDevTools != null){
				showDevTools() 
			}
		}],
})


// XXX this needs a better .isApplicable(..)
var AppControl = 
module.AppControl = features.Feature(ImageGridFeatures, {
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
module.FileSystemLoader = features.Feature(ImageGridFeatures, {
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

features.Feature(ImageGridFeatures, 'viewer-testing', [
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

	// experimental and optional features...
	//'auto-single-image',
])

features.Feature(ImageGridFeatures, 'commandline', [
	'image-marks',
	'image-bookmarks',
])

features.Feature(ImageGridFeatures, 'viewer-minimal', [
	'ui-ribbon-align-to-order',
	'ui-animation',
	'ui-bounds-indicators',
	'ui-current-image-indicator',
		'ui-current-image-indicator-hide-on-fast-screen-nav',
		//'ui-current-image-indicator-hide-on-screen-nav',
])

features.Feature(ImageGridFeatures, 'viewer', [
	'viewer-minimal',
])

features.Feature(ImageGridFeatures, 'viewer-partial', [
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
module.ExperimentFeature = features.Feature(ImageGridFeatures, {
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
