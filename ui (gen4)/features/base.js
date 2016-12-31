/**********************************************************************
* 
* All the base features...
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')



/*********************************************************************/
// Helpers and meta stuff...

// mode can be:
// 	"ribbon"	- next marked in current ribbon (default)
// 	"all"		- next marked in sequence
//
// XXX add support for tag lists...
var makeTagWalker =
module.makeTagWalker =
function(direction, dfl_tag){
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


// XXX why can't this just be a string action name e.g. {undo: 'shiftImageDown'} ???
// 		....technically we'll jump to the right image anyway...
// 		...it appears that this and a string undo animate differently...
var undoShift = function(undo){
	return function(a){ 
		this[undo](a.args.length == 0 ? a.current : a.args[0]) }}



/*********************************************************************/

// XXX split this into read and write actions...
var BaseActions = 
module.BaseActions = 
actions.Actions({

	config: {
		// XXX should this be here???
		version: 'gen4',

		// Number of steps to change default direction...
		//
		// see .direction for details...
		'steps-to-change-direction': 3,
		// If true, shift up/down will count as a left/right move...
		//
		// see .direction for details...
		'shifts-affect-direction': 'on',

		// Determines the image selection mode when focusing or moving 
		// between ribbons...
		//
		// supported modes:
		//
		// XXX should this be here???
		'ribbon-focus-modes': [
			'order',	// select image closest to current in order
			'first',	// select first image
			'last',		// select last image
		],
		'ribbon-focus-mode': 'order',

	},

	
	// XXX
	get version(){
		return this.config.version
	},

	// basic state...
	// NOTE: the setters in the following use the appropriate actions
	// 		so to avoid recursion do not use these in the specific 
	// 		actions...
	
	// Data...
	get data(){ 
		var d = this.__data = this.__data || data.Data() 
		return d 
	},
	set data(value){ 
		this.__data = value },
	
	// Base ribbon...
	get base(){
		return this.data.base
	},
	set base(value){
		this.setBaseRibbon(value)
	},

	// Current image...
	get current(){
		return this.data.current
	},
	set current(value){
		this.focusImage(value)
	},

	// Current ribbon...
	get current_ribbon(){
		return this.data.getRibbon()
	},
	set current_ribbon(value){
		this.focusRibbon(value)
	},

	// Default direction...
	//
	// The system delays inertial direction change -- after >N steps of 
	// movement in one direction it takes N steps to reverse the default
	// direction.
	//
	// This can be 'left' or 'right', other values are ignored.
	//
	// Assigning '!' to this is the same as assigning (repeating) the 
	// last assigned value again.
	//
	// Assigning 'left!' or 'right!' ('!' appended) will reset the counter
	// and force direction change.
	//
	// Configuration (.config):
	// 	'steps-to-change-direction' 	
	// 		Sets the number of steps to change direction (N)
	//
	//	'shifts-affect-direction'
	//		If 'on', add last direction change before vertical shift to 
	//		direction counter (N)
	//		This makes the direction change after several shifts up/down
	//		"backwards" a bit faster.
	//
	get direction(){
		return this._direction >= 0 ? 'right'
			: this._direction < 0 ? 'left'
			: 'right'
	},
	set direction(value){
		// repeat last direction...
		if(value == '!'){
			if(this._direction_last == null){
				return
			}
			this.direction = this._direction_last

		// force direction change...
		} else if(typeof(value) == typeof('str') 
				&& value.slice(-1) == '!'){
			value = this._direction = value == 'left!' ? -1
				: value == 'right!' ? 0
				: this._direction
			this._direction_last = value >= 0 ? 'right' : 'left'

		// 'update' direction...
		} else {
			value = value == 'left' ? -1 
				: value == 'right' ? 1
				: 0
			this._direction_last = value >= 0 ? 'right' : 'left'
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
		core.makeConfigToggler('ribbon-focus-mode', 
			function(){ return this.config['ribbon-focus-modes'] })],


	// basic life-cycle actions...
	//
	// XXX do we need to call .syncTags(..) here???
	load: ['- File|Interface/',
		{journal: true},
		function(d){
			this.clear()

			this.images = images.Images(d.images)
			this.data = data.Data(d.data)
		}],
	clear: ['File|Interface/Clear viewer',
		{journal: true},
		function(){
			//delete this.data
			//delete this.images
			this.data = null
			this.images = null
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

	dataFromURLs: ['- File/',
		function(lst, base){
			var imgs = images.Images.fromArray(lst, base)
			return {
				images: imgs,
				data: data.Data.fromArray(imgs.keys()),
			}
		}],

	// XXX should this be here???
	// XXX should this use .load(..)
	// 		...note if we use this it breaks, need to rethink...
	loadURLs: ['- File/Load a URL list',
		{journal: true},
		function(lst, base){ this.load(this.dataFromURLs(lst, base)) }],

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
				if(this[k] != null && this[k].dumpJSON != null){
					res[k] = this[k].dumpJSON()
				}
			}
			return res
		}],

	replaceGid: ['- System/Replace image gid',
		{journal: true},
		function(from, to){
			from = this.data.getImage(from)

			// data...
			var res = this.data.replaceGid(from, to)

			if(res == null){
				return
			}

			// images...
			this.images && this.images.replaceGid(from, to)
		}],


	// basic navigation...
	//
	focusImage: ['- Navigate/Focus image',
		function(img, list){ this.data.focusImage(img, list) }],
	// Focuses a ribbon by selecting an image in it...
	//
	// modes supported:
	// 	'order'			- focus closest image to current in order
	// 	'first'/'last'	- focus first/last image in ribbon
	// 	'visual'		- focus visually closest to current image
	//
	// NOTE: default mode is set in .config.ribbon-focus-mode
	// NOTE: this explicitly does nothing if mode is unrecognised, this
	// 		is done to add support for other custom modes...
	focusRibbon: ['- Navigate/Focus Ribbon',
		function(target, mode){
			var data = this.data
			if(data == null){
				return
			}

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

			// unknown mode -- do nothing...
			} else {
				return
			}

			this.focusImage(t, r)
		}],
	// XXX add undo...
	setBaseRibbon: ['Edit/Set base ribbon',
		{journal: true},
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

	// NOTE: resetting this option will clear the last direction...
	toggleShiftsAffectDirection: ['Interface/Shifts affect direction',
		core.makeConfigToggler('shifts-affect-direction', 
			['off', 'on'],
			function(action){
				if(action == 'on'){
					delete this._direction_last
				}
			})],


	// NOTE: this does not retain direction information, handle individual
	// 		actions if that info is needed.
	// NOTE: to make things clean, this is triggered in action handlers 
	// 		below...
	shiftImage: ['- Interface/Image shift (do not use directly)',
		core.notUserCallable(function(gid){
			// This is the image shift protocol root function
			//
			// Not for direct use.
		})],

	// XXX to be used for things like mark/place and dragging...
	// XXX revise...
	// XXX undo
	shiftImageTo: ['- Edit|Sort/',
		{undo: function(a){ this.shiftImageTo(a.args[1], a.args[0]) }},
		function(target, to){ this.data.shiftImageTo(target, to) }],
	
	shiftImageUp: ['Edit/Shift image up',
		'If implicitly shifting current image (i.e. no arguments), focus '
			+'will shift to the next or previous image in the current '
			+'ribbon depending on current direction.',
		// XXX can this be simply a {undo: 'shiftImageDown'} ???
		{undo: undoShift('shiftImageDown')},
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
				this.config['shifts-affect-direction'] == 'on' && (this.direction = '!')

			// if a specific target is given, just shift it...
			} else {
				this.data.shiftImageUp(target)
			}
		}],
	shiftImageDown: ['Edit/Shift image down',
		'If implicitly shifting current image (i.e. no arguments), focus '
			+'will shift to the next or previous image in the current '
			+'ribbon depending on current direction.',
		{undo: undoShift('shiftImageUp')},
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
				this.config['shifts-affect-direction'] == 'on' && (this.direction = '!')

			// if a specific target is given, just shift it...
			} else {
				this.data.shiftImageDown(target)
			}
		}],
	// XXX undo...
	shiftImageUpNewRibbon: ['Edit/Shift image up to a new empty ribbon',
		function(target){
			this.data.newRibbon(target)
			this.shiftImageUp(target)
		}],
	// XXX undo...
	shiftImageDownNewRibbon: ['Edit/Shift image down to a new empty ribbon',
		function(target){
			this.data.newRibbon(target, 'below')
			this.shiftImageDown(target)
		}],
	shiftImageLeft: ['Edit|Sort/Shift image left',
		{undo: undoShift('shiftImageRight')},
		function(target){ 
			if(target == null){
				this.direction = 'left'
			}
			this.data.shiftImageLeft(target) 
			this.focusImage()
		}],
	shiftImageRight: ['Edit|Sort/Shift image right',
		{undo: undoShift('shiftImageLeft')},
		function(target){ 
			if(target == null){
				this.direction = 'right'
			}
			this.data.shiftImageRight(target) 
			this.focusImage()
		}],

	shiftRibbonUp: ['Ribbon|Edit|Sort/Shift ribbon up',
		{undo: undoShift('shiftRibbonDown')},
		function(target){ 
			this.data.shiftRibbonUp(target) 
			// XXX is this the right way to go/???
			this.focusImage()
		}],
	shiftRibbonDown: ['Ribbon|Edit|Sort/Shift ribbon down',
		{undo: undoShift('shiftRibbonUp')},
		function(target){ 
			this.data.shiftRibbonDown(target)
			// XXX is this the right way to go/???
			this.focusImage()
		}],

	// these operate on the current image...
	travelImageUp: ['Edit/Travel with the current image up (Shift up and keep focus)',
		{undo: undoShift('travelImageDown')},
		function(target){
			target = target || this.current
			this.shiftImageUp(target)
			this.focusImage(target)
		}],
	travelImageDown: ['Edit/Travel with the current image down (Shift down and keep focus)',
		{undo: undoShift('travelImageUp')},
		function(target){
			target = target || this.current
			this.shiftImageDown(target)
			this.focusImage(target)
		}],

	
	reverseImages: ['Edit|Sort/Reverse image order',
		{undo: 'reverseImages'},
		function(){ this.data.reverseImages() }],
	reverseRibbons: ['Ribbon|Edit|Sort/Reverse ribbon order',
		{undo: 'reverseRibbons'},
		function(){ this.data.reverseRibbons() }],

	// XXX align to ribbon...

	// basic image editing...
	//
	// Rotate image...
	//
	//	Rotate current image clockwise...
	//	.rotate()
	//	.rotate('cw')
	//		-> actions
	//
	//	Rotate current image counterclockwise...
	//	.rotate('ccw')
	//		-> actions
	//
	//	Rotate target image clockwise...
	//	.rotate(target)
	//	.rotate(target, 'cw')
	//		-> actions
	//
	//	Rotate target image counterclockwise...
	//	.rotate(target, 'ccw')
	//		-> actions
	//
	//
	// Flip is similar...
	//
	// 	Flip current image ('horizontal' is default)...
	//	.flip()
	//	.flip('horizontal')
	//	.flip('vertical')
	//		-> actions
	//
	//	Flip target...
	//	.flip(target)
	//	.flip(target, 'horizontal')
	//	.flip(target, 'vertical')
	//		-> actions
	//
	//
	// NOTE: target must be .data.getImage(..) compatible, see it for docs...
	rotate: ['- Image|Edit/Rotate image',
		function(target, direction){
			if(arguments.length == 0){
				return this.image && this.image.orientation || 0
			}
			if(target == 'cw' || target == 'ccw'){
				direction = target
				target = null
			}
			this.images 
				&& this.images.rotateImage(this.data.getImage(target), direction || 'cw')
		}],
	flip: ['- Image|Edit/Flip image',
		function(target, direction){
			if(target == 'vertical' || target == 'horizontal'){
				direction = target
				target = null
			}
			this.images 
				&& this.images.flipImage(this.data.getImage(target), direction || 'horizontal')
		}],

	// shorthands...
	// NOTE: these are here mostly for the menus...
	rotateCW: ['Image|Edit/Rotate image clockwise', 
		{undo: 'rotateCCW'},
		function(target){ this.rotate(target, 'cw') }],
	rotateCCW: ['Image|Edit/Rotate image counterclockwise', 
		{undo: 'rotateCW'},
		function(target){ this.rotate(target, 'ccw') }],
	flipVertical: ['Image|Edit/Flip image vertically',
		{undo: 'flipVertical'},
		function(target){ this.flip(target, 'vertical') }],
	flipHorizontal: ['Image|Edit/Flip image horizontally',
		{undo: 'flipHorizontal'},
		function(target){ this.flip(target, 'horizontal') }],


	// complex operations...
	// XXX need interactive mode for this...
	// 		- on init: select start/end/base
	// 		- allow user to reset/move
	// 		- on accept: run
	alignToRibbon: ['Ribbon|Edit/Align top ribbon to base',
		{journal: true},
		function(target, start, end){
			this.data = this.data.alignToRibbon(target, start, end)
		}],
})


var Base =
module.Base = core.ImageGridFeatures.Feature({
	title: 'ImageGrid base',

	tag: 'base',
	/* XXX ???
	suggested: [
		'tags',
		'sort',
		'tasks',
	],
	*/

	actions: BaseActions,

	handlers: [
		[[
			'shiftImageTo',
			'shiftImageUp',
			'shiftImageDown',
			'shiftImageLeft',
			'shiftImageRight',
		], 
			function(){ this.shiftImage.apply(this, [].slice(arguments, 1))}],
	],
})


//---------------------------------------------------------------------
// Tags...

var TagsActions = 
module.TagsActions = actions.Actions({
	// tags...
	//
	// XXX mark updated...
	tag: ['- Tag/Tag image(s)',
		{journal: true},
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
		{journal: true},
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
		{journal: true},
		function(source, mode){
			// can't do anything if either .data or .images are not 
			// defined...
			if(this.images == null){
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
	
	prevTagged: ['- Navigate/Previous image tagged with tag',
		makeTagWalker('prev')],
	nextTagged: ['- Navigate/Next image tagged with tag',
		makeTagWalker('next')],
})


var Tags =
module.Tags = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'tags',
	depends: [
		'base',
	],

	actions: TagsActions,
})



//---------------------------------------------------------------------
// Crop...

var CropActions =
module.CropActions = actions.Actions({

	crop_stack: null,

	// load the crop stack if present...
	load: [function(data){
		// clear previous crop state...
		delete this.crop_stack

		if(data.crop_stack){
			this.crop_stack = data.crop_stack.map(function(j){
				return data.Data(j)
			})
		}
	}],
	clear: [function(){ 
		delete this.crop_stack }],

	// store the root crop state instead of the current view...
	//
	// modes supported:
	// 	- current	- store the current state/view
	// 	- base		- store the base state/view
	// 	- full		- store the crop stack
	//
	// XXX might need to revise the mode approach...
	// XXX add support to loading the states...
	json: [function(mode){
		mode = mode || 'current'

		return function(res){
			if(mode == 'base' 
					&& this.crop_stack 
					&& this.crop_stack.length > 0){
				res.data = this.crop_stack[0].dumpJSON()
			}
			if(mode == 'full' 
					&& this.crop_stack 
					&& this.crop_stack.length > 0){
				res.crop_stack = this.crop_stack.map(function(c){
					return c.dumpJSON()
				})
			}
		}
	}],

	// true if current viewer is cropped...
	get cropped(){
		return this.crop_stack != null },

	// crop...
	//
	// XXX check undo... do we actually need it???
	crop: ['Crop/Crop',
		{undo: 'uncrop'},
		function(list, flatten){ 
			list = list || this.data.getImages()

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
	uncrop: ['Crop/Uncrop',
		{browseMode: function(){ 
			return (this.crop_stack && this.crop_stack.length > 0) || 'disabled' }},
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
		{browseMode: function(){ 
			return (this.crop_stack && this.crop_stack.length > 0) || 'disabled' }},
		function(restore_current){ this.uncrop('all', restore_current) }],
	// XXX see if we need to do this on this level??
	// 		...might be a good idea to do this in data...
	uncropAndKeepOrder: ['Crop|Edit/Uncrop and keep crop image order', {
		journal: true,
		browseMode: function(){ 
			return (this.crop_stack && this.crop_stack.length > 0) || 'disabled' }},
		function(level, restore_current){ this.uncrop(level, restore_current, true) }],
	// XXX same as uncrop but will also try and merge changes...
	// 		- the order is simple and already done above...
	// 		- I think that levels should be relative to images, the 
	// 		  only problem here is how to deal with new ribbons...
	mergeCrop: ['- Crop|Edit/Merge crop', {
		journal: true,
		browseMode: function(){ 
			return (this.crop_stack && this.crop_stack.length > 0) || 'disabled' }},
		function(){
			// XXX
		}],

	// XXX save a crop (catalog)...
	// XXX
	
	// XXX not sure if we actually need this...
	cropFlatten: ['Crop/Flatten',
		function(list){ this.data.length > 0 && this.crop(list, true) }],
	cropRibbon: ['Crop/Crop current ribbon',
		function(ribbon, flatten){
			if(this.data.length == 0){
				return
			}
			if(typeof(ribbon) == typeof(true)){
				flatten = ribbon
				ribbon = null
			}
			ribbon = ribbon || 'current'
			this.crop(this.data.getImages(ribbon), flatten)
		}],
	cropRibbonAndAbove: ['Crop/Crop out ribbons bellow',
		function(ribbon, flatten){
			if(this.data.length == 0){
				return
			}
			if(typeof(ribbon) == typeof(true)){
				flatten = ribbon
				ribbon = null
			}
			ribbon = ribbon || this.data.getRibbon()

			var data = this.data
			if(data == null){
				return
			}

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
			if(this.data.length == 0){
				return
			}
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'
			this.crop(this.data[selector](tags), flatten)
		}],
})


var Crop =
module.Crop = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'crop',
	depends: [
		'base',
	],

	actions: CropActions,
})



//---------------------------------------------------------------------
// Image Group...

var ImageGroupActions =
module.ImageGroupActions = actions.Actions({
	// grouping...
	// XXX need to tell .images about this...
	group: ['- Group|Edit/Group images', 
		{journal: true},
		function(gids, group){ this.data.group(gids, group) }],
	ungroup: ['Group|Edit/Ungroup images', 
		{journal: true},
		{browseMode: function(){
			return this.data.getGroup() == null && 'disabled' }},
		function(gids, group){ this.data.ungroup(gids, group) }],

	// direction can be:
	// 	'next'
	// 	'prev'
	groupTo: ['- Group|Edit/Group to', 
		{journal: true},
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
		{journal: true},
		function(target){ this.groupTo(target, 'prev') }],
	groupForward: ['Group|Edit/Group target image with the image or group after it', 
		{journal: true},
		function(target){ this.groupTo(target, 'next') }],

	// NOTE: this will only group loaded images...
	groupMarked: ['Group|Mark/Group loaded marked images', 
		{journal: true},
		function(){ this.group(this.data.getImages(this.data.getTaggedByAny('marked'))) }],

	expandGroup: ['Group/Expand group', 
		{browseMode: function(){
			return this.data.getGroup() == null && 'disabled' }},
		function(target){ this.data.expandGroup(target || this.current) }],
	collapseGroup: ['Group/Collapse group', {
		journal: true,
		browseMode: function(){
			return this.data.getGroup() == null && 'disabled' }},
		function(target){ this.data.collapseGroup(target || this.current) }],

	cropGroup: ['Crop|Group/Crop group', {
		journal: true,
		browseMode: function(){
			return this.data.getGroup() == null && 'disabled' }},
		function(target){ this.crop(this.data.cropGroup(target || this.current)) }],
})


var ImageGroup =
module.ImageGroup = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'image-group',
	depends: [
		'base',
	],

	actions: ImageGroupActions,
})



//---------------------------------------------------------------------
// Meta base features...

// full features base...
core.ImageGridFeatures.Feature('base-full', [
	'introspection',
	'base',
	'tags',
	'sort',
	'crop',
	'image-group',
	'tasks',
])



//---------------------------------------------------------------------
// Journal...

/*
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


// Format:
// 	{
// 		<action>: <undo-action> | <undo-function> | null,
// 		...
// 	}
//
// XXX automate this:
// 		- on start -> get all actions with .journal or .undo
var journalActions = {
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

	runJournal: null,
}
//*/


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
module.Journal = core.ImageGridFeatures.Feature({
	title: 'Action Journal',

	tag: 'system-journal',

	depends: [
		'base'
	],

	actions: actions.Actions({

		journal: null,
		rjournal: null,

		journalable: null,

		updateJournalableActions: ['System/Update list of journalable actions',
			function(){
				var that = this

				var handler = function(action){
					return function(){
						var cur = this.current
						var args = args2array(arguments)

						return function(){
							this.journalPush({
								type: 'basic',

								action: action, 
								args: args,
								// the current image before the action...
								current: cur, 
								// the target (current) image after action...
								target: this.current, 
							})
						}
					}
				}

				this.journalable = this.actions
					.filter(function(action){
						return !!that.getAttr(action, 'undo') 
							|| !!that.getAttr(action, 'journal') 
					})
					// reset the handler
					.map(function(action){
						that
							.off(action+'.pre', 'journal-handler')
							.on(action+'.pre', 'journal-handler', handler(action))
						return action
					})
			}],

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
		journalPush: ['- System/Journal/Add an item to journal',
			function(data){
				this.journal = (this.hasOwnProperty('journal') 
						|| this.journal) ? 
					this.journal || []
					: []
				this.journal.push(data)
			}],
		clearJournal: ['System/Journal/Clear the action journal',
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
		runJournal: ['- System/Journal/Run journal',
			//{journal: true},
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
		undoLast: ['Edit/Undo last',
			{browseMode: function(){ 
				return (this.journal && this.journal.length > 0) || 'disabled' }},
			function(){
				var journal = this.journal
				this.rjournal = (this.hasOwnProperty('rjournal') 
						|| this.rjournal) ? 
					this.rjournal 
					: []

				for(var i = journal.length-1; i >= 0; i--){
					var a = journal[i]

					// see if the actions has an explicit undo attr...
					var undo = this.getAttr(a.action, 'undo')

					// general undo...
					if(undo){
						this.focusImage(a.current)

						var undo = undo instanceof Function ?
								// pass the action name...
								undo.call(this, a)
							: typeof(undo) == typeof('str') ? 
								// pass journal structure as-is...
								this[undo].apply(this, a)
							: null

						// pop the undo command...
						this.journal.pop()
						this.rjournal.push(journal.splice(i, 1)[0])
						break

					/*/ we undo only a very specific set of actions...
					// XXX move this to an undo action handler... 
					} else if(a.undo && a.type == 'shift' && a.args.length == 0){
						this
							.focusImage(a.current)
							[a.undo](a.target)

						// pop the undo command...
						this.journal.pop()
						this.rjournal.push(journal.splice(i, 1)[0])
						break
						//*/
					}
				}
			}],
		redoLast: ['Edit/Redo last',
			{browseMode: function(){ 
				return (this.rjournal && this.rjournal.length > 0) || 'disabled' }},
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
		['start',
			function(){ this.updateJournalableActions() }],

		/*
		logImageShift('shiftImageTo'),
		logImageShift('shiftImageUp'),
		logImageShift('shiftImageDown'),
		logImageShift('shiftImageLeft'),
		logImageShift('shiftImageRight'),
		logImageShift('shiftRibbonUp'),
		logImageShift('shiftRibbonDown'),
		*/

	// basic operations...
	]/*.concat([
			// XXX legacy???
		].map(function(action){
			return [
				action+'.pre', 
				function(){
					var cur = this.current
					var args = args2array(arguments)

					return function(){
						this.journalPush({
							type: 'basic',

							current: cur, 
							target: this.current, 
							action: action, 
							args: args,

							undo: journalActions[action],
						})
					}
				}]
		})),//*/ 
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
