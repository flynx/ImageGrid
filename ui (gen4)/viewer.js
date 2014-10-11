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
		function(img){
			this.data.focusImage(img)
		}],
	focusRibbon: ['Focus Ribbon',
		function(target){
			var data = this.data
			var r = data.getRibbon(target)
			var t = data.getImage('current', r)
			// XXX is there a 'last' special case???
			t = t == null ? data.getImage('first', r) : t

			this.focusImage(t, r)
		}],
	setBaseRibbon: ['',
		function(target){ this.data.setBase(target) }],

	// shorthands for .focusImage(..) and .focusRibbon(..)...
	firstImage: ['Focus first image in current ribbon',
		function(){ this.focusImage('first') }],
	lastImage: ['Focus last image in current ribbon',
		function(){ this.focusImage('last') }],

	prevImage: ['Focus previous image',
		function(){ 
			// keep track of traverse direction...
			this.direction = 'left'
			this.focusImage('prev') 
		}],
	nextImage: ['Focus next image',
		function(){ 
			// keep track of traverse direction...
			this.direction = 'right'
			this.focusImage('next') 
		}],

	firstRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('fisrt') }],
	lastRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('last') }],

	// XXX check that going up/down must be stable and not drift to 
	// 		adjacent images...
	prevRibbon: ['Focus previous ribbon',
		function(){ this.focusRibbon('before') }],
	nextRibbon: ['Focus next ribbon',
		function(){ this.focusRibbon('after') }],


	// basic ribbon editing...
	//
	// NOTE: for all of these, current/ribbon image is a default...
	//
	// XXX move this out to a mixin...
	shiftImageUp: ['Shift image up',
		'If implicitly shifting current image (i.e. no arguments), focus '
			+'will shift to the next or previous image in the current '
			+'ribbon depending on current direction.',
		function(target){ 
			// by default we need to update the current position...
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
			// by default we need to update the current position...
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
			this.shiftImageUp(target)
		}],
	// XXX is tracking direction here correct???
	shiftImageLeft: ['Shift image left',
		function(target){ 
			if(target == null){
				this.direction = 'left'
			}
			this.data.shiftImageLeft(target) 
			this.focusImage()
		}],
	// XXX is tracking direction here correct???
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
	
	// XXX
	sortImages: [
		function(){  }],
	// XXX
	reverseImages: [
		function(){  }],


	// basic image editing...
	//
	// XXX
	rotateCW: [ 
		function(){  }],
	rotateCCW: [ 
		function(){  }],
	flipVertical: [ 
		function(){  }],
	flipHorizontal: [
		function(){  }],


	// crop...
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

			this.ribbons = ribbons.Ribbons(viewer, data.images)

			return function(){
				// XXX do a partial load...
				// XXX

				this.ribbons.updateData(this.data)
				this.focusImage()
			}
		}],
	clear: [
		// XXX do we need to delete the ribbons???
		function(){
			this.ribbons.clear()
			delete this.ribbons
		}],


	focusImage: [
		// XXX skip invisible ribbons (???)
		// XXX load data chunks...
		function(target){
			var ribbons = this.ribbons
			var data = this.data

			if(data != null){
				var gid = data.getImage(target)
				gid = gid == null ? data.getImage('current') : gid

				// XXX see if we need to load a new data set...
				// XXX
		
				target = ribbons.focusImage(gid)

			} else {
				target = ribbons.focusImage(target)
				var gid = ribbons.getElemGID(target)
			}

			// align current ribbon...
			ribbons
				.centerRibbon(target)
				.centerImage(target)

			// align other ribbons...
			if(data != null){
				var ribbon = data.getRibbon(gid)
				for(var r in data.ribbons){
					// skip the current ribbon...
					if(r == ribbon){
						continue
					}

					// XXX skip off-screen ribbons...
					// XXX

					// center...
					// XXX is there a 'last' special case here???
					var t = data.getImage(gid, r)
					if(t == null){
						ribbons.centerImage(data.getImage('first', r), 'before')
					} else {
						ribbons.centerImage(t, 'after')
					}
				}
			}
		}],
	setBaseRibbon: ['',
		function(target){
			var r = this.data.getRibbon(target)
			r =  r == null ? this.ribbons.getRibbon(target) : r
			this.ribbons.setBaseRibbon(r)
		}],

	// XXX need screen width in images...
	prevScreen: ['Focus previous image one screen width away',
		function(){
			// XXX
		}],
	// XXX need screen width in images...
	nextScreen: ['Focus next image one screen width away',
		function(){
			// XXX
		}],


	// XXX
	shiftImageUp: [
		function(target){
			return function(){
				// XXX this is cheating...
				this.ribbons.updateData(this.data)
				this.focusImage()
			}
		}],
	shiftImageDown: [
		function(target){
			return function(){
				// XXX this is cheating...
				this.ribbons.updateData(this.data)
				this.focusImage()
			}
		}],
	shiftImageUpNewRibbon: [
		function(target){
			// XXX only create a new ribbon...
		}],
	shiftImageDownNewRibbon: [
		function(target){
			// XXX only create a new ribbon...
		}],
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
			// XXX
		}],
	shiftRibbonDown: [
		function(target){
			// XXX
		}],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
