/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> viewer')

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')

var data = require('data')
var ribbons = require('ribbons')


/*********************************************************************/
// helpers...

var reloadAfter =
module.reloadAfter = 
function reloadAfter(transitions){
	return function(){
		// prevent animations form adding/removing ribbons...
		!transitions && this.ribbons.preventTransitions()

		return function(){
			// NOTE: this may seem like cheating, but .reload() should
			// 		be very efficient, reusing all of the items loaded...
			this.reload()
			!transitions && this.ribbons.restoreTransitions()
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

	// XXX should this be here???
	config: {
		'steps-to-change-direction': 3,
		'max-screen-images': 30,
		'zoom-step': 1.2,
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
	ready: [
		function(){
			// XXX setup empty state...
		}],
	load: [
		function(d){
			this.data = data.Data(d.data)
		}],
	clear: [
		function(){
			delete this.data
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
	firstGlobalImage: ['Get first globally image',
		function(){ this.firstImage(true) }],
	lastGlobalImage: ['Get last globally image',
		function(){ this.lastImage(true) }],

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

	prevImageInOrder: ['Focus previous image in order',
		function(){ this.prevImage(this.data.order) }],
	nextImageInOrder: ['Focus next image in order',
		function(){ this.nextImage(this.data.order) }],


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
	
	reverseImages: ['Reverse image order',
		function(){ this.data.reverseImages() }],
	reverseRibbons: ['Reverse ribbon order',
		function(){ this.data.reverseRibbons() }],


	// XXX this also requires images...
	sortImages: [
		function(){  }],

	// basic image editing...
	//
	// XXX these are not data stuff... should this be split into a 
	// 		separate images block???
	rotateCW: [ 
		function(){  }],
	rotateCCW: [ 
		function(){  }],
	flipVertical: [ 
		function(){  }],
	flipHorizontal: [
		function(){  }],


	// crop...
	//
	crop: [ 
		function(list, flatten){ 
			list = list || this.data.order
			if(this.crop_stack == null){
				this.crop_stack = []
			}
			this.crop_stack.push(this.data)
			this.data = this.data.crop(list, flatten)
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
})



// XXX do partial loading...
var Viewer = 
module.Viewer = 
actions.Actions(Client, {

	ready: [
		function(){
			// XXX setup empty state...
		}],
	load: [
		function(data){
			// recycle the viewer if one is not given specifically...
			var viewer = data.viewer
			viewer = viewer == null && this.ribbons != null 
				? this.ribbons.viewer 
				: viewer
			// XXX do we need to recycle the images???

			// XXX is keeping ribbons here correct???
			if(this.ribbons == null){
				this.ribbons = ribbons.Ribbons(viewer, data.images)
			}

			// NOTE: this is here to prevent animations when the view 
			// 		is resized and recentered...
			this.ribbons.preventTransitions()

			return function(){
				// XXX do a partial load...
				// XXX

				this.ribbons.updateData(this.data)
				this.focusImage()

				this.ribbons.restoreTransitions()
			}
		}],
	reload: [
		function(){
			this.ribbons.updateData(this.data)
			this.focusImage()
		}],
	clear: [
		// XXX do we need to delete the ribbons???
		function(){
			this.ribbons.clear()
			delete this.ribbons
		}],


	// XXX move this to a viewer window action set
	close: ['Cloase viewer',
		function(){
			// XXX should we do anything else here like auto-save???
			window.close() 
		}],
	// XXX where should toggleFullscreenMode(..) be defined...
	toggleFullScreen: ['',
		function(){
			toggleFullscreenMode() 
		}],
	toggleSingleImage: ['',
		function(){
			// XXX
		}],
	// XXX revise this...
	showDevTools: ['',
		function(){
			if(window.showDevTools != null){
				showDevTools() 
			}
		}],


	// align modes...
	// XXX skip invisible ribbons (???)
	// XXX load data chunks...
	alignByOrder: ['Align ribbons by image order',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			ribbons
				.centerRibbon(gid)
				.centerImage(gid)

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
				// XXX is there a 'last' special case here???
				var t = data.getImage(gid, r)
				if(t == null){
					var f = data.getImage('first', r)
					// nothing found -- empty ribbon?
					if(f == null){
						continue
					}
					ribbons.centerImage(f, 'before')
				} else {
					ribbons.centerImage(t, 'after')
				}
			}
		}],
	// XXX these should also affect up/down navigation...
	// 		...navigate by proximity (closest to center) rather than by
	// 		order...
	alignByFirst: ['Aling ribbons except current to first image',
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			// XXX handle raw dom elements...
			var gid = target instanceof jQuery 
				? ribbons.getElemGID(target)
				: data.getImage(target)

			// align current ribbon...
			ribbons
				.centerRibbon(gid)
				.centerImage(gid)

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
				ribbons.centerImage(f, 'before')
			}
		}],
	// NOTE: this will align only a single image...
	centerImage: ['Center image',
		function(target){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: target

			// align current ribbon...
			this.ribbons
				.centerRibbon(target)
				.centerImage(target)
		}],

	// XXX skip invisible ribbons (???)
	// XXX load data chunks...
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

					// XXX see if we need to do some loading...
				
					target = ribbons.focusImage(gid)
				}
			}
		}],
	/*
	// XXX an ideologically different version of .focusImage(..)
	//		The main question here is: 
	//			should we split out aligning to a feature?
	//		The differences/trade-off's in this version:
	//			+ less code in total (not by much)
	//				34 action-only vs. 39 total (25 action + 14 feature)
	//			+ all in one place
	//			+ all the logic in one place
	//			+ usable as-is without any extra "features"
	//			- not customizable without rewriting...
	//			- might be too monolithic (god object?)
	//		...need to think about it a bit more...
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

					// XXX see if we need to do some loading...
					// XXX
				
					target = ribbons.focusImage(gid)

					this.alignByOrder(gid)

				// align current ribbon...
				} else {
					ribbons
						.centerRibbon(target)
						.centerImage(target)
				}
			}
		}],
	*/

	setBaseRibbon: [
		function(target){
			var r = this.data.getRibbon(target)
			r =  r == null ? this.ribbons.getRibbon(target) : r
			this.ribbons.setBaseRibbon(r)
		}],

	prevScreen: ['Focus previous image one screen width away',
		function(){
			this.prevImage(Math.round(this.ribbons.getScreenWidthImages()))
		}],
	nextScreen: ['Focus next image one screen width away',
		function(){
			this.nextImage(Math.round(this.ribbons.getScreenWidthImages()))
		}],

	// zooming...
	//
	// Zooming is done by multiplying the current scale by config['zoom-step']
	// and rounding to nearest discrete number of images to fit on screen.
	zoomIn: ['Zoom in',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())-1
			var d = this.config['zoom-step']
			var s = a.ribbons.getScale() * d
			var n = Math.floor(this.ribbons.getScreenWidthImages(s))
		
			this.fitImage(n <= 0 ? 1 : n)
		}],
	zoomOut: ['Zoom out',
		function(){ 
			this.ribbons.setOrigin()

			//var n = Math.round(this.ribbons.getScreenWidthImages())+1
			var d = this.config['zoom-step']
			var s = a.ribbons.getScale() / d
			var n = Math.ceil(this.ribbons.getScreenWidthImages(s))

			var max = this.config['max-screen-images']
			this.fitImage(n > max ? max : n)
		}],

	fitOrig: ['Fit to original scale',
		function(){ 
			this.ribbons.setScale(1) 
			this.ribbons.updateImage('*')
		}],

	// NOTE: if this gets a count argument it will fit count images, 
	// 		default is one.
	fitImage: ['Fit image',
		function(count){
			this.ribbons.fitImage(count)
			this.ribbons.updateImage('*')
		}],

	fitTwo: ['Fit two images', function(){ this.fitImage(2) }],
	fitThree: ['Fit three images', function(){ this.fitImage(3) }],
	fitFour: ['Fit four images', function(){ this.fitImage(4) }],
	fitFive: ['Fit five images', function(){ this.fitImage(5) }],
	fitSix: ['Fit six images', function(){ this.fitImage(6) }],
	fitSeven: ['Fit seven images', function(){ this.fitImage(7) }],
	fitEight: ['Fit eight images', function(){ this.fitImage(8) }],
	fitNine: ['Fit nine images', function(){ this.fitImage(9) }],
	fitTen: ['Fit ten images', function(){ this.fitImage(10) }],
	fitEleven: ['Fit eleven images', function(){ this.fitImage(11) }],
	fitTwelve: ['Fit twelve images', function(){ this.fitImage(12) }],

	fitMax: ['Fit the maximum number of images',
		function(){ this.fitImage(this.config['max-screen-images']) }],

	// XXX
	fitSmall: ['Show small image',
		function(){  }],
	// XXX
	fitNormal: ['Show normal image',
		function(){  }],
	// XXX
	fitScreen: ['Fit image to screen',
		function(){  }],


	// XXX are these cheating???
	shiftImageUp: [ reloadAfter() ],
	shiftImageDown: [ reloadAfter() ],

	shiftImageLeft: [
		function(target){
			this.ribbons.placeImage(target, -1)
		}],
	shiftImageRight: [
		function(target){
			this.ribbons.placeImage(target, 1)
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
	reverseRibbons: [ reloadAfter(true) ],


	// basic image editing...
	//
	// XXX should these call .images.* or should it be done by data...
	// 		...I think that data is a better candidate as it should be
	// 		standalone...
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: [ 
		function(target){ this.ribbons.rotateCW(target) }],
	rotateCCW: [ 
		function(target){ this.ribbons.rotateCCW(target) }],
	flipVertical: [ 
		function(target){ this.ribbons.flipVertical(target) }],
	flipHorizontal: [
		function(target){ this.ribbons.flipHorizontal(target) }],

	crop: [ reloadAfter() ],
	uncrop: [ reloadAfter() ],
})



/*********************************************************************/
// XXX do a simple feature framework...
// 		...need something like:
// 			Features(['feature_a', 'feature_b'], action).setup()

var FeatureProto =
module.FeatureProto = {
	tag: null,

	remove: function(actions){
		return actions.off('*', this.tag)
	},
}

// XXX also need a feature registry and global feature setup...
// 		something like:
// 			Features.setup(actions, [
// 				'feature1',
// 				'feature2',
// 				...
// 			])
// 		...where the feature list can be saved to config...
// 		Same should be done for .remove()
var Feature =
module.Feature =
function Feature(obj){
	obj.__proto__ = this.FeatureProto
	return obj
}



// XXX need a better name...
// XXX this should also define up/down navigation behavior...
var RibbonAlignToOrder = 
module.RibbonAlignToOrder = Feature({
	tag: 'ui-ribbon-align-to-order',

	setup: function(actions){
		return actions
			.on('focusImage.post', this.tag, function(target){
				this.alignByOrder(target)
			})
			// normalize the initial state...
			.focusImage()
	},
})


// XXX need a better name...
var RibbonAlignToFirst = 
module.RibbonAlignToFirst = Feature({
	tag: 'ui-ribbon-align-to-first',

	setup: function(actions){
		return actions
			.on('focusImage.post', this.tag, function(target){
				this.alignByFirst(target)
			})
			// normalize the initial state...
			.focusImage()
	},
})


var ShiftAnimation =
module.ShiftAnimation = Feature({
	tag: 'ui-animation',

	setup: function(actions){
		var animate = function(target){
				var s = this.ribbons.makeShadow(target, true)
				return function(){ s() }
			}
		// NOTE: this will keep the shadow in place -- the shadow will not
		// 		go to the mountain, the mountain will come to the shadow ;)
		var noanimate = function(target){
				var s = this.ribbons.makeShadow(target)
				return function(){ s() }
			}
		var tag = this.tag
		return actions
			.on('shiftImageUp.pre', tag, animate)
			.on('shiftImageDown.pre', tag, animate)
			.on('shiftImageLeft.pre', tag, noanimate)
			.on('shiftImageRight.pre', tag, noanimate)
	},
})


// XXX
var CurrentIndicator = 
module.CurrentIndicator = Feature({
	tag: 'ui-current-indicator',

	setup: function(actions){
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})


var BoundsIndicators = 
module.BoundsIndicators = Feature({
	tag: 'ui-bounds-indicators',

	flashIndicator: function(viewer, direction){
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

		var indicator = viewer.find(cls)

		if(indicator.length == 0){
			indicator = $('<div>')
				.addClass(cls.replace('.', '') +' '+ this.tag)
				.appendTo(viewer)
		}

		return indicator
			// NOTE: this needs to be visible in all cases and key press 
			// 		rhythms... 
			.show()
			.delay(100)
			.fadeOut(300)
	},

	setup: function(actions){
		var that = this

		var didAdvance = function(indicator){
			return function(){
				var img = this.data.current
				return function(){
					if(img == this.data.current){
						that.flashIndicator(actions.ribbons.viewer, indicator)
					}
				}
			}
		}

		var tag = this.tag
		return actions
			// basic navigation...
			.on('nextImage.pre lastImage.pre', tag, didAdvance('end'))
			.on('prevImage.pre firstImage.pre', tag, didAdvance('start'))
			.on('nextRibbon.pre lastRibbon.pre', tag, didAdvance('bottom'))
			.on('prevRibbon.pre firstRibbon.pre', tag, didAdvance('top'))

			// vertical shifting...
			.on('shiftImageUp.post', tag, 
				function(){ 
					that.flashIndicator(actions.ribbons.viewer, 'up')
				})
			.on('shiftImageDown.post', tag, 
				function(){ 
					that.flashIndicator(actions.ribbons.viewer, 'down') 
				})

			// horizontal shifting...
			.on('shiftImageLeft.pre', tag, 
				function(target){ 
					if(target == null 
							//&& actions.data.getImageOrder('ribbon') == 0){
							&& actions.data.getImage('prev') == null){
						that.flashIndicator(actions.ribbons.viewer, 'start')
					}
				})
			.on('shiftImageRight.pre', tag, 
				function(target){ 
					if(target == null 
							&& actions.data.getImage('next') == null){
						that.flashIndicator(actions.ribbons.viewer, 'end')
					}
				})
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
