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

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var data = require('data')
var images = require('images')
var ribbons = require('ribbons')



/*********************************************************************/
// Helpers...

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


// NOTE: if not state is set this assumes that the first state is the 
// 		default...
var makeConfigToggler = function(attr, states, callback){
	return Toggler(null,
		function(_, action){
			var lst = states.constructor === Array ? states : states.call(this)

			//console.log('action', action)

			if(action == null){
				return this.config[attr] || lst[lst.indexOf('none')] || lst[0]

			} else {
				this.config[attr] = action
				//this.focusImage()
			}
		},
		states,
		callback || function(action){ action != null && this.focusImage() })
}



/*********************************************************************/

var ImageGridFeatures =
module.ImageGridFeatures = Object.create(features.FeatureSet)



/*********************************************************************/

// XXX should this be a generic library thing???
// XXX should his have state???
// 		...if so, should this be a toggler???
var LifeCycleActions = actions.Actions({
	start: ['- System/', 
		function(){
			var that = this
			this.logger && this.logger.emit('start')

			// NOTE: jQuery currently provides no way to check if an event
			// 		is bound so we'll need to keep track manually...
			if(this.__stop_handler == null){
				var stop = this.__stop_handler = function(){ that.stop() }

			} else {
				return
			}

			// setup exit...
			if(typeof(process) != 'undefined'){
				// nw.js...
				try{
					this.runtime = 'nw'

					// this will fail if we're not in nw.js...
					var gui = requirejs('nw.gui')

					// this handles both reload and close...
					$(window).on('beforeunload', stop)

					// NOTE: we are using both events as some of them do not
					// 		get triggered in specific conditions and some do,
					// 		for example, this gets triggered when the window's
					// 		'X' is clicked while does not on reload...
					this.__nw_stop_handler = function(){
						var w = this
						try{
							that
								// wait till ALL the handlers finish before 
								// exiting...
								.on('stop.post', function(){
									w.close(true)
								})
								.stop()

						// in case something breaks exit...
						// XXX not sure if this is correct...
						} catch(e){
							this.close(true)
						}
					}
					gui.Window.get().on('close', this.__nw_stop_handler)


				// pure node.js...
				} catch(e) {
					this.runtime = 'node'

					process.on('exit', stop)
				}

			// browser...
			} else if(typeof('window') != 'undefined'){
				this.runtime = 'browser'

				$(window).on('beforeunload', stop)

			// unknown...
			} else {
				this.runtime = 'unknown'
			}

		}],
	// unbind events...
	stop: ['- System/', 
		function(){
			// browser & nw...
			if(this.__stop_handler 
					&& (this.runtime == 'browser' || this.runtime == 'nw')){
				$(window).off('beforeunload', this.__stop_handler)
			}

			// nw...
			if(this.__nw_stop_handler && this.runtime == 'nw'){
				var gui = requirejs('nw.gui')
				gui.Window.get().off('close', this.__nw_stop_handler)
				delete this.__nw_stop_handler
			}

			// node...
			if(this.__stop_handler && this.runtime == 'node'){
				process.off('exit', this.__stop_handler)
			}

			delete this.__stop_handler

			this.logger && this.logger.emit('stop')
		}],
})

var LifeCycle = 
module.LifeCycle = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'lifecycle',

	actions: LifeCycleActions,
})



//---------------------------------------------------------------------

// XXX split this into read and write actions...
var BaseActions = 
module.BaseActions = 
actions.Actions({

	config: {
		// XXX should this be here???
		version: 'gen4',

		// see .direction for details...
		'steps-to-change-direction': 3,

		// Determines the image selection mode when focusing or moving 
		// between ribbons...
		//
		// supported modes:
		'ribbon-focus-modes': [
			'visual',	// select image closest visually
			'order',	// select image closest to current in order
			'first',	// select first image
			'last',		// select last image
		],
		'ribbon-focus-mode': 'visual',
	},

	
	// XXX
	get version(){
		return this.config.version
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

	toggleRibbonFocusMode : ['Interface/Toggle ribbon focus mode',
		makeConfigToggler('ribbon-focus-mode', 
			function(){ return this.config['ribbon-focus-modes'] })],


	// basic life-cycle actions...
	//
	// XXX do we need to call .syncTags(..) here???
	load: ['- File|Interface/',
		function(d){
			this.images = images.Images(d.images)
			this.data = data.Data(d.data)
		}],
	clear: ['File|Interface/Clear viewer',
		function(){
			delete this.data
			delete this.images
		}],

	// NOTE: for complete isolation it is best to completely copy the 
	// 		.config...
	clone: ['- File/',
		function(full){
			var res = actions.MetaActions.clone.call(this, full)

			if(this.data){
				res.data = this.data.clone()
			} 
			if(this.images){
				res.images = this.images.clone()
			}

			return res
		}],

	// XXX should this be here???
	// XXX should this use .load(..)
	// 		...note if we use this it breaks, need to rethink...
	loadURLs: ['File/Load a URL list',
		function(lst, base){
			this.clear()

			this.images = images.Images.fromArray(lst, base)
			this.data = data.Data.fromArray(this.images.keys())
		}],

	// XXX experimental...
	// 		...the bad thing about this is that we can not extend this,
	// 		adding new items to the resulting structure...
	// XXX is this the correct way to go???
	// 		...can we save simple attribute values???
	json: ['- File/Dump state as JSON object',
		'This will collect JSON data from every available attribute '
			+'supporting the .dumpJSON() method.',
		function(mode){
			var res = {}
			for(var k in this){
				// dump the base crop state...
				if(k == 'data' && this.crop_stack && this.crop_stack.length > 0){
					res[k] = this.crop_stack[0].dumpJSON()

				// dump current state...
				} else if(this[k] != null && this[k].dumpJSON != null){
					res[k] = this[k].dumpJSON()
				}
			}
			return res
		}],


	// basic navigation...
	//
	focusImage: ['- Navigate/Focus image',
		function(img, list){
			this.data.focusImage(img, list)
		}],
	// Focuses a ribbon by selecting an image in it...
	//
	// modes supported:
	// 	'order'			- focus closest image to current in order
	// 	'first'/'last'	- focus first/last image in ribbon
	// 	'visual'		- focus visually closest to current image
	//
	// NOTE: default mode is set in .config.ribbon-focus-mode
	focusRibbon: ['- Navigate/Focus Ribbon',
		function(target, mode){
			var data = this.data
			var r = data.getRibbon(target)
			if(r == null){
				return
			}
			var c = data.getRibbonOrder()
			var i = data.getRibbonOrder(r)

			mode = mode || this.config['ribbon-focus-mode'] || 'order'

			// NOTE: we are not changing the direction here based on 
			// 		this.direction as swap will confuse the user...
			var direction = c < i ? 'before' : 'after'

			// closest image in order...
			if(mode == 'order'){
				var t = data.getImage(r, direction)

				// if there are no images in the requied direction, try the 
				// other way...
				t = t == null ? data.getImage(r, direction == 'before' ? 'after' : 'before') : t

			// first/last image...
			} else if(mode == 'first' || mode == 'last'){
				var t = data.getImage(mode, r)

			// visually closest image...
			//} else if(mode == 'visual'){
			} else {
				var ribbons = this.ribbons
				var t = ribbons.getImageByPosition('current', r)

				if(t.length > 1){
					t = t.eq(direction == 'before' ? 0 : 1)
				}

				t = ribbons.getElemGID(t)
			}

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
	firstGlobalImage: ['Navigate/First image globally',
		function(){ this.firstImage(true) }],
	lastGlobalImage: ['Navigate/Last image globally',
		function(){ this.lastImage(true) }],

	// XXX skip unloaded images... (groups?)
	// XXX the next two are almost identical...
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

	// XXX skip unloaded images... (groups?)
	// XXX the next two are almost identical...
	prevImageInOrder: ['Navigate/Previous image in order',
		function(){ 
			// NOTE: this used to be algorithmically substantially slower
			// 		than the code below but after .makeSparseImages(..)
			// 		got updated the difference is far less... 
			// 		...since I've already spent the time to write and 
			// 		debug the long version and it gives a small advantage
			// 		I'll keep it for now...
			// 		(~15-20% @ 10K images, e.g 50ms vs 80ms on average)
			//this.prevImage(this.data.getImages('loaded')) 

			var c = {}
			// get prev images for each ribbon...
			for(var r in this.data.ribbons){
				var i = this.data.getImageOrder('prev', r)
				if(i >= 0){
					c[i] = r
				}
			}
			this.prevImage(c[Math.max.apply(null, Object.keys(c))])
		}],
	nextImageInOrder: ['Navigate/Next image in order',
		function(){ 
			// NOTE: this used to be algorithmically substantially slower
			// 		than the code below but after .makeSparseImages(..)
			// 		got updated the difference is far less... 
			// 		...since I've already spent the time to write and 
			// 		debug the long version and it gives a small advantage
			// 		I'll keep it for now...
			// 		(~15-20% @ 10K images)
			//this.nextImage(this.data.getImages('loaded')) 
	
			var c = {}
			// get next images for each ribbon...
			for(var r in this.data.ribbons){
				var i = this.data.getImageOrder('next', r)
				if(i >= 0){
					c[i] = r
				}
			}
			this.nextImage(c[Math.min.apply(null, Object.keys(c))])
		}],

	// XXX should these be here???
	prevTagged: ['- Navigate/Previous image tagged with tag',
		makeTagWalker('prev')],
	nextTagged: ['- Navigate/Next image tagged with tag',
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
	// XXX revise...
	shiftImageTo: ['- Edit|Sort/',
		function(target, to){ this.data.shiftImageTo(target, to) }],
	
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
	tag: ['- Tag/Tag image(s)',
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
	untag: ['- Tag/Untag image(s)',
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
	crop: ['- Crop/Crop image list',
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
	group: ['- Group|Edit/Group images', 
		function(gids, group){ this.data.group(gids, group) }],
	ungroup: ['Group|Edit/Ungroup images', 
		function(gids, group){ this.data.ungroup(gids, group) }],

	// direction can be:
	// 	'next'
	// 	'prev'
	groupTo: ['- Group|Edit/Group to', 
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

	actions: BaseActions,
})



//---------------------------------------------------------------------

// XXX split this into read and write actions...
var ViewerActions = 
module.ViewerActions = 
actions.Actions({
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

		
		// limit key repeat to one per N milliseconds.
		//
		// Set this to -1 or null to run keys without any limitations.
		// XXX at this point the keyboard is setup in ui.js, need to 
		// 		move to a more logical spot...
		'max-key-repeat-rate': 0,

		// Theme to set on startup...
		'theme': null,

		// Supported themes...
		'themes': [
			'gray', 
			'dark', 
			'light',
		],
	},

	// Images...
	// XXX this seems like a hack...
	// 		...should this be here???
	get images(){
		return this.ribbons != null ? this.ribbons.images : null
	},
	// NOTE: if ribbons are null this will have no effect...
	set images(value){
		if(this.ribbons != null){
			this.ribbons.images = value
		}
	},

	get screenwidth(){
		return this.ribbons != null ? this.ribbons.getScreenWidthImages() : null
	},
	set screenwidth(n){
		this.fitImage(n)
	},

	get screenheight(){
		return this.ribbons != null ? this.ribbons.getScreenHeightRibbons() : null
	},
	set screenheight(n){
		this.fitRibbon(n)
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
	updateImage: ['- Interface/Update image (This will do nothing)',
		'This will be called by .refresh(..) and intended for use as an '
			+'trigger for handlers, and not as a callable acation.',
		function(gid, image){ }],


	// General UI stuff...
	// NOTE: this is applicable to all uses...
	toggleTheme: ['Interface/Toggle viewer theme', 
		CSSClassToggler(
			function(){ return this.ribbons.viewer }, 
			function(){ return this.config.themes },
			function(state){ this.config.theme = state }) ],
	setEmptyMsg: ['- Interface/Set message to be displayed when nothing is loaded.',
		function(msg, help){ this.ribbons 
			&& this.ribbons.length > 0 
			&& this.ribbons.setEmptyMsg(msg, help) }],


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
	centerImage: ['- Interface/Center an image in ribbon horizontally',
		function(target, align){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerImage(target, align)
		}],
	centerRibbon: ['- Interface/Center a ribbon vertically',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons.centerRibbon(target)
		}],
	centerViewer: ['- Interface/Center the viewer',
		function(target){
			this
				.centerImage(target)
				.centerRibbon(target)
				.ribbons
					.setOrigin(target)
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

	depends: [
		'lifecycle',
		'base',
	],

	actions: ViewerActions,

	// check if we are running in a UI context...
	// NOTE: this will prevent loading of any features dependant on the 
	// 		UI in a non UI context...
	isApplicable: function(){ 
		return typeof(window) == typeof({}) 
	},

	handlers: [
		['start',
			function(){
				var that = this

				if(this.config.theme){
					this.toggleTheme(this.config.theme)
				}

				if(!this.__viewer_resize){
					this.__viewer_resize = function(){
						if(that.__centering_on_resize){
							return
						}
						// this will prevent centering calls from overlapping...
						that.__centering_on_resize = true

						that.centerViewer()

						delete that.__centering_on_resize
					}

					$(window).resize(this.__viewer_resize)
				}
			}],
		['stop', 
			function(){
				if(that.__viewer_resize){
					$(window).off('resize', that.__viewer_resize) 
					delete that.__viewer_resize
				}
			}],
	],
})



//---------------------------------------------------------------------

// Format:
// 	{
// 		<action>: <undo-action> | <undo-function> | null,
// 		...
// 	}
var journalActions = {
	clear: null,
	load: null,
	loadURLs: null,

	setBaseRibbon: null,

	// XXX need to account for position change, i.e. if action had no 
	// 		effect then do nothing...
	// 		...take target position before and after...
	shiftImageTo: null,

	shiftImageUp: 'shiftImageDown',
	shiftImageDown: 'shiftImageUp',
	shiftImageLeft: 'shiftImageRight',
	shiftImageRight: 'shiftImageLeft',
	shiftRibbonUp: 'shiftRibbonDown',
	shiftRibbonDown: 'shiftRibbonUp',

	rotateCW: 'rotateCCW',
	rotateCCW: 'rotateCW',
	flipHorizontal: 'flipHorizontal',
	flipVertical: 'flipVertical',

	sortImages: null,
	reverseImages: 'reverseImages',
	reverseRibbons: 'reverseRibbons',

	crop: null,
	uncrop: null,

	tag: null, 
	untag: null,

	group: null,
	ungroup: null,
	expandGroup: null,
	collapseGroup: null,

	runJournal: null,
}

function logImageShift(action){
	return [action.slice(-4) != '.pre' ? 
			action + '.pre' 
			: action,
		function(target){
			target = this.data.getImage(target)
			var args = args2array(arguments)

			var o = this.data.getImageOrder(target)
			var r = this.data.getRibbon(target)
			var current = this.current

			return function(){
				var on = this.data.getImageOrder(target)
				var rn = this.data.getRibbon(target)

				if(o == on || r == rn){ 
					/*
					this.journalPush(
						this.current, 
						action, 
						args,
						{
							before: [r, o],
							after: [rn, on],
						})
					*/
					this.journalPush({
						type: 'shift',
						current: current, 
						target: target,
						action: action, 
						args: args,
						undo: journalActions[action],
						diff: {
							before: [r, o],
							after: [rn, on],
						},
					})
				}
				
			}
		}]
}


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

		journal: null,
		rjournal: null,

		clone: [function(full){
				return function(res){
					res.rjournal = null
					res.journal = null
					if(full && this.hasOwnProperty('journal') && this.journal){
						res.journal = JSON.parse(JSON.stringify(this.journal))
					}
				}
			}],

		// XXX might be good to add some kind of metadata to journal...
		journalPush: ['- Journal/Add an item to journal',
			function(data){
				this.journal = (this.hasOwnProperty('journal') 
						|| this.journal) ? 
					this.journal 
					: []
				this.journal.push(data)
			}],
		clearJournal: ['Journal/Clear the action journal',
			function(){
				if(this.journal){
					// NOTE: overwriting here is better as it will keep
					// 		shadowing the parent's .journal in case we 
					// 		are cloned.
					// NOTE: either way this will have no effect as we 
					// 		only use the local .journal but the user may
					// 		get confused...
					//delete this.journal
					this.journal = null
				}
			}],
		runJournal: ['- Journal/Run journal',
			function(journal){
				var that = this
				journal.forEach(function(e){
					// load state...
					that
						.focusImage(e.current)
						// run action...
						[e.action].apply(that, e.args)
				})
			}],

		// XXX need to clear the rjournal as soon as we do something...
		// 		...at this point it is really easy to mess things up by
		// 		undoing something, and after some actions doing a 
		// 		.redoLast(..)
		// XXX this is not ready for production...
		undoLast: ['Journal/Undo last',
			function(){
				var journal = this.journal
				this.rjournal = (this.hasOwnProperty('rjournal') 
						|| this.rjournal) ? 
					this.rjournal 
					: []

				for(var i = journal.length-1; i >= 0; i--){
					var a = journal[i]

					// we undo only a very specific set of actions...
					if(a.undo && a.type == 'shift' && a.args.length == 0){
						this
							.focusImage(a.current)
							[a.undo].call(this, a.target)

						// pop the undo command...
						this.journal.pop()
						this.rjournal.push(journal.splice(i, 1)[0])
						break
					}
				}
			}],
		_redoLast: ['Journal/Redo last',
			function(){
				if(!this.rjournal || this.rjournal.length == 0){
					return
				}

				this.runJournal([this.rjournal.pop()])
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
		logImageShift('shiftImageTo'),
		logImageShift('shiftImageUp'),
		logImageShift('shiftImageDown'),
		logImageShift('shiftImageLeft'),
		logImageShift('shiftImageRight'),
		logImageShift('shiftRibbonUp'),
		logImageShift('shiftRibbonDown'),

	].concat([
			'clear',
			'load',
			'loadURLs',

			'setBaseRibbon',

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

			//'runJournal',
		].map(function(action){
			return [
				action+'.pre', 
				function(){
					this.journalPush({
						type: 'basic',
						current: this.current, 
						action: action, 
						args: args2array(arguments),
					})
				}]
		})), 
})



//---------------------------------------------------------------------

var ConfigLocalStorageActions = actions.Actions({
	config: {
		'config-local-storage-key': 'config',
		
		// NOTE: this is in seconds...
		// NOTE: if this is null or 0 the timer will not start...
		'config-auto-save-local-storage-interval': 3*60,

		// XXX not sure what should be the default...
		'config-local-storage-save-diff': true,
	},

	// XXX should we store this in something like .default_config and
	// 		clone it???
	// 		...do not think so, as the __base_config xhould always be set
	// 		to the values set in code... (check this!)
	__base_config: null,
	__config_loaded: null,
	__auto_save_config_timer: null,

	// Disable localStorage in child, preventing two viewers from messing
	// things up in one store...
	clone: [function(){
		return function(res){
			res.config['config-local-storage-key'] = null
		}
	}],

	storeConfig: ['File/Store configuration',
		function(key){
			var key = key || this.config['config-local-storage-key']

			if(key != null){
				// build a diff...
				if(this.config['config-local-storage-save-diff']){
					var base = this.__base_config || {}
					var cur = this.config
					var config = {}
					Object.keys(cur)
						.forEach(function(e){
							if(cur.hasOwnProperty(e) 
									&& base[e] != cur[e] 
									// NOTE: this may go wrong for objects
									// 		if key order is different...
									// 		...this is no big deal as false
									// 		positives are not lost data...
									|| JSON.stringify(base[e]) != JSON.stringify(cur[e])){
								config[e] = cur[e]
							}
						})

				// full save...
				} else {
					var config = this.config
				}

				// store...
				localStorage[key] = JSON.stringify(config) 
			}
		}],
	loadStoredConfig: ['File/Load stored configuration',
		function(key){
			key = key || this.config['config-local-storage-key']

			if(key && localStorage[key]){
				// get the original (default) config and keep it for 
				// reference...
				// NOTE: this is here so as to avoid creating 'endless'
				// 		config inheritance chains...
				base = this.__base_config = this.__base_config || this.config

				var loaded = JSON.parse(localStorage[key])
				loaded.__proto__ = base

				this.config = loaded 
			}
		}],
	// XXX need to load the reset config, and not just set it...
	resetConfig: ['File/Reset configuration to default state',
		function(){
			this.config = this.__base_config || this.config
		}],

	toggleAutoStoreConfig: ['File/Store configuration',
		Toggler(null, function(_, state){ 
				if(state == null){
					return this.__auto_save_config_timer || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-local-storage-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// this cleans up before 'on' and fully handles 'off' action...
					if(this.__auto_save_config_timer != null){
						clearTimeout(this.__auto_save_config_timer)
						delete this.__auto_save_config_timer
					}

					if(state == 'running' 
							&& interval 
							&& this.__auto_save_config_timer == null){

						var runner = function(){
							clearTimeout(that.__auto_save_config_timer)

							//that.logger && that.logger.emit('config', 'saving to local storage...')
							that.storeConfig()

							var interval = that.config['config-auto-save-local-storage-interval']
							if(!interval){
								delete that.__auto_save_config_timer
								return
							}
							interval *= 1000

							that.__auto_save_config_timer = setTimeout(runner, interval)
						}

						runner()
					}
				}
			},
			'running')],
})

var ConfigLocalStorage = 
module.ConfigLocalStorage = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'config-local-storage',
	depends: [
		'ui',
	],

	isApplicable: function(){ return localStorage != null },

	actions: ConfigLocalStorageActions,

	handlers: [
		// NOTE: considering that allot depends on this it must be 
		// 		first to run...
		['start.pre',
			function(){ 
				this.logger && this.logger.emit('loaded', 'config')
				this
					.loadStoredConfig() 
					.toggleAutoStoreConfig('on')
			}],
		['stop.pre',
			function(){ 
				this.logger && this.logger.emit('loaded', 'config')
				this
					.storeConfig() 
					.toggleAutoStoreConfig('off')
			}],
	],
})



//---------------------------------------------------------------------

// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
//
// XXX try a strategy: load more in the direction of movement by an offset...
// XXX updateRibbon(..) is not signature compatible with data.updateRibbon(..)
var PartialRibbonsActions = actions.Actions({
	config: {
		// number of screen widths to load...
		'ribbon-size-screens': 7,

		// number of screen widths to edge to trigger reload...
		'ribbon-resize-threshold': 1.5,

		// timeout before a non-forced ribbon size update happens after
		// the action...
		// NOTE: if set to null, the update will be sync...
		'ribbon-update-timeout': 120,

		// how many non-adjacent images to preload...
		'preload-radius': 5,

		// sources to preload...
		'preload-sources': ['bookmark', 'selected'],
	},

	// NOTE: this will not work from chrome when loading from a local fs...
	// XXX experimental...
	startCacheWorker: ['Interface/',
		function(){
			// a worker is started already...
			if(this.cacheWorker != null){
				return
			}

			var b = new Blob([[
				'addEventListener(\'message\', function(e) {',
				'	var urls = e.data',
				'	urls = urls.constructor !== Array ? [urls] : urls',
				'	var l = urls.length',
				'	urls.forEach(function(url){',
				'		var xhr = new XMLHttpRequest()',
				'		xhr.responseType = \'blob\'',
				/*
				'		xhr.onload = xhr.onerror = function(){',
				'			l -= 1',
				'			if(l <= 0){',
				'				postMessage({status: \'done.\', urls: urls})',
				'			}',
				'		}',
				*/
				'		xhr.open(\'GET\', url, true)',
				'		xhr.send()',
				'	})',
				'}, false)',
			].join('\n')])

			var url = URL.createObjectURL(b)

			this.cacheWorker = new Worker(url)
			this.cacheWorker.url = url
		}],
	stopCacheWorker: ['Interface/',
		function(){
			if(this.cacheWorker){
				this.cacheWorker.terminate()
				URL.revokeObjectURL(this.cacheWorker.url)
				delete this.cacheWorker
			}
		}],


	// Pre-load images...
	//
	// Sources supported:
	// 	<tag>			- pre-load images tagged with <tag> 
	// 					  (default: ['bookmark', 'selected']) 
	// 	<ribbon-gid>	- pre-cache from a specific ribbon
	// 	'ribbon'		- pre-cache from current ribbon
	// 	'order'			- pre-cache from images in order
	//
	// NOTE: workers when loaded from file:// in a browser context 
	// 		will not have access to local images...
	//
	// XXX need a clear strategy to run this...
	// XXX might be a good idea to make the worker queue the lists...
	// 		...this will need careful prioritization logic...
	// 			- avoid loading the same url too often
	// 			- load the most probable urls first
	// 				- next targets
	// 					- next/prev
	// 						.preCacheJumpTargets(target, 'ribbon', this.screenwidth)
	// 					- next/prev marked/bookmarked/order
	// 						.preCacheJumpTargets(target, 'marked')
	// 						.preCacheJumpTargets(target, 'bookmarked')
	// 						.preCacheJumpTargets(target, 'order')
	// 					- next/prev screen
	// 						.preCacheJumpTargets(target, 'ribbon',
	// 							this.config['preload-radius'] * this.screenwidth)
	// 					- next/prev ribbon
	// 						.preCacheJumpTargets(target, this.data.getRibbon(target, 1))
	// 						.preCacheJumpTargets(target, this.data.getRibbon(target, -1))
	// 				- next blocks
	// 					- what resize ribbon does...
	// XXX coordinate this with .resizeRibbon(..)
	// XXX make this support an explicit list of gids....
	// XXX should this be here???
	preCacheJumpTargets: ['- Interface/Pre-cache potential jump target images',
		function(target, sources, radius, size){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				// NOTE: data.getImage(..) can return null at start or end
				// 		of ribbon, thus we need to account for this...
				: (this.data.getImage(target)
					|| this.data.getImage(target, 'after'))

			sources = sources || this.config['preload-sources'] || ['bookmark', 'selected']
			sources = sources.constructor !== Array ? [sources] : sources
			radius = radius || this.config['preload-radius'] || 9

			var that = this

			// get preview...
			var _getPreview = function(c){
				return that.images[c] 
					&& that.images.getBestPreview(c, size, true).url
			}

			// get a stet of paths...
			// NOTE: we are also ordering the resulting gids by their 
			// 		distance from target...
			var _get = function(i, lst, source, radius, oddity, step){
				var found = oddity
				var max = source.length 

				for(var j = i+step; (step > 0 && j < max) || (step < 0 && j >= 0); j += step){
					var c = source[j]

					if(c == null || that.images[c] == null){
						continue
					}

					// build the URL...
					lst[found] = _getPreview(c)

					found += 2
					if(found >= radius*2){
						break
					}
				}
			}

			// run the actual preload...
			var _run = function(){
				sources.forEach(function(tag){
					// order...
					if(tag == 'order'){
						var source = that.data.order

					// current ribbon...
					}else if(tag == 'ribbon'){
						var source = that.data.ribbons[that.data.getRibbon()]

					// ribbon-gid...
					} else if(tag in that.data.ribbons){
						var source = that.data.ribbons[tag]
				
					// nothing tagged then nothing to do...
					} else if(that.data.tags == null 
							|| that.data.tags[tag] == null 
							|| that.data.tags[tag].length == 0){
						return 

					// tag...
					} else {
						var source = that.data.tags[tag]
					}

					size = size || that.ribbons.getVisibleImageSize() 

					var i = that.data.order.indexOf(target)
					var lst = []

					// get the list of URLs before and after current...
					_get(i ,lst, source, radius, 0, 1)
					_get(i, lst, source, radius, 1, -1)

					// get target preview in case the target is not loaded...
					var p = _getPreview(that.data.getImage(target))
					p && lst.splice(0, 0, p)

					// web worker...
					if(that.cacheWorker != null){
						that.cacheWorker.postMessage(lst)

					// async inline...
					} else {
						// do the actual preloading...
						lst.forEach(function(url){
							var img = new Image()
							img.src = url
						})
					}
				})
			}

			if(that.cacheWorker != null){
				_run()

			} else {
				setTimeout(_run, 0)
			}
		}],

	// NOTE: this will force sync resize if one of the following is true:
	// 		- the target is not loaded
	// 		- we are less than screen width from the edge
	// 		- threshold is set to 0
	// XXX this is not signature compatible with data.updateRibbon(..)
	// XXX do not do anything for off-screen ribbons...
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
	resizeRibbon: ['- Interface/Resize ribbon to n images',
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

	handlers: [
		['focusImage.pre centerImage.pre', 
			function(target, list){
				// NOTE: we have to do this as we are called BEFORE the 
				// 		actual focus change happens...
				// XXX is there a better way to do this???
				target = list != null ? target = this.data.getImage(target, list) : target

				this.updateRibbon(target)
			}],
		['focusImage.post', 
			function(_, target){
				this.preCacheJumpTargets(target)
			}],
		['fitImage.pre', 
			function(n){
				this.updateRibbon('current', n || 1)
				//this.preCacheJumpTargets()
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
				//this.preCacheJumpTargets()
			}],
	],
})



//---------------------------------------------------------------------

var SingleImageActions = actions.Actions({
	config: {
		// NOTE: these will get overwritten if/when the user changes the scale...
		'single-image-scale': null,
		'ribbon-scale': null,
	},

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

	actions: SingleImageActions,

	handlers:[
		['fitImage.post',
			function(){ 

				// singe image mode -- set image proportions...
				if(this.toggleSingleImage('?') == 'on'){
					updateImageProportions.call(this)

					this.config['single-image-scale'] = this.screenwidth

				} else {
					this.config['ribbon-scale'] = this.screenwidth
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


var SingleImageViewLocalStorage =
module.SingleImageViewLocalStorage = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-single-image-view-local-storage',
	depends: [
		'ui-single-image-view',
		'config-local-storage',
	],

	handlers:[
		// set scale...
		['load loadURLs',
			function(){
				// prevent this from doing anything while no viewer...
				if(!this.ribbons || !this.ribbons.viewer || this.ribbons.viewer.length == 0){
					return
				}

				if(this.toggleSingleImage('?') == 'on'){
					this.screenwidth = this.config['single-image-scale'] || this.screenwidth

				} else {
					this.screenwidth = this.config['ribbon-scale'] || this.screenwidth
				}
			}],
	],
})


//---------------------------------------------------------------------
// These feature glue traverse and ribbon alignment...


// XXX manual align needs more work...
var AutoAlignRibbons = 
module.AutoAlignRibbons = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-auto-align',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		// control ribbon alignment...
		//
		// NOTE: when this is null then 'ribbon-focus-mode' will be used...
		// NOTE: this supports the same modes as 'ribbon-focus-mode'...
		'ribbon-align-modes': [
			'none',		// use .config['ribbon-focus-mode']'s value
			'visual',
			'order',
			'first',
			//'last',
			'manual',
		],
		'ribbon-align-mode': null,
	},

	actions: actions.Actions({
		toggleRibbonAlignMode : ['Interface/Toggle ribbon align mode',
			makeConfigToggler('ribbon-align-mode', 
				function(){ return this.config['ribbon-align-modes'] })],
	}),

	handlers: [
		['focusImage.post', 
			function(){ 
				var mode = this.config['ribbon-align-mode'] 
					|| this.config['ribbon-focus-mode']

				if(mode == 'visual' || mode == 'order'){
					this.alignByOrder() 

				} else if(mode == 'first'){
					this.alignByFirst()

				// manual...
				// XXX is this correct???
				} else {
					this
						.centerRibbon()
						.centerImage()
				}
			}],
	],
})


// XXX should .alignByOrder(..) be a feature-specific action or global 
// 		as it is now???
var AlignRibbonsToImageOrder = 
module.AlignRibbonsToImageOrder = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-align-to-order',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		//'ribbon-focus-mode': 'order',
		'ribbon-focus-mode': 'visual',
	},

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

	config: {
		'ribbon-focus-mode': 'first',
	},

	handlers: [
		['focusImage.post', function(){ this.alignByFirst() }],
	],
})

// XXX needs more work...
// XXX need to save position in some way, ad on each load the same 
// 		initial state will get loaded...
// 		...also would need an initial state...
var ManualAlignRibbons = 
module.ManualAlignRibbons = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-ribbon-manual-align',
	depends: ['ui'],
	exclusive: ['ui-ribbon-align'],

	config: {
		'ribbon-focus-mode': 'visual',
	},

	handlers: [
		['focusImage.post', function(){ 
			this
				.centerRibbon()
				.centerImage()
		}],
	],
})



//---------------------------------------------------------------------

// XXX at this point this does not support target lists...
// XXX shift up/down to new ribbon is not too correct...
var ShiftAnimation =
module.ShiftAnimation = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-animation',
	depends: ['ui'],

	handlers: [
		//['shiftImageUp.pre shiftImageDown.pre '
		//		+'travelImageUp.pre travelImageDown.pre', 
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
	flashIndicator: ['- Interface/Flash an indicator',
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

	updateCurrentImageIndicator: ['- Interface/Update current image indicator',
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
var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

// NOTE: if the action returns an instance of overlay.Overlay this will
// 		not close right away but rather bind to:
// 			overlay.close			-> self.focus()
// 			overlay.client.open		-> self.close()
var makeActionLister = function(list, filter, pre_order){
	pre_order = typeof(filter) == typeof(true) ? filter : pre_order
	filter = typeof(filter) == typeof(true) ? null : filter

	return function(path){
		var that = this
		var paths = this.getPath()
		var actions = {}
		var o

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

			// XXX this expects that .client will trigger an open event...
			var waitFor = function(child){
				// we got a widget, wait for it to close...
				if(child instanceof overlay.Overlay){
					closingPrevented = true
					child
						.on('close', function(){ o.focus() })
						.client
							.on('open', function(){ o.close() })
				}
				return child
			}

			// pass args to listers...
			if(k.slice(-1) == '*'){
				actions[k] = function(){ return waitFor(a[n].apply(a, arguments)) }

			// ignore args of actions...
			} else {
				actions[k] = function(){ return waitFor(a[n]()) }
			}

			// toggler -- add state list...
			if(that.isToggler && that.isToggler(n)){
				var states = that[n]('??')
				var cur = that[n]('?')

				// bool toggler...
				if(cur == 'on' || cur == 'off'){
					states = ['off', 'on']
				}

				states.forEach(function(state){
					actions[k +'/'+ state + (cur == state ? ' *': '')] =
						function(){ 
							that[n](state) 
						}
				})
			}
		})

		var config = Object.create(that.config['browse-actions-settings'] || {})
		config.path = path

		// XXX get the correct parent...
		o = overlay.Overlay(that.ribbons.viewer, 
			list(null, actions, config)
				.open(function(evt){ 
					if(!closingPrevented){
						o.close() 
					}
					closingPrevented = false
				}))
			// save show disabled state to .config...
			.close(function(){
				var config = that.config['browse-actions-settings'] 

				config.showDisabled = o.client.options.showDisabled
			})

		// XXX DEBUG
		//window.LIST = o.client

		//return o.client
		return o
	}
}

var ActionTreeActions = actions.Actions({
	config: {
		// NOTE: the slashes at the end are significant, of they are not
		// 		present the .toggleNonTraversableDrawing(..) will hide 
		// 		these paths before they can get any content...
		// 		XXX not sure if this is a bug or not...
		'action-category-order': [
			'File/',
			'Edit/',
			'Navigate/',
		],

		'browse-actions-settings': {
			showDisabled: false,
		},
	},

	// XXX move this to a generic modal overlay feature...
	getOverlay: ['- Interface/Get overlay object',
		function(o){
			return overlay.getOverlay(o || this.viewer)
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
	embededListerTest: ['Test/Lister test (embeded)/*',
		function(path, make){
			make('a/')
			make('b/')
			make('c/')
		}],
	floatingListerTest: ['Test/Lister test (floating)...',
		function(path){
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

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makePathList(null, {
					'a/*': list,
					'b/*': list,
					'c/*': list,
				})
					.open(function(evt, path){ 
						o.close() 

						that.floatingListerTest(path)
					}))

			return o
		}],
	// XXX use this.ribbons.viewer as base...
	drawerTest: ['Test/Drawer widget test',
		function(){
			// XXX use this.ribbons.viewer as base...
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

	// XXX needs cleanup...
	// XXX need a clean constructor strategy -- this and ui.js are a mess...
	// XXX use this.ribbons.viewer as base...
	// XXX BUG: when using this.ribbons.viewer as base some actions leak
	// 		between the two viewers...
	showTaggedInDrawer: ['- Test/Show tagged in drawer',
		function(tag){
			tag = tag || 'bookmark'
			var that = this
			var H = '200px'

			var viewer = $('<div class="viewer">')
				.css({
					height: H,
					background: 'black',
				})
			// XXX use this.ribbons.viewer as base...
			// XXX when using viewer zoom and other stuff get leaked...
			var widget = drawer.Drawer($('body'), 
				$('<div>')
					.css({
						position: 'relative',
						height: H,
					})
					.append(viewer),
				{
					focusable: true,
				})

			var data = this.data.crop(a.data.getTaggedByAll(tag), true)

			var b = actions.Actions()

			// used switch experimental actions on (set to true) or off (unset or false)...
			//a.experimental = true

			// setup actions...
			ImageGridFeatures.setup(b, [
				'viewer-testing',
			])

			// setup the viewer...
			// XXX for some reason if we load this with data and images
			// 		the images will not show up...
			b.load({
					viewer: viewer,
				})

			// load some testing data...
			// NOTE: we can (and do) load this in parts...
			b
				.load({
					data: data,
					images: this.images, 
				})
				// this is needed when loading legacy sources that do not have tags
				// synced...
				// do not do for actual data...
				//.syncTags()
				.setEmptyMsg('No images bookmarked...')
				.fitImage(1)

				// link navigation...
				.on('focusImage', function(){
					that.focusImage(this.current)
				})

			// XXX setup keyboard...
			var keyboard = require('lib/keyboard')

			// XXX move this to the .config...
			var kb = {
				'Basic Control': {
					pattern: '*',

					Home: {
						default: 'firstImage!',
					},
					End: {
						default: 'lastImage!',
					},
					Left: {
						default: 'prevImage!',
						ctrl: 'prevScreen!',
						// XXX need to prevent default on mac + browser...
						meta: 'prevScreen!',
					},
					PgUp: 'prevScreen!',
					PgDown: 'nextScreen!',
					Right: {
						default: 'nextImage!',
						ctrl: 'nextScreen!',
						// XXX need to prevent default on mac + browser...
						meta: 'nextScreen!',
					},
				}
			}

			widget.dom
				// XXX
				.keydown(
					keyboard.dropRepeatingkeys(
						keyboard.makeKeyboardHandler(
							kb,
							function(k){
								window.DEBUG && console.log(k)
							},
							b), 
						function(){ 
							return that.config['max-key-repeat-rate']
						}))

			// XXX STUB
			window.b = b

			return b
		}],
	showBookmarkedInDrawer: ['Test/Show bookmarked in drawer',
		function(){ this.showTaggedInDrawer('bookmark') }],
	showSelectedInDrawer: ['Test/Show selected in drawer',
		function(){ this.showTaggedInDrawer('selected') }],
})

var ActionTree = 
module.ActionTree = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-action-tree',
	depends: ['ui'],

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

	// NOTE: this feature has no actions defined but needs the config...
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
function makeTagTogglerAction(tag){
	var toggler = function(target, action){
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

		// ??
		} else if(action == '?'){
			res = ['on', 'off']
		}

		return res 
	}

	// cheating a bit...
	toggler.__proto__ = Toggler.prototype
	toggler.constructor = Toggler

	return toggler
}
/* XXX this toggler is not fully compatible with the Toggler interface
 * 		thus, we either need to update the Toggler to suppor multiple 
 * 		values or keep this...
function makeTagTogglerAction(tag){
	return Toggler(null,
		function(target, action){
			// get the target...
			target = target || 'current'
			target = target == 'all' 
					|| target == 'loaded' 
					|| target in this.data.ribbons 
						? this.data.getImages(target)
				: target == 'ribbon' ? this.data.getImages('current')
				: target
			target = target.constructor !== Array ? [target] : target

			// get state...
			if(action == null){
				var res = this.data.toggleTag(tag, target, '?')

				return res.constructor == Array ? res
					: res == 'on' ? tag 
					: 'none'

			// on...
			} else if(action == tag){
				this.tag(tag, target)

			// off...
			} else {
				this.untag(tag, target)
			}
		},
		tag)
}
*/

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

	markTagged: ['- Mark/Mark images by tags',
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
		['updateImage', function(_, gid, img){
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
		['updateImage', function(_, gid, img){
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
	config: {
		'application-window': null,

		'window-title': 'ImageGrid.Viewer (${VERSION}): ${FILENAME}',

		// XXX
		'ui-scale-modes': {
			desktop: 0,
			touch: 3,
		},
	},

	// XXX revise these...
	close: ['File|Interface/Close viewer',
		function(){ window.close() }],
	storeWindowGeometry: ['- Interface/Store window state',
		function(){
			// store window parameters (size, state)...
			var gui = requirejs('nw.gui')
			var win = gui.Window.get()

			// fullscreen...
			// ...avoid overwriting size...
			if(win.isFullscreen){
				this.config.window = this.config.window || {}
				this.config.window.fullscreen = true
				this.config.window.zoom = win.zoomLevel 

			} else {
				this.config.window = {
					size: {
						width: win.width,
						height: win.height,
					},
					fullscreen: false,
					zoom: win.zoomLevel ,
				}
			}
		}],
	restoreWindowGeometry: ['- Interface/Restore window state',
		function(){
			// or global.window.nwDispatcher.requireNwGui()
			// (see: https://github.com/rogerwang/node-webkit/issues/707)
			var gui = requirejs('nw.gui') 
			var win = gui.Window.get()

			// XXX move this into .restoreWindowGeometry(..)
			// get window state from config and load it...
			var cfg = this.config.window
			if(cfg != null){
				var W = screen.width
				var H = screen.height
				var w = 800
				var h = 600
				var s = cfg.scale

				if(cfg.size){
					w = win.width = Math.min(cfg.size.width, screen.width)
					h = win.height = Math.min(cfg.size.height, screen.height)
				}

				// place on center of the screen...
				var x = win.x = (W - w)/2
				var y = win.y = (H - h)/2

				if(s){
					win.zoomLevel = s
				}

				//console.log('GEOMETRY:', w, h, x, y)

				this.centerViewer()
			}


			win.show()

			if(cfg != null && cfg.fullscreen){
				this.toggleFullScreen()
			}

			/* XXX still buggy....
			// restore interface scale...
			this.toggleInterfaceScale(
				this.config['ui-scale-mode'] 
				|| this.toggleInterfaceScale('??')[0])
			*/
		}],
	toggleFullScreen: ['Interface/Toggle full screen mode',
		function(){
			var that = this
			this.ribbons.preventTransitions()

			// hide the viewer to hide any animation crimes...
			this.ribbons.viewer[0].style.visibility = 'hidden'

			// XXX where should toggleFullscreenMode(..) be defined...
			// 		...this also toggles a fullscreen css class on body...
			toggleFullscreenMode() 
			//requirejs('nw.gui').Window.get().toggleFullscreen()

			setTimeout(function(){ 
				that
					.centerViewer()
					.focusImage()
					.ribbons
						.restoreTransitions()

				that.ribbons.viewer[0].style.visibility = ''
			}, 0)
		}],
	// XXX need to account for scale in PartialRibbons
	// XXX should this be browser API???
	toggleInterfaceScale: ['Interface/Toggle interface modes',
		makeConfigToggler('ui-scale-mode', 
			function(){ return Object.keys(this.config['ui-scale-modes']) },
			function(state){ 
				var gui = requirejs('nw.gui')
				var win = gui.Window.get()


				this.ribbons.preventTransitions()

				var w = this.screenwidth
				win.zoomLevel = this.config['ui-scale-modes'][state] || 0
				this.screenwidth = w
				this.centerViewer()

				this.ribbons.restoreTransitions()
			})],
	showDevTools: ['Interface|Development/Show Dev Tools',
		function(){
			if(window.showDevTools != null){
				showDevTools() 
			}
		}],
})


// XXX this needs a better .isApplicable(..)
// XXX store/load window state...
// 		- size
// 		- state (fullscreen/normal)
var AppControl = 
module.AppControl = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'app-control',
	depends: [
		'ui',
	],

	actions: AppControlActions,

	// XXX test if in:
	// 	- chrome app
	// 	- nw
	// 	- mobile
	isApplicable: function(){
		return window.nodejs != null
	},

	// XXX show main window...
	handlers: [
		['start',
			function(){ 
				// XXX this messes up ribbon scale...
				// 		...to close/fast?
				//this.toggleInterfaceScale('!')
				
				this.restoreWindowGeometry()

			}],
		[[
			'close.pre',
			'toggleFullScreen',
		],
			function(){ this.storeWindowGeometry() }],
		['focusImage',
			function(){
				var gui = requirejs('nw.gui') 
				var win = gui.Window.get()

				if(this.images){
					var img = this.images[this.current]
					win.title = (this.config['window-title'] 
							|| 'ImageGrid.Viewer (${VERSION}): ${FILENAME}')
						// XXX get this from the viewer...
						.replace('${VERSION}', this.version || 'gen4')
						.replace('${FILENAME}', 
							(img.name 
								|| img.path.replace(/\.[\\\/]/, '')))
						.replace('${PATH}', 
							(img.base_path || '.') 
								+'/'+ img.path.replace(/\.[\\\/]/, ''))
						.replace('${DIR}', 
							pathlib.dirname((img.base_path || '.') 
								+'/'+ img.path.replace(/\.[\\\/]/, '')))
						// XXX add ...
						
				}
			}],
	],
})



//---------------------------------------------------------------------
// XXX should this or LocationLocalStorage save/load location (now it's 
// 		done by history)
// XXX this should provide mechaincs to define location handlers, i.e.
// 		a set for loader/saver per location type (.method)
// XXX revise the wording...
// 		.method?
// 		.path or .url

var LocationActions = actions.Actions({
	// Format:
	// 	{
	// 		path: <base-path>,
	// 		method: <load-method>,
	// 	}
	//
	// NOTE: these will remove the trailing '/' (or '\') from .path 
	// 		unless the path is root (i.e. "/")...
	// 		...this is mainly to facilitate better browse support, i.e.
	// 		to open the dir (open parent + select current) and not 
	// 		within the dir
	__location: null,
	get location(){
		this.__location = this.__location || {}

		var b = this.__location.path
		if(b && b != '/' && b != '\\'){
			b = normalizePath(b)
		}

		if(b){
			this.__location.path = b
		}
		return this.__location
	},
	set location(value){
		// got a path...
		if(typeof(value) == typeof('str')){
			var path = value
			// XXX get a better reasonable default...
			var method = this.__location 
				&& this.__location.method 
					|| undefined 

		// got an object...
		} else {
			var path = value.path
			var method = value.method
		}

		// normalize path if it's not root...
		if(path != '/' && path != '\\'){
			path = normalizePath(path)
		}

		this.__location = {
			path: path,
			method: method,
		}

		this[value.method || 'loadIndex'](path)
	},
})

module.AppControl = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'location',

	actions: LocationActions,
})



//---------------------------------------------------------------------
// fs reader/loader...

// XXX at this point this is a stub...
if(window.nodejs != null){
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var glob = requirejs('glob')
	var file = requirejs('./file')
	// XXX this for some reason does not load in nw while require(..)
	// 		for some reason works in browser...
	//var browseWalk = requirejs('./lib/widget/browse-walk')
	var browseWalk = require('./lib/widget/browse-walk')
}


// NOTE: we are not using node's path module as we need this to work in
// 		all contexts, not only node... (???)
// 		XXX currently this is only used in node-specific modules and in 
// 			images...
// XXX make this standard...
var normalizePath = 
module.normalizePath =
function(path){
	return typeof(path) == typeof('str') ? path
			// normalize the slashes...
			.replace(/(\/)/g, '/')
			// remove duplicate '/'
			.replace(/(\/)\1+/g, '/')
			// remove trailing '/'
			.replace(/\/+$/, '')
			// take care of .
			.replace(/\/\.\//g, '/')
			.replace(/\/\.$/, '')
			// take care of ..
			.replace(/\/[^\/]+\/\.\.\//g, '/')
			.replace(/\/[^\/]+\/\.\.$/, '')
		: path
}


// XXX revise base path mechanics...
// 		.loaded_paths
var FileSystemLoaderActions = actions.Actions({
	config: {
		'index-dir': '.ImageGrid',

		'image-file-pattern': '*+(jpg|jpeg|png|JPG|JPEG|PNG)',
	},

	clone: [function(full){
		return function(res){
			if(this.location){
				res.location.path = this.location.path
				res.location.method = this.location.method
			}
			if(this.loaded_paths){
				res.loaded_paths = JSON.parse(JSON.stringify(this.loaded_paths))
			}
		}
	}],

	loaded_paths: null,


	// XXX is this a hack???
	// XXX need a more generic form...
	checkPath: ['- File/',
		function(path){ return fse.existsSync(path) }],

	// NOTE: when passed no path this will not do anything...
	// XXX should this set something like .path???
	// 		...and how should this be handled when merging indexes or
	//		viewing multiple/clustered indexes???
	// XXX add a symmetric equivalent to .prepareIndexForWrite(..) so as 
	// 		to enable features to load their data...
	// XXX look inside...
	loadIndex: ['- File/Load index',
		function(path, logger){
			var that = this

			if(path == null){
				return
			}

			// XXX get a logger...
			logger = logger || this.logger

			// XXX make this load incrementally (i.e. and EventEmitter
			// 		a-la glob)....
			file.loadIndex(path, this.config['index-dir'], logger)
				.then(function(res){
					// XXX if res is empty load raw...

					// XXX use the logger...
					//console.log('FOUND INDEXES:', Object.keys(res).length)

					// skip nested paths...
					// XXX make this optional...
					// XXX this is best done BEFORE we load all the 
					// 		indexes, e.g. in .loadIndex(..)
					var paths = Object.keys(res)
					var skipped = []
					paths.forEach(function(p){
						// already removed...
						if(skipped.indexOf(p) >= 0){
							return
						}

						paths
							// get all paths that fully contain p...
							.filter(function(o){
								return o != p && o.indexOf(p) == 0
							})
							// drop all longer paths...
							.forEach(function(e){
								skipped.push(e)
								delete res[e]
							})
					})
					//console.log('SKIPPING NESTED:', skipped.length)

					var index
					var base_path
					var loaded = []

					// NOTE: res may contain multiple indexes...
					for(var k in res){

						// skip empty indexes...
						// XXX should we rebuild  or list here???
						if(res[k].data == null || res[k].images == null){
							continue
						}

						var part = file.buildIndex(res[k], k)

						// load the first index...
						if(index == null){
							// XXX use the logger...
							//console.log('LOADING:', k, res)
							logger && logger.emit('base index', k, res)

							index = part

						// merge indexes...
						// XXX need to skip sub-indexes in the same sub-tree...
						// 		...skip any path that fully contains an 
						// 		already loaded path..
						// XXX load data in chunks rather than merge...
						} else {
							//console.log('MERGING:', k, part)
							logger && logger.emit('merge index', k, res)

							// merge...
							// XXX this appears to lose bookmarks and other tags...
							index.data.join(part.data)
							index.images.join(part.images)
						}

						loaded.push(k)

						// XXX do a better merge and remove this...
						// 		...we either need to lazy-load clustered indexes
						// 		or merge, in both cases base_path should reflet
						// 		the fact that we have multiple indexes...
						break
					}

					logger && logger.emit('load index', index)

					that.loaded_paths = loaded
					// XXX should we get the requested path or the base path currently loaded
					that.__location ={
						path: loaded.length == 1 ? loaded[0] : path,
						method: 'loadIndex',
					}

					that.load(index)
				})
		}],
	// XXX use the logger...
	// XXX add a recursive option...
	// 		...might also be nice to add sub-dirs to ribbons...
	// XXX make image pattern more generic...
	loadImages: ['- File/Load images',
		function(path, logger){
			if(path == null){
				return
			}

			var that = this

			// NOTE: we set this before we start the load so as to let 
			// 		clients know what we are loading and not force them
			// 		to wait to find out...
			// XXX not sure if this is the way to go...
			this.__location = {
				path: path,
				method: 'loadImages',
			}

			glob(path + '/'+ this.config['image-file-pattern'])
				.on('error', function(err){
					console.log('!!!!', err)
				})
				.on('end', function(lst){ 
					that.loadURLs(lst
						.map(function(p){ return normalizePath(p) }), path)

					// NOTE: we set it again because .loadURLs() does a clear
					// 		before it starts loading...
					// 		XXX is this a bug???
					that.__location = {
						path: path,
						method: 'loadImages',
					}
				})
		}],

	// XXX auto-detect format or let the user chose...
	loadPath: ['- File/Load path (STUB)',
		function(path, logger){
			// XXX check if this.config['index-dir'] exists, if yes then
			// 		.loadIndex(..) else .loadImages(..)

			//this.location.method = 'loadImages'
		}],

	// XXX merging does not work (something wrong with .data.join(..))
	// XXX revise logger...
	loadNewImages: ['File/Load new images',
		function(path, logger){
			path = path || this.location.path
			logger = logger || this.logger

			if(path == null){
				return
			}

			var that = this

			// cache the loaded images...
			var loaded = this.images.map(function(gid, img){ return img.path })
			var base_pattern = RegExp('^'+path)

			// find images...
			glob(path + '/'+ this.config['image-file-pattern'])
				.on('end', function(lst){ 
					// create a new images chunk...
					lst = lst
						// filter out loaded images...
						.filter(function(p){
							return loaded.indexOf(
								normalizePath(p)
									// remove the base path if it exists...
									.replace(base_pattern, '')
									// normalize the leading './'
									.replace(/^[\/\\]+/, './')) < 0
						})


					// nothing new...
					if(lst.length == 0){
						// XXX
						logger && logger.emit('loaded', [])
						return
					}

					// XXX
					logger && logger.emit('queued', lst)

					var new_images = images.Images.fromArray(lst, path)
					var gids = new_images.keys()
					var new_data = that.data.constructor.fromArray(gids)

					// merge with index...
					// NOTE: we are prepending new images to the start...
					// NOTE: all ribbon gids will change here...
					var cur = that.data.current
					// XXX this does not seem to work...
					//that.data = new_data.join(that.data)
					that.data = new_data.join('top', that.data)
					that.data.current = cur

					that.images.join(new_images)

					that.reload()

					// XXX report that we are done...
					logger && logger.emit('loaded', lst)
				})
		}],

	clear: [function(){
		delete this.__location
		delete this.loaded_paths
	}],
})


var FileSystemLoader = 
module.FileSystemLoader = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-loader',
	depends: [
		'location',
	],

	actions: FileSystemLoaderActions,

	isApplicable: function(){
		return window.nodejs != null
	},
})



//---------------------------------------------------------------------

// XXX would need to delay the original action while the user is 
// 		browsing...
var makeBrowseProxy = function(action, callback){
	return function(path, logger){
		var that = this
		path = path || this.location.path
		// XXX should we set a start path here to current???
		return this.browsePath(path, 
			function(path){ 
				var res = that[action](path, logger) 
				callback && callback.call(that, path)
				return res
			})
	}
}


var FileSystemLoaderUIActions = actions.Actions({
	config: {
		// list of loaders to complete .browsePath(..) action
		//
		// NOTE: these will be displayed in the same order as they appear
		// 		in the list.
		// NOTE: the first one is auto-selected.
		'path-loaders': [
			'loadIndex',
			'loadImages',
			//'loadPath',
		],

		'file-browser-settings': {
			disableFiles: true,
			showNonTraversable: true,
			showDisabled: true,
		},
	},

	// XXX for some reason the path list blinks (.update()???) when sub 
	// 		menu is shown...
	// XXX should the loader list be nested or open in overlay (as-is now)???
	browsePath: ['File/Browse file system...',
		function(base, callback){
			var that = this
			base = base || this.location.path || '/'

			var o = overlay.Overlay(this.ribbons.viewer, 
				browseWalk.makeWalk(
						null, base, this.config['image-file-pattern'],
						this.config['file-browser-settings'])
					// path selected...
					.open(function(evt, path){ 
						var item = o.client.selected

						// single loader...
						if(callback && callback.constructor === Function){
							// close self and parent...
							o.close() 

							callback(path)

						// list of loaders...
						} else {
							// user-provided list...
							if(callback){
								var loaders = callback

							// build the loaders list from .config...
							} else {
								var loaders = {}
								that.config['path-loaders'].forEach(function(m){
									loaders[that.getDoc(m)[m][0].split('/').pop()] = function(){ 
										return that[m](path) 
									}
								})
							}

							// show user the list...
							var so = overlay.Overlay(that.ribbons.viewer, 
								browse.makeList(null, loaders)
									// close self and parent...
									.open(function(){
										so.close()
										o.close() 
									}))
									// closed menu...
									.close(function(){
										o.focus()
										o.client.select(item)
									})
							// select top element...
							so.client.select(0)

							return so
						}
					}))
					// we closed the browser -- save settings to .config...
					.close(function(){

						var config = that.config['file-browser-settings']

						config.disableFiles = o.client.options.disableFiles
						config.showDisabled = o.client.options.showDisabled
						config.showNonTraversable = o.client.options.showNonTraversable
					})

			return o
		}],

	// NOTE: if no path is passed (null) these behave just like .browsePath(..)
	// 		with the appropriate callback otherwise it will just load 
	// 		the given path (no UI) while .browsePath(..) will load the 
	// 		UI in all cases but will treat the given path as a base path 
	// 		to start from.
	// XXX should passing no path to this start browsing from the current
	// 		path or from the root?
	browseIndex: ['File/Load index', makeBrowseProxy('loadIndex')],
	browseImages: ['File/Load images', makeBrowseProxy('loadImages')],
})


// XXX is this a good name???
var FileSystemLoaderUI = 
module.FileSystemLoaderUI = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-loader',
	depends: ['fs-loader'],

	actions: FileSystemLoaderUIActions,
})



//---------------------------------------------------------------------
// url history...

var URLHistoryActions = actions.Actions({
	config: {
		'url-history-push-up-on-open': false,

		// values:
		// 	-1		- no limit.
		// 	0		- disabled
		// 	1+		- length of history
		'url-history-length': 100,
	},

	__url_history: null,

	// Format:
	// 	{
	// 		url: {
	// 			open: <action-name> | <function>,
	// 			check: <action-name> | <function>,
	// 		},
	// 		...
	// 	}
	//
	// NOTE: last opened url is last...
	// NOTE: though functions are supported they are not recommended as
	// 		we can not stringify them to JSON...
	get url_history(){
		return this.hasOwnProperty('__url_history') ? this.__url_history : undefined
	},
	set url_history(value){
		this.__url_history = value
	},


	clone: [function(full){
		return function(res){
			res.url_history = null
			if(full && this.url_history){
				res.url_history = JSON.parse(JSON.stringify(this.url_history))
			}
		}
	}],

	setTopURLHistory: ['- History/',
		function(url){
			var data = this.url_history[url]

			if(data == null){
				return
			}

			delete this.url_history[url]
			this.url_history[url] = data
		}],
	pushURLToHistory: ['- History/',
		function(url, open, check){
			var l = this.config['url-history-length'] || -1

			if(l == 0){
				return
			}

			url = url || this.location.path
			open = open || this.location.method
			check = check || 'checkPath'

			this.url_history = this.url_history || {}

			// remove the old value...
			if(url in this.url_history && this.config['url-history-push-up-on-open']){
				delete this.url_history[url]
			}

			// push url to history...
			this.url_history[url] = {
				open: open,
				check: check,
			}

			// update history length...
			if(l > 0){
				var k = Object.keys(this.url_history)
				while(k.length > l){
					// drop first url in order -- last added...
					this.dropURLFromHistory(k[0])
					var k = Object.keys(this.url_history)
				}
			}
		}],
	// NOTE: url can be an index, 0 being the last url added to history;
	// 		negative values are also supported.
	dropURLFromHistory: ['- History/', 
		function(url){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			if(url){
				delete this.url_history[url]
			}
		}],
	checkURLFromHistory: ['- History/',
		function(url){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			// if we have a check action then use it...
			if(url && this.url_history[url] && this.url_history[url].check){
				var check = this.url_history[url].check

				if(typeof(check) == typeof('str')){
					return this[check](url)

				} else {
					return check(url)
				}

			// no way to check so we do not know...
			} else {
				return true
			}
		}],
	openURLFromHistory: ['- History/',
		function(url, open){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			if(url && !open && this.url_history[url] && this.url_history[url].open){
				open = this.url_history[url].open
			}

			if(url && open){
				if(open instanceof Function){
					return open(url)

				} else {
					return this[open](url)
				}
			}
		}],
	clearURLHistory: ['History/', 
		function(){ this.url_history = null }],
})


var URLHistory = 
module.URLHistory = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'url-history',
	depends: [
		'location',
	],

	actions: URLHistoryActions,
})


//---------------------------------------------------------------------

// XXX should this be responsible for saving and loading of .location???
// 		...on one hand it's part of the history, on the other it's part 
// 		of file loader...
var URLHistoryLocalStorageActions = actions.Actions({
	config: {
		'url-history-local-storage-key': 'url-history',
		'url-history-loaded-local-storage-key': 'url-history-loaded',
	},

	__url_history: null,

	// load url history...
	get url_history(){
		// get the attr value...
		if(this.hasOwnProperty('__url_history') && this.__url_history){
			return this.__url_history
		}

		var key = this.config['url-history-local-storage-key']
		if(key){
			// get the storage value...
			// if not local __url_history and we are configured, load from storage...
			if(this.config && key){
				var history = localStorage[key]
				if(history){
					try{
						this.__url_history = JSON.parse(history)

					} catch(e) {
						delete localStorage[key]
					}
				}
			}
		}

		return this.hasOwnProperty('__url_history') ? this.__url_history : null
	},
	set url_history(value){
		this.__url_history = value

		var key = this.config['url-history-local-storage-key']
		if(key){
			localStorage[key] = JSON.stringify(value) 
		}
	},


	// Disable localStorage in child...
	clone: [function(){
		return function(res){
			res.config['url-history-local-storage-key'] = null
			res.config['url-history-loaded-local-storage-key'] = null
		}
	}],

	saveURLHistory: ['History/',
		function(){
			var history = this.config['url-history-local-storage-key']
			if(history != null){
				localStorage[history] = 
					JSON.stringify(this.url_history) 
			}

			this.saveLocation()
		}],
	saveLocation: ['History/',
		function(){
			var loaded = this.config['url-history-loaded-local-storage-key']

			if(loaded != null){
				localStorage[loaded] = JSON.stringify(this.location || {})
			}
		}],
	loadLastSavedBasePath: ['- History/',
		function(){
			var loaded = this.config['url-history-loaded-local-storage-key']

			if(loaded && localStorage[loaded]){
				var l = JSON.parse(localStorage[loaded])
				this.openURLFromHistory(l.path, l.method)

			} else {
				this.openURLFromHistory(0)
			}
		}]
})

var URLHistoryLocalStorage = 
module.URLHistoryLocalStorage = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'url-history-local-storage',
	depends: [
		'ui',
		'url-history',
	],

	isApplicable: function(){ return localStorage != null },

	actions: URLHistoryLocalStorageActions,

	// NOTE: loading is done by the .url_history prop...
	handlers: [
		['start',
			function(){ this.loadLastSavedBasePath() }], 
		['stop.pre',
			function(){ this.saveURLHistory() }], 

		// save base_path...
		['load loadURLs', 
			function(){ this.location && this.location.path && this.saveLocation() }],

		// save...
		['pushURLToHistory dropURLFromHistory setTopURLHistory', 
			function(){ 
				this.saveURLHistory()
			}],
		// clear...
		['clearURLHistory.pre',
			function(){
				delete this.__url_history

				var history = this.config['url-history-local-storage-key']
				if(history){
					delete localStorage[history]
				}

				var loaded = this.config['url-history-loaded-local-storage-key']
				if(loaded){
					delete localStorage[loaded]
				}
			}],
	],
})


//---------------------------------------------------------------------

var URLHistoryUIActions = actions.Actions({
	config: {
		// Indicate when to remove striked items from url history list
		//
		// Supported values:
		// 	- true | undefined		- always remove
		// 	- flase					- never remove
		// 	- [ 'open', 'close' ]	- explicitly select event
		'url-history-list-clear': ['open', 'close'],
	},
	// XXX BUG: when running from action menu this breaks...
	// 			...possibly connected with restoring after .preventClosing(..)
	// XXX need to check items...
	// XXX use svg icons for buttons...
	listURLHistory: ['History|File/Show history',
		function(){
			var that = this
			var parent = this.preventClosing ? this.preventClosing() : null
			var cur = this.location.path

			var to_remove = []

			// remove stirked out elements...
			var removeStriked = function(evt){
				var rem = that.config['url-history-list-clear']
				if(rem == false || rem != null && rem.indexOf(evt) < 0){
					return
				}
				to_remove.forEach(function(e){
					that.dropURLFromHistory(e)
				})
				to_remove = []
			}

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
						null, 
						Object.keys(this.url_history).reverse(),
						{
							// add item buttons...
							itemButtons: [
								// move to top...
								['&diams;', 
									function(p){
										var top = this.filter('*', false).first()
										var cur = this.filter('"'+p+'"', false)

										if(!top.is(cur)){
											top.before(cur)
											that.setTopURLHistory(p)
										}
									}],
								// mark for removal...
								['&times;', 
									function(p){
										var e = this.filter('"'+p+'"', false)
											.toggleClass('strike-out')

										if(e.hasClass('strike-out')){
											to_remove.indexOf(p) < 0 
												&& to_remove.push(p)

										} else {
											var i = to_remove.indexOf(p)
											if(i >= 0){
												to_remove.splice(i, 1)
											}
										}
									}],
							],
						})
					.open(function(evt, path){ 
						removeStriked('open')

						o.close() 

						// close the parent ui...
						parent 
							&& parent.close 
							&& parent.close()

						that.openURLFromHistory(path)
					}))
				.close(function(){
					removeStriked('close')

					parent 
						&& parent.focus 
						&& parent.focus()
				})

			var list = o.client

			Object.keys(this.url_history).reverse().forEach(function(p){
				that.checkURLFromHistory(p) || list.filter(p).addClass('disabled')
			})

			// select and highlight current path...
			cur && list
				.select(cur)
					.addClass('highlighted')

			return o
		}],
})

var URLHistoryUI = 
module.URLHistoryUI = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-url-history',
	depends: [
		'ui',
		'url-history',
	],

	actions: URLHistoryUIActions,
})



//---------------------------------------------------------------------

var pushToHistory = function(action, to_top, checker){
	return [action, 
		function(_, path){ 
			path = normalizePath(path)
			if(path){
				this.pushURLToHistory(
					normalizePath(path), 
					action, 
					checker || 'checkPath') 
			}
			if(to_top){
				this.setTopURLHistory(path)
			}
		}]
}

var FileSystemURLHistory = 
module.FileSystemLoaderURLHistory = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-url-history',
	depends: [
		'fs-loader',
		'url-history',
	],

	handlers: [
		pushToHistory('loadImages'), 
		pushToHistory('loadIndex'), 
		pushToHistory('loadPath'), 
		//pushToHistory('loadNewImages'), 
	],
})



//---------------------------------------------------------------------

// Opening the url via .browsePath(..) if url is in history will move 
// it to top of list...
var FileSystemURLHistoryUI = 
module.FileSystemLoaderURLHistoryUI = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-url-history',
	depends: [
		'ui-fs-loader',
		'fs-url-history',
	],

	handlers: [
		['browsePath', 
			function(res){ 
				var that = this
				res.client.open(function(_, path){
					that.setTopURLHistory(path) 
				})
			}],
	],
})



//---------------------------------------------------------------------
// fs writer...

var FileSystemWriterActions = actions.Actions({
	config: {
		//'index-filename-template': '${DATE}-${KEYWORD}.${EXT}',
	},

	// This can be:
	// 	- null/undefined	- write all
	// 	- true				- write all
	// 	- false				- write nothing
	// 	- {
	//		// write/skip data...
	//		data: <bool>,
	//
	//		// write/skip images or write a diff including the given 
	//		// <gid>s only...
	//		images: <bool> | [ <gid>, ... ],
	//
	//		// write/skip tags...
	//		tags: <bool>,
	//
	//		// write/skip bookmarks...
	//		bookmarked: <bool>,
	//
	//		// write/skip selected...
	//		selected: <bool>,
	// 	  }
	//
	// NOTE: in the complex format all fields ar optional; if a field 
	// 		is not included it is not written (same as when set to false)
	// NOTE: .current is written always.
	chages: null,

	clone: [function(full){
			return function(res){
				res.changes = null
				if(full && this.hasOwnProperty('changes') && this.changes){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}
		}],

	// Convert json index to a format compatible with file.writeIndex(..)
	//
	// This is here so as other features can participate in index
	// preparation...
	// There are several stages features can control the output format:
	// 	1) .json() action
	// 		- use this for global high level serialization format
	// 		- the output of this is .load(..) compatible
	// 	2) .prepareIndex(..) action
	// 		- use this for file system write preparation
	// 		- this directly affects the index structure
	//
	// This will get the base index, ignoring the cropped state.
	//
	// Returns:
	// 	{
	// 		// This is the original json object, either the one passed as
	// 		// an argument or the one returned by .json('base')
	// 		raw: <original-json>,
	//
	// 		// this is the prepared object, the one that is going to be
	// 		// saved.
	// 		prepared: <prepared-json>,
	// 	}
	//
	//
	// The format for the <prapared-json> is as follows:
	// 	{
	// 		<keyword>: <data>,
	// 		...
	// 	}
	//
	// The <prepared-json> is written out to a fs index in the following
	// way:
	// 		<index-dir>/<timestamp>-<keyword>.json
	//
	// 	<index-dir>		- taken from .config['index-dir'] (default: '.ImageGrid')
	// 	<timestamp>		- as returned by Date.timeStamp() (see: jli)
	//
	// For more info see file.writeIndex(..) and file.loadIndex(..).
	//
	prepareIndexForWrite: ['- File/Prepare index for writing',
		function(json, full){
			json = json || this.json('base')
			var changes = full ? null 
				: this.hasOwnProperty('changes') ? this.changes
				: null
			return {
				raw: json,
				prepared: file.prepareIndex(json, changes),
			}
		}],
	// NOTE: with no arguments this will save index to .location.path
	saveIndex: ['- File/Save index',
		function(path, logger){
			var that = this
			// XXX this is a stub to make this compatible with makeBrowseProxy(..)
			// 		...we do need a default here...
			/*
			if(path == null){
				return
			}
			*/
			path = path || this.location.path

			// XXX get a logger...
			logger = logger || this.logger

			// XXX get real base path...
			//path = path || this.location.path +'/'+ this.config['index-dir']

			file.writeIndex(
					this.prepareIndexForWrite().prepared, 
					// XXX should we check if index dir is present in path???
					//path, 
					path +'/'+ this.config['index-dir'], 
					this.config['index-filename-template'], 
					logger || this.logger)
				.then(function(){
					that.location.method = 'loadIndex'
				})
		}],

	// XXX same as ctrl-shif-s in gen3
	exportView: ['File/Export current view',
		function(){
		}],
	// XXX not done yet...
	// 		needs:
	// 			ensureDir(..)
	// 			copy(..)
	// 		...both denodeify(..)'ed
	// XXX export current state as a full loadable index
	// XXX might be interesting to unify this and .exportView(..)
	// XXX local collections???
	exportCollection: ['File/Export as collection',
		function(path, logger){
			var json = this.json()

			// get all loaded gids...
			var gids = []
			for(var r in json.data.ribbons){
				this.data.makeSparseImages(json.data.ribbons[r], gids)
			}
			gids = gids.compact()

			// build .images with loaded images...
			// XXX list of previews should be configurable (max size)
			var images = {}
			gids.forEach(function(gid){
				var img = json.images[gid]
				if(img){
					images[gid] = json.images[gid]
					// remove un-needed previews...
					// XXX
				}
			})

			// prepare and save index to target path...
			json.data.order = gids
			json.images = images
			// XXX should we check if index dir is present in path???
			path = path +'/'+ this.config['index-dir']

			// NOTE: if we are to use .saveIndex(..) here, do not forget
			// 		to reset .changes
			file.writeIndex(
				this.prepareIndexForWrite(json).prepared, 
				path, 
				this.config['index-filename-template'], 
				logger || this.logger)
			
			// copy previews for the loaded images...
			// XXX should also optionally populate the base dir and nested favs...
			var base_dir = this.base_dir
			gids.forEach(function(gid){
				var img = json.images[gid]
				var img_base = img.base_path
				img.base_path = path
				var previews = img.preview

				for(var res in previews){
					var from = (img_base || base_dir) +'/'+ preview_path 
					var to = path +'/'+ preview_path

					// XXX do we queue these or let the OS handle it???
					// 		...needs testing, if node's fs queues the io
					// 		internally then we do not need to bother...
					// XXX
					ensureDir(pathlib.dirname(to))
						.catch(function(err){
							// XXX
						})
						.then(function(){
							return copy(from, to)
								// XXX do we need to have both of this 
								// 		and the above .catch(..) or can
								// 		we just use the one above (after
								// 		.then(..))
								.catch(function(err){
									// XXX
								})
						})
				}
			})
		}],
})


var FileSystemWriter = 
module.FileSystemWriter = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-writer',
	// NOTE: this is mostly because of the base path handling...
	depends: ['fs-loader'],

	actions: FileSystemWriterActions,

	isApplicable: function(){
		return window.nodejs != null
	},

	// monitor changes...
	// XXX should we use .load(..) to trigger changes instead of .loadURLs(..)???
	// 		...the motivation is that .crop(..) may also trigger loads...
	// 		....needs more thought...
	handlers: [
		// clear changes...
		// XXX currently if no args are passed then nothing is 
		// 		done here, this might change...
		['loadIndex',
			function(_, path){
				if(path){
					this.changes = false 
				}
			}],
		['saveIndex',
			function(_, path){
				// NOTE: if saving to a different path than loaded do not
				// 		drop the .changes flags...
				if(path && path == this.location.path){
					this.changes = false 
				}
			}],

		// everything changed...
		[[
			'loadURLs',
			'clear',
		], 
			function(){
				// NOTE: this is better than delete as it will shadow 
				// 		the parent's changes in case we got cloned from
				// 		a live instance...
				//delete this.changes
				this.changes = null
			}],

		// data...
		[[
			//'clear',
			//'load',

			'setBaseRibbon',

			'shiftImageTo',
			'shiftImageUp',
			'shiftImageDown',
			'shiftImageLeft',
			'shiftImageRight',
			'shiftRibbonUp',
			'shiftRibbonDown',

			'sortImages',
			'reverseImages',
			'reverseRibbons',

			'group',
			'ungroup',
			'expandGroup',
			'collapseGroup',
		], 
			function(_, target){
				var changes = this.changes = 
					this.hasOwnProperty('changes') ?
						this.changes || {}
						: {}

				changes.data = true
			}],

		// image specific...
		[[
			'rotateCW',
			'rotateCCW',
			'flipHorizontal',
			'flipVertical',
		], 
			function(_, target){
				var changes = this.changes = 
					this.hasOwnProperty('changes') ?
						this.changes || {}
						: {}
				var images = changes.images = changes.images || []
				target = this.data.getImage(target)

				images.push(target)
			}],

		// tags and images...
		// NOTE: tags are also stored in images...
		['tag untag',
			function(_, tags, gids){
				var changes = this.changes = 
					this.hasOwnProperty('changes') ?
						this.changes || {}
						: {}
				var images = changes.images = changes.images || []

				gids = gids || [this.data.getImage()]
				gids = gids.constructor !== Array ? [this.data.getImage(gids)] : gids

				tags = tags || []
				tags = tags.constructor !== Array ? [tags] : tags

				// images...
				changes.images = images.concat(gids).unique()

				// tags...
				if(tags.length > 0){
					changes.tags = true

					// selected...
					if(tags.indexOf('selected') >= 0){
						changes.selected = true
					}

					// bookmark...
					if(tags.indexOf('bookmark') >= 0){
						changes.bookmarked = true
					}
				}
			}],
	]
})


//---------------------------------------------------------------------
// XXX add writer UI feature...
// 		- save as.. (browser)
// 		- save if not base path present (browser)
var FileSystemWriterUIActions = actions.Actions({
	// XXX should this ask the user for a path???
	// XXX this for some reason works differently than browseSaveIndex(..)
	// 		and saves images-diff instead of images...
	saveIndexHere: ['File/Save',
		function(){ 
			if(this.location.path){ 
				this.saveIndex(this.location.path) 
			} 
		}],
	// XXX add ability to create dirs...
	browseSaveIndex: ['File/Save index to...', 
		makeBrowseProxy('saveIndex', function(){
			this.loaction.method = 'loadIndex' })],
})


var FileSystemWriterUI = 
module.FileSystemWriterUI = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-fs-writer',
	depends: [
		'fs-writer', 
		'ui-fs-loader',
	],

	actions: FileSystemWriterUIActions,
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
	'lifecycle',
	'base',
	'ui',

	// features...
	'ui-ribbon-auto-align',
	//'ui-ribbon-align-to-order',
	//'ui-ribbon-align-to-first',
	//'ui-ribbon-manual-align',
	
	'ui-single-image-view',
	'ui-partial-ribbons',

	// XXX
	//'ui-keyboard-control',
	//'ui-direct-control',
	//'ui-indirect-control',

	'image-marks',
	'image-bookmarks',

	// local storage...
	'config-local-storage',
	'url-history-local-storage',
	'ui-single-image-view-local-storage',

	'fs-loader',
		'ui-fs-loader',
		'fs-url-history',
		'ui-fs-url-history',

	'fs-writer',
		'ui-fs-writer',

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
	'ui-url-history',

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
