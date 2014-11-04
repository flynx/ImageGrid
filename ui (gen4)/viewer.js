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
		return function(){
			// NOTE: this may seem like cheating, but .reload() should
			// 		be very efficient, reusing all of the items loaded...
			this.reload()
		}
	}
}

var updateImagePosition =
module.updateImagePosition =
function updateImagePosition(actions, target){
	target = target instanceof jQuery 
		? actions.ribbons.getElemGID(target) 
		: target
	target = target || actions.current

	var source_ribbon = actions.ribbons.getElemGID(actions.ribbons.getRibbon(target))
	var source_order = actions.data.getImageOrder(target)

	return function(){
		actions.ribbons.preventTransitions()

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

	get screenwidth(){
		return this.ribbons != null ? this.ribbons.getScreenWidthImages() : null
	},
	set screenwidth(n){
		this.fitImage(n)
	},


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

			return function(){
				// XXX do a partial load...
				// XXX

				this.reload()
			}
		}],
	// XXX make this better support partial data view...
	// 		...at this point this first loads the full data and then 
	// 		.focusImage(..) triggers a reload...
	// 		.....another approach would be to avoid .reload() where 
	// 		possible...
	reload: ['Reload viewer',
		function(){
			this.ribbons.preventTransitions()

			return function(){
				this.ribbons.updateData(this.data)
				this.focusImage()

				//this.ribbons.restoreTransitions(true)
				this.ribbons.restoreTransitions()
			}
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
	alignByOrder: ['Align ribbons by image order',
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

			// align other ribbons...
			var ribbon = data.getRibbon(gid)
			for(var r in data.ribbons){
				// skip the current ribbon...
				if(r == ribbon){
					continue
				}

				// XXX skip off-screen ribbons...

				// center...
				// XXX is there a 'last' special case here???
				var t = data.getImage(gid, r)
				if(t == null){
					var f = data.getImage('first', r)
					// nothing found -- empty ribbon?
					if(f == null){
						continue
					}
					this.centerImage(f, 'before')
				} else {
					this.centerImage(t, 'after')
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
			this
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
				this.centerImage(f, 'before')
			}
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
	// 		This version aligns the ribbons internally while the above
	// 		version does not align at all, and all alignment is handled
	// 		by a feature.
	//
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


	fitRibbon: ['Fit ribbon vertically',
		function(count){
			this.ribbons.fitRibbon(count)
			this.ribbons.updateImage('*')
		}],

	// XXX is n + 0.5 a good number here???
	fitThreeRibbons: ['Fit three ribbons vertically', function(){ this.fitRibbon(3.5) }],
	fitFiveRibbons: ['Fit five ribbons vertically', function(){ this.fitRibbon(5.5) }],
	fitSevenRibbon: ['Fit seven ribbons vertically', function(){ this.fitRibbon(7.5) }],


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

	// XXX experimental: not sure if this is the right way to go...
	// XXX make this play nice with crops...
	toggleRibbonList: ['Toggle ribbons as images view',
		function(){
			if(this._full_data == null){
				// XXX do a better name here...
				this._full_data = this.data

				// generate the view...
				this.data = this.data.cropRibbons()

				this.reload()
			} else {
				var data = this._full_data
				delete this._full_data

				// restore...
				this.data = data.mergeRibbonCrop(this.data)

				this.reload()
			}
		}],
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
	obj.__proto__ = FeatureProto
	return obj
}



//---------------------------------------------------------------------
// NOTE: this is split out to an action so as to enable ui elements to 
// 		adapt to ribbon size changes...
var PartialRibbonsActions = 
module.PartialRibbonsActions = 
actions.Actions({
	updateRibbonSize: ['Update partial ribbon size', 
		function(target, w, size, threshold){
			target = target instanceof jQuery 
				? this.ribbons.getElemGID(target)
				: this.data.getImage(target)

			w = w || this.screenwidth

			// get config data...
			size = size 
				|| this.config['ribbon-size-screens'] 
				|| 5
			threshold = threshold 
				|| this.config['ribbon-resize-threshold'] 
				|| 1

			// normalize to image count...
			var s = size * w
			var t = threshold * w

			// next/prev loaded... 
			var nl = this.ribbons.getImage(target).nextAll('.image').length
			var pl = this.ribbons.getImage(target).prevAll('.image').length

			// next/prev available...
			var na = this.data.getImages(target, s/2, 'after').length - 1 
			var pa = this.data.getImages(target, s/2, 'before').length - 1 

			// the target is not loaded...
			if(this.ribbons.getImage(target).length == 0
					// passed threshold on the right...
					|| (nl < t && na > nl) 
					// passed threshold on the left...
					|| (pl < t && pa > pl) 
					// loaded more than we need by threshold...
					|| nl + pl + 1 > s + t){

				// NOTE: we can't get ribbon via target directly here as
				// 		the target might not be loaded...
				var r_gid = this.data.getRibbon(target)

				// localize transition prevention... 
				var r = this.ribbons.getRibbon(r_gid)

				if(r.length > 0){
					this.ribbons
						.preventTransitions(r)
						.updateRibbon(
							this.data.getImages(target, s), 
							r_gid,
							target)
						.restoreTransitions(r, true)
				}
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
// 		XXX The two should be completely independent....
// XXX need to test and tweak with actual images...
var PartialRibbons = 
module.PartialRibbons = Feature({
	tag: 'ui-partial-ribbons',

	// number of screen widths to load...
	size: 5,

	// number of screen widths to edge to trigger reload...
	threshold: 1,

	setup: function(actions){
		var feature = this

		actions.mixin(PartialRibbonsActions)

		return actions
			.on('focusImage.pre centerImage.pre', this.tag, function(target){
				this.updateRibbonSize(target)
			})
			.on('fitImage.pre', this.tag, function(n){
				this.updateRibbonSize('current', n || 1)
			})
	},
	remove: function(actions){
		actions.mixout(PartialRibbonsActions)
		return actions.off('*', this.tag)
	},
})



//---------------------------------------------------------------------
// XXX this should also define up/down navigation behavior e.g. what to 
// 		focus on next/prev ribbon...
var AlignRibbonsToImageOrder = 
module.AlignRibbonsToImageOrder = Feature({
	tag: 'ui-ribbon-align-to-order',

	setup: function(actions){
		return actions
			// XXX this can be either pre or post...
			.on('focusImage.post', this.tag, function(target){
				this.alignByOrder(target)
			})
			// normalize the initial state...
			.focusImage()
	},
})



//---------------------------------------------------------------------
var AlignRibbonsToFirstImage = 
module.AlignRibbonsToFirstImage = Feature({
	tag: 'ui-ribbon-align-to-first',

	setup: function(actions){
		return actions
			// XXX this can be either pre or post...
			.on('focusImage.post', this.tag, function(target){
				this.alignByFirst(target)
			})
			// normalize the initial state...
			.focusImage()
	},
})



//---------------------------------------------------------------------
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



//---------------------------------------------------------------------
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
			.on('shiftImageUp.pre', tag, 
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
							that.flashIndicator(this.ribbons.viewer, 'top')
						} else {	
							that.flashIndicator(this.ribbons.viewer, 'up')
						}
					}
				})
			.on('shiftImageDown.pre', tag, 
				function(target){ 
					target = target || this.current
					var r0 = this.data.getRibbonOrder(target)
					var l = this.data.getImages(r0).length

					return function(){
						var r1 = this.data.getRibbonOrder(target)
						if(r0 == r1 && r0 == this.data.ribbon_order.length-1 && l == 1){
							that.flashIndicator(this.ribbons.viewer, 'bottom')
						} else {
							that.flashIndicator(this.ribbons.viewer, 'down') 
						}
					}
				})

			// horizontal shifting...
			.on('shiftImageLeft.pre', tag, 
				function(target){ 
					if(target == null 
							//&& actions.data.getImageOrder('ribbon') == 0){
							&& this.data.getImage('prev') == null){
						that.flashIndicator(this.ribbons.viewer, 'start')
					}
				})
			.on('shiftImageRight.pre', tag, 
				function(target){ 
					if(target == null 
							&& this.data.getImage('next') == null){
						that.flashIndicator(this.ribbons.viewer, 'end')
					}
				})
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})



//---------------------------------------------------------------------
var CurrentImageIndicator = 
module.CurrentImageIndicator = Feature({
	tag: 'ui-current-image-indicator',

	border: 3,
	min_border: 2,

	border_timeout: 200,
	shift_timeout: 200,

	fadein: 500,

	animate: true,

	updateMarker: function(actions, target, update_border){
		var scale = actions.ribbons.getScale()
		var cur = actions.ribbons.getImage(target)
		var ribbon = actions.ribbons.getRibbon()
		var ribbon_set = actions.ribbons.viewer.find('.ribbon-set')

		var marker = ribbon.find('.current-marker')

		// no marker found...
		if(marker.length == 0){
			// get marker globally...
			marker = actions.ribbons.viewer.find('.current-marker')

			// create a marker...
			if(marker.length == 0){
				var marker = $('<div/>')
					.addClass('current-marker '+ this.tag)
					.css({
						opacity: '0',
						top: '0px',
						left: '0px',
					})
					.appendTo(ribbon)
					.animate({
						'opacity': 1
					}, this.fadein)

			// add marker to current ribbon...
			} else {
				marker.appendTo(ribbon)
			}
		}

		var w = cur.outerWidth(true)
		var h = cur.outerHeight(true)

		var border = Math.max(this.min_border, this.border / scale)

		// set border right away...
		if(update_border == 'before'){
			marker.css({ borderWidth: border }) 

		// set border with a delay...
		} else {
			setTimeout(function(){ 
				marker.css({ borderWidth: border }) 
			}, this.border_timeout)
		}

		return marker.css({
			left: cur[0].offsetLeft,

			// keep size same as the image...
			width: w,
			height: h,
		})
	},

	setup: function(actions){
		var timeout
		var that = this
		return actions
			// move marker to current image...
			.on( 'focusImage.post', this.tag, 
					function(target){ that.updateMarker(this, target) })
			// prevent animations when focusing ribbons...
			.on('focusRibbon.pre', this.tag, 
					function(){
						var m = this.ribbons.viewer.find('.current-marker')
						this.ribbons.preventTransitions(m)
						return function(){
							this.ribbons.restoreTransitions(m)
						}
					})
			// Change border size in the appropriate spot in the animation:
			// 	- before animation when scaling up
			// 	- after when scaling down
			// This is done to make the visuals consistent...
			.on( 'fitImage.pre fitRibbon.pre', this.tag, function(w1){ 
				var w0 = this.screenwidth
				w1 = w1 || 1
				return function(){
					that.updateMarker(this, null, w0 > w1 ? 'before' : 'after') 
				}
			})
			// hide marker on shift left/right and show it after done shifting...
			.on('shiftImageLeft.pre shiftImageRight.pre', this.tag, function(){
					this.ribbons.viewer.find('.current-marker').hide()
					if(timeout != null){
						clearTimeout(timeout)
						timeout == null
					}
					return function(){
						var ribbons = this.ribbons
						var fadein = that.fadein
						timeout = setTimeout(function(){ 
							ribbons.viewer.find('.current-marker').fadeIn(fadein)
						}, that.shift_timeout)
					}
				})
			// turn the marker on...
			// XXX not sure about this...
			.focusImage()
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})



//---------------------------------------------------------------------
// XXX
var ImageStateIndicator = 
module.ImageStateIndicator = Feature({
	tag: 'ui-image-state-indicator',

	setup: function(actions){
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})



//---------------------------------------------------------------------
// XXX
var GlobalStateIndicator = 
module.GlobalStateIndicator = Feature({
	tag: 'ui-global-state-indicator',

	setup: function(actions){
	},
	remove: function(actions){
		actions.viewer.find('.' + this.tag).remove()
		return actions.off('*', this.tag)
	},
})



//---------------------------------------------------------------------
// XXX console / log / status bar
// XXX title bar




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
