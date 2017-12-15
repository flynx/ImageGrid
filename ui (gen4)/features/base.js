/**********************************************************************
* 
* Base features...
*
* Features:
* 	- base
* 		map to data and images
* 	- crop
* 	- tags
* 	- groups
* 		XXX experimental...
*
* Meta Features:
* 	- base-full
* 		combines the above features into one
*
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

// Generate an undo function for shift operations...
//
// NOTE: {undo: 'shiftImageDown'}, will not do here because we need to 
// 		pass an argument to the shift action, as without an argument 
// 		these actions will shift focus to a different image in the same 
// 		ribbon...
// 			.shiftImageDown(x)
// 				shift image x without changing focus, i.e. the focused
// 				image before the action will stay focused after.
// 			.focusImage(x).shiftImageDown()
// 				focus image x, then shift it down (current image default)
// 				this will shift focus to .direction of current image.
var undoShift = function(undo){
	return function(a){ 
		this[undo](a.args.length == 0 ? a.current : a.args[0]) }}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

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
		return this.config.version },

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

	get length(){
		return this.data.length },
	
	// Base ribbon...
	get base(){
		return this.data.base },
	set base(value){
		this.setBaseRibbon(value) },

	// Current image...
	get current(){
		return this.data.current },
	set current(value){
		this.focusImage(value) },

	// Current ribbon...
	get current_ribbon(){
		return this.data.getRibbon() },
	set current_ribbon(value){
		this.focusRibbon(value) },

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
			// NOTE: this stabilizes the .direction, preventing repeating
			// 		the last explicitly set value over and over again...
			this._direction_last = this.direction

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


	// Consistency checking...
	//
	imageNameConflicts: ['- File/',
		core.doc`Get images with conflicting names...

			Check current index for name conflicts...
			.imageNameConflicts()
				-> conflicts
				-> false

		Format:
			{
				// gid name matches...
				conflicts: {
					// NOTE: each list contains all the matches including 
					// 		the conflicts key it was accessed via.
					gid: [gid, gid, ...],
					...
				},

				// maximum number of name repetitions...
				max_repetitions: number,
			}

		If there are no conflicts this will return false.
		`,
		function(){
			// build name index...
			var conflicts = {}
			var max = 0
			var names = {}
			//var gids = []
			this.images
				.forEach(function(gid, data){
					var name = data.name || gid
					var gids

					var n = names[name] = names[name] || []
					n.push(gid)

					// build the conflict set...
					if(n.length > 1){
						conflicts[gid] = n
						n.forEach(function(g){ conflicts[g] = n })
						max = Math.max(max, n.length)
					}
				})


			// list only the conflicting gids...
			//return gids.length > 0 ? 
			return Object.keys(conflicts).length > 0 ? 
				{
					conflicts: conflicts,
					max_repetitions: max,
				}
				: false
		}],


	// Settings...
	//
	toggleRibbonFocusMode : ['Interface/Ribbon focus mode',
		core.makeConfigToggler('ribbon-focus-mode', 
			function(){ return this.config['ribbon-focus-modes'] })],


	// basic life-cycle actions...
	//
	// XXX do we need to call .syncTags(..) here???
	load: ['- File|Interface/',
		core.doc`Load state...
		
		Loading is done in two stages:
			- A cleanup stage (pre)
				In most cases nothing is needed on this stage because 
				the base .load(..) will call .clear()
			- the load stage (post)
				This is where all the loading should be handled in most 
				situations.
		`,
		{journal: true},
		function(d){
			return function(){
				if(d.images){
					this.images = d.images instanceof images.Images ? 
						d.images 
						: images.Images(d.images)
				}
				if(d.data){
					this.data = d.data instanceof data.Data ? 
						d.data 
						: data.Data(d.data)
				}
			}
		}],
	// XXX should this clear or load empty???
	// XXX should this accept args and clear specific stuff (a-la data.clear(..))???
	clear: ['File/Clear',
		{journal: true},
		function(){
			//this.data = null
			//this.images = null
			this.data = new data.DataWithTags()
			this.images = new images.Images() 
		}],

	// NOTE: for complete isolation it is best to completely copy the 
	// 		.config...
	clone: ['- File/',
		function(full){ return function(res){
			if(this.data){
				res.data = this.data.clone()
			} 
			if(this.images){
				res.images = this.images.clone()
			}
		} }],

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

	json: ['- File/Dump state as JSON object',
		core.doc`Dump state as JSON object

			Dump current state...
			.json()
			.json('current')
				-> json

			Dump base state...
			.json('base')
				-> json

			Dump full state...
			.json('full')
				-> json

		The modes are defined here very broadly by design:
			current		- the current view only
			base		- the base state, all data needed to restore after
							a reload. This does not have to preserve 
							volatile/temporary context.
			full		- full state, all the data to reload the full 
							current view without losing any context

		The base action ignores the modes but extending actions may/should
		interpret them as needed.. 
		(see: .getHandlerDocStr('json') for details)

		Extending features may define additional modes.


		This will collect JSON data from every available attribute supporting
		the .dumpJSON() method.
		Attributes starting with '__' will be ignored.

		`,
		function(mode){
			return function(res){
				for(var k in this){
					if(!k.startsWith('__') 
							&& this[k] != null 
							&& this[k].dumpJSON != null){
						res[k] = this[k].dumpJSON()
					}
				}
			}
		}],

	getImagePath: ['- System/',
		function(gid, type){
			gid = this.data.getImage(gid)

			var img = this.images[gid]

			return img == null ?
				null
				: this.images.getImagePath(gid, this.location.path)
		}],
	replaceGID: ['- System/Replace image gid',
		{journal: true},
		function(from, to){
			from = this.data.getImage(from)

			// data...
			var res = this.data.replaceGID(from, to)

			if(res == null){
				return
			}

			// images...
			this.images && this.images.replaceGID(from, to)
		}],


	// basic navigation...
	//
	focusImage: ['- Navigate/Focus image',
		core.doc`Focus image...

			Focus current image...
			.focusImage()
			.focusImage('current')

			Focus next/prev image in current ribbon...
			.focusImage('next')
			.focusImage('prev')

			Focus next/prev image globally...
			.focusImage('next', 'global')
			.focusImage('prev', 'global')

			Focus image...
			.focusImage(<image>)

			Focus image at <order> in current ribbon...
			.focusImage(<image>, 'ribbon')

			Focus image at <order> in specific ribbon...
			.focusImage(<image>, <ribbon>)

			Focus image globally...
			.focusImage(<image>, 'global')

			Focus image from list...
			NOTE: this takes account of list order.
			.focusImage(<image>, [ <gid>, .. ])


		In the above, <image> can be:
			<gid>		- explicit image gid
			<order>		- image order.
			'next'		- next image relative to current
			'prev'		- previous image relative to current

		<ribbon> can be ribbon gid.

		Order can be positive, zero based and counted from the left, or
		negative, -1-based and counted from the right, e.g. 0 is the 
		first image and -1 is the last.

		If given image is not present in the requested context (ribbon,
		global), this will focus on the closest image that is loaded.

			Examples:
				// focus second to last image...
				.focusImage(-2)

				// focus first image globally...
				.focusImage(0, 'global')

				// focus next image...
				.focusImage('next')

				// focus next image globally, i.e. we can jump to other
				// ribbons...
				.focusImage('next', 'global')


		NOTE: this is a simplified version of the doc, for more details see:
			.data.focusImage(..) and .data.getImage(), also note that this 
			has a slightly different signature to the above, this is done
			for simplicity...
		`,
		function(img, list){ this.data.focusImage.apply(this.data, arguments) }],
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
	// shorthands...
	// XXX do we reset direction on these???
	firstImage: ['Navigate/First image in current ribbon',
		core.doc`Focus first image
			
			Focus first image in current ribbon...
			.firstImage()
				
			Focus first image globally...
			.firstImage(true)
			.firstImage('global')

		Shorthand for:
			.focusImage(0)
			.focusImage(0, 'global')
		`,
		{browseMode: function(target){ 
			return this.data.getImageOrder('ribbon', target) == 0 && 'disabled' }},
		function(all){ this.focusImage(0, all == null ? 'ribbon' : 'global') }],
	lastImage: ['Navigate/Last image in current ribbon',
		core.doc`Focus last image...

		Shorthand for:
			.focusImage(-1)
			.focusImage(-1, 'global')

		NOTE: this is symmetrical to .firstImage(..) see docs for that.
		`,
		{browseMode: function(target){ 
			return this.data.getImageOrder('ribbon', target) 
				== this.data.getImageOrder('ribbon', -1) && 'disabled' }},
		function(all){ this.focusImage(-1, all == null ? 'ribbon' : 'global') }],
	// XXX these break if image at first/last position are not loaded (crop, group, ...)
	// XXX do we actually need these???
	firstGlobalImage: ['Navigate/First image globally',
		core.doc`Get first image globally...

		Shorthand for:
			.firstImage('global')
		`,
		{browseMode: function(){ 
			return this.data.getImageOrder() == 0 && 'disabled' }},
		function(){ this.firstImage(true) }],
	lastGlobalImage: ['Navigate/Last image globally',
		core.doc`Get last image globally...

		Shorthand for:
			.lastImage('global')

		NOTE: this symmetrical to .firstGlobalImage(..) see docs for that.
		`,
		{browseMode: function(){ 
			return this.data.getImageOrder() == this.data.getImageOrder(-1) && 'disabled' }},
		function(){ this.lastImage(true) }],

	// XXX skip unloaded images... (groups?)
	// XXX the next two are almost identical...
	prevImage: ['Navigate/Previous image',
		core.doc`Focus previous image

		NOTE: this also modifies .direction
		NOTE: this is .symmetrical to .nextImage(..) see it for docs.
		`,
		{browseMode: 'firstImage'},
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
		core.doc`Focus next image...

			Focus next image...
			.nextImage()

			Focus image at <offset> to the right...
			.nextImage(<offset>)

			Focus next image in <ribbon>...
			.nextImage(<ribbon>)

			Focus next image globally...
			.nextImage('global')

		NOTE: this also modifies .direction
		`,
		{browseMode: 'lastImage'},
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
		{browseMode: function(target){ 
			return this.data.getRibbonOrder(target) == 0 && 'disabled'}},
		function(){ this.focusRibbon('first') }],
	lastRibbon: ['Navigate/Last ribbon',
		{browseMode: function(target){ 
			return this.data.getRibbonOrder(target) 
				== this.data.getRibbonOrder(-1) && 'disabled'}},
		function(){ this.focusRibbon('last') }],
	prevRibbon: ['Navigate/Previous ribbon',
		{browseMode: 'firstRibbon'}, 
		function(){ this.focusRibbon('before') }],
	nextRibbon: ['Navigate/Next ribbon',
		{browseMode: 'lastRibbon'},
		function(){ this.focusRibbon('after') }],
})


var Base =
module.Base = 
core.ImageGridFeatures.Feature({
	title: 'ImageGrid base',

	tag: 'base',
	depends: [
		'serialization',
	],
	suggested: [
		'edit',
		//'tags',
		//'sort',
		//'tasks',
	],

	actions: BaseActions,

	handlers: [
		// XXX handle 'full'???
		['prepareIndexForWrite', 
			function(res){
				// we save .current unconditionally (if it exists)...
				if(res.raw.data){
					res.index.current = res.raw.data.current
				}

				var changes = res.changes

				if(!changes){
					return
				}

				// data...
				if((changes === true || changes.data) && res.raw.data){
					res.index.data = res.raw.data
				}

				// images (full)...
				if(res.raw.images 
						&& (changes === true || changes.images === true)){
					res.index.images = res.raw.images

				// images-diff...
				} else if(changes && changes.images){
					var diff = res.index['images-diff'] = {}
					changes.images.forEach(function(gid){
						diff[gid] = res.raw.images[gid]
					})
				}
			}],
		['prepareJSONForLoad',
			function(res, json, base_path){
				// build data and images...
				// XXX do we actually need to build stuff here, shouldn't
				// 		.load(..) take care of this???
				//var d = json.data
				var d = data.Data.fromJSON(json.data)

				d.current = json.current || d.current

				var img = images.Images(json.images)

				// this is needed for loading multiple indexes...
				if(base_path){
					d.base_path = base_path
					// XXX STUB remove ASAP... 
					// 		...need a real way to handle base dir, possible
					// 		approaches:
					// 			1) .base_path attr in image, set on load and 
					// 				do not save (or ignore on load)...
					// 				if exists prepend to all paths...
					// 				- more to do in view-time
					// 				+ more flexible
					// 			2) add/remove on load/save (approach below)
					// 				+ less to do in real time
					// 				- more processing on load/save
					//console.warn('STUB: setting image .base_path in .prepareJSONForLoad(..)')
					img.forEach(function(_, img){ img.base_path = base_path })
				}

				res.data = d
				res.images = img
			}],
	],
})



//---------------------------------------------------------------------
// Edit...

var BaseEditActions = 
module.BaseEditActions = 
actions.Actions({
	config: {
	},

	// basic ribbon editing...
	//
	// NOTE: for all of these, current/ribbon image is a default...

	// XXX add undo...
	setBaseRibbon: ['Edit|Ribbon/Set base ribbon', {
		journal: true,
		browseMode: function(target){ 
			return this.current_ribbon == this.base && 'disabled' }},
		function(target){ this.data.setBase(target) }],

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
	// XXX do we need a vertical shift event??
	shiftImage: ['- Interface/Image shift (do not use directly)',
		core.notUserCallable(function(gid){
			// This is the image shift protocol root function
			//
			// Not for direct use.
		})],
	shiftImageOrder: ['- Interface/Image horizontal shift (do not use directly)',
		core.notUserCallable(function(gid){
			// This is the image shift protocol root function
			//
			// Not for direct use.
		})],

	// XXX to be used for things like mark/place and dragging...
	// XXX revise...
	// XXX undo...
	shiftImageTo: ['- Edit|Sort|Image/',
		{undo: function(a){ this.shiftImageTo(a.args[1], a.args[0]) }},
		function(target, to, mode){ this.data.shiftImage(target, to, mode) }],
	
	shiftImageUp: ['Edit|Image/Shift image up',
		core.doc`Shift image up...

		NOTE: If implicitly shifting current image (i.e. no arguments), focus
			will shift to the next or previous image in the current
			ribbon depending on current direction.
		`,
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
				this.config['shifts-affect-direction'] == 'on' 
					&& (this.direction = '!')

			// if a specific target is given, just shift it...
			} else {
				this.data.shiftImageUp(target)
			}
		}],
	shiftImageDown: ['Edit|Image/Shift image down',
		core.doc`Shift image down...

		NOTE: If implicitly shifting current image (i.e. no arguments), focus
			will shift to the next or previous image in the current
			ribbon depending on current direction.
		`,
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
	// NOTE: we do not need undo here because it will be handled by 
	// 		corresponding normal shift operations...
	// XXX .undoLast(..) on these for some reason skips...
	// 		...e.g. two shifts are undone with three calls to .undoLast()...
	shiftImageUpNewRibbon: ['Edit|Image/Shift image up to a new empty ribbon',
		{journal: true},
		function(target){
			this.data.newRibbon(target)
			this.shiftImageUp(target)
		}],
	shiftImageDownNewRibbon: ['Edit|Image/Shift image down to a new empty ribbon',
		{journal: true},
		function(target){
			this.data.newRibbon(target, 'below')
			this.shiftImageDown(target)
		}],
	shiftImageLeft: ['Edit|Sort|Image/Shift image left', {
		undo: undoShift('shiftImageRight'),
		browseMode: 'prevImage'}, 
		function(target){ 
			if(target == null){
				this.direction = 'left'
			}
			this.data.shiftImageLeft(target) 
			this.focusImage()
		}],
	shiftImageRight: ['Edit|Sort|Image/Shift image right', {
		undo: undoShift('shiftImageLeft'),
		browseMode: 'nextImage'}, 
		function(target){ 
			if(target == null){
				this.direction = 'right'
			}
			this.data.shiftImageRight(target) 
			this.focusImage()
		}],

	shiftRibbonUp: ['Ribbon|Edit|Sort/Shift ribbon up', {
		undo: undoShift('shiftRibbonDown'),
		browseMode: 'prevRibbon'}, 
		function(target){ 
			this.data.shiftRibbonUp(target) 
			// XXX is this the right way to go/???
			this.focusImage()
		}],
	shiftRibbonDown: ['Ribbon|Edit|Sort/Shift ribbon down', {
		undo: undoShift('shiftRibbonUp'),
		browseMode: 'nextRibbon'}, 
		function(target){ 
			this.data.shiftRibbonDown(target)
			// XXX is this the right way to go/???
			this.focusImage()
		}],

	// these operate on the current image...
	travelImageUp: ['Edit|Image/Travel with the current image up (Shift up and keep focus)',
		{undo: undoShift('travelImageDown')},
		function(target){
			target = target || this.current
			this.shiftImageUp(target)
			this.focusImage(target)
		}],
	travelImageDown: ['Edit|Image/Travel with the current image down (Shift down and keep focus)',
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

	// complex operations...
	// XXX need interactive mode for this...
	// 		- on init: select start/end/base
	// 		- allow user to reset/move
	// 		- on accept: run
	alignToRibbon: ['Ribbon|Edit/Align top ribbon to base',
		{journal: true},
		function(target, start, end){
			this.data = this.data.alignToRibbon(target, start, end) }],


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
	// XXX correct undo???
	rotate: ['- Image|Edit/Rotate image',
		{journal: true},
		function(target, direction){
			if(arguments.length == 0){
				return this.image && this.image.orientation || 0
			}
			if(target == 'cw' || target == 'ccw'){
				direction = target
				target = this.data.getImage()
			} else {
				target = this.data.getImages(target instanceof Array ? target : [target])
			}
			this.images 
				&& this.images.rotateImage(target, direction || 'cw')
		}],
	flip: ['- Image|Edit/Flip image',
		{journal: true},
		function(target, direction){
			if(target == 'vertical' || target == 'horizontal'){
				direction = target
				target = this.data.getImage()
			} else {
				target = this.data.getImages(target instanceof Array ? target : [target])
			}
			this.images 
				&& this.images.flipImage(target, direction || 'horizontal')
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
})

var BaseEdit =
module.BaseEdit = 
core.ImageGridFeatures.Feature({
	title: 'ImageGrid base editor',

	tag: 'edit',
	depends: [
		'base',
		'changes',
	],

	actions: BaseEditActions,

	handlers: [
		[[
			'shiftImageTo',
			'shiftImageUp',
			'shiftImageDown',
			'shiftImageLeft',
			'shiftImageRight',
		], 
			function(){ this.shiftImage.apply(this, [].slice(arguments, 1))}],
		// horizontal shifting...
		[[
			'shiftImageLeft',
			'shiftImageRight',
		], 
			function(){ this.shiftImageOrder.apply(this, [].slice(arguments, 1))}],
		['shiftImageTo.pre',
			function(a){
				var i = this.data.getImageOrder(a)
				return function(){
					// only trigger if order changed...
					i != this.data.getImageOrder(a)
						&& this.shiftImageOrder.apply(this, [].slice(arguments, 1)) } }],

		// manage changes...
		// everything changed...
		[[
			'claer',
			'loadURLs', 
		],
			function(){ this.markChanged('all') }],

		// data...
		[[
			//'load',

			'setBaseRibbon',

			// NOTE: this takes care of the shiftImage* actions...
			'shiftImage',

			'shiftRibbonUp',
			'shiftRibbonDown',

			'reverseImages',
			'reverseRibbons',

			'alignToRibbon',
		], 
			function(_, target){ this.markChanged('data') }],

		// image specific...
		[[
			'rotateCW',
			'rotateCCW',
			'flipHorizontal',
			'flipVertical',
		], 
			function(_, target){ this.markChanged('images', [this.data.getImage(target)]) }],
	],
})



//---------------------------------------------------------------------
// Tags...

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


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var TagsActions = 
module.TagsActions = actions.Actions({
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
	suggested: [
		'tags-edit',
	],

	actions: TagsActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var TagsEditActions = 
module.TagsEditActions = actions.Actions({
	// tags...
	//
	// XXX mark updated...
	tag: ['- Tag/Tag image(s)',
		{journal: true},
		function(tags, gids){
			gids = gids || this.current
			gids = gids instanceof Array ? gids : [gids]
			tags = tags instanceof Array ? tags : [tags]

			var that = this
			gids = gids.map(function(gid){ return that.data.getImage(gid) })

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
			gids = gids instanceof Array ? gids : [gids]
			tags = tags instanceof Array ? tags : [tags]

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

			var images = this.images

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
	
})

var TagsEdit =
module.TagsEdit = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'tags-edit',
	depends: [
		'tags',
		'edit',
	],

	actions: TagsEditActions,

	handlers: [
		// tags and images...
		// NOTE: tags are also stored in images...
		['tag untag',
			function(_, tags, gids){
				var that = this
				var changes = []

				gids = gids || [this.data.getImage()]
				gids = gids instanceof Array ? 
					gids
						.map(function(e){ return that.data.getImage(e) })
					: [this.data.getImage(gids)] 

				tags = tags || []
				tags = tags instanceof Array ? tags : [tags]

				// tags...
				if(tags.length > 0){
					this.markChanged('tags')

					tags.indexOf('selected') >= 0
						&& this.markChanged('selected')

					tags.indexOf('bookmark') >= 0
						&& this.markChanged('bookmarked')
				}

				this.markChanged('images', gids)
			}],

		// store .tags and .tags.selected / .tags.bookmark separately from .data...
		//
		// XXX see if this can be automated...
		['prepareIndexForWrite', 
			function(res){
				var changes = res.changes

				if(!changes || !res.raw.data){
					return
				}

				if((changes === true || changes.tags) && res.raw.data.tags){
					res.index.tags = res.raw.data.tags
				}

				if((changes === true || changes.selected) 
						&& res.raw.data.tags
						&& res.raw.data.tags.selected){
					res.index.marked = res.raw.data.tags.selected
				}
				if((changes === true || changes.bookmarked) 
						&& res.raw.data.tags
						&& res.raw.data.tags.bookmark){
					res.index.bookmarked = [
						res.raw.data.tags.bookmark || [],
						{},
					]
				}

				// cleanup...
				if(res.index.data && res.index.data.tags){
					delete res.index.data.tags.selected
					delete res.index.data.tags.bookmark
					//delete res.index.data.tags.bookmark_data
					delete res.index.data.tags
				}
			}],
		['prepareJSONForLoad',
			function(res, json){
				res.data.tags = json.tags || {}

				res.data.tags.selected = json.marked || []
				res.data.tags.bookmark = json.bookmarked ? json.bookmarked[0] : []
				//res.data.tags.bookmark_data = json.bookmarked ? json.bookmarked[1] : {}

				res.data.sortTags()
			}],
	],
})



//---------------------------------------------------------------------
// Image Group...

var ImageGroupActions =
module.ImageGroupActions = actions.Actions({
	expandGroup: ['Group/Expand group', 
		{browseMode: 'ungroup'}, 
		function(target){ this.data.expandGroup(target || this.current) }],
	collapseGroup: ['Group/Collapse group', {
		journal: true,
		browseMode: 'ungroup'}, 
		function(target){ this.data.collapseGroup(target || this.current) }],

	cropGroup: ['Crop|Group/Crop group', {
		journal: true,
		browseMode: 'ungroup'}, 
		function(target){ this.crop(this.data.cropGroup(target || this.current)) }],
})

var ImageGroup =
module.ImageGroup = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'image-group',
	depends: [
		'base',
	],
	suggested: [
		'image-group-edit',
	],

	actions: ImageGroupActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageEditGroupActions =
module.ImageEditGroupActions = actions.Actions({
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
	groupBack: ['Group|Edit/Group backwards', 
		{journal: true},
		function(target){ this.groupTo(target, 'prev') }],
	groupForward: ['Group|Edit/Group forwards', 
		{journal: true},
		function(target){ this.groupTo(target, 'next') }],

})

var ImageEditGroup =
module.ImageEditGroup = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'image-group-edit',
	depends: [
		'image-group',
		'edit',
	],
	suggested: [
	],

	actions: ImageEditGroupActions,

	handlers: [
		[[
			'group',
			'ungroup',
			'expandGroup',
			'collapseGroup',
		], 
			function(_, target){ this.markChanged('data') }],
	],
})



//---------------------------------------------------------------------
// Crop...

var CropActions =
module.CropActions = actions.Actions({

	crop_stack: null,

	// true if current viewer is cropped...
	get cropped(){
		return this.crop_stack 
			&& this.crop_stack.length > 0 },

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
			if(this.cropped){
				if(mode == 'base'){
					res.data = this.crop_stack[0].dumpJSON()

				} else if(mode == 'full'){
					res.crop_stack = this.crop_stack.map(function(c){
						return c
							.dumpJSON()
							.run(function(){
								delete this.tags })
					})
				}
			}
		}
	}],
	// load the crop stack if present...
	load: [function(state){
		return function(){
			var that = this

			if(!('crop_stack' in state)){
				return
			}

			// load...
			if(state.crop_stack){
				this.crop_stack = state.crop_stack
					.map(function(d){ 
						return d instanceof data.Data ? 
							d 
							: data.Data(d) })

				// merge the tags...
				this.crop_stack.forEach(function(d){ d.tags = that.data.tags })

			// remove...
			} else {
				delete this.crop_stack
			}
		}
	}],

	// crop...
	//
	// XXX check undo... do we actually need it???
	crop: ['Crop/Crop',
		core.doc`Crop current state and push it to the crop stack

		A crop is a copy of the data state. When a crop is made the old 
		state is pushed to the crop stack and a new state is set in it 
		its place.

		If true (flatten) is passed as the last argument the crop will 
		be flattened, i.e. ribbons will be merged.

		This is the base crop action/event, so this should be called by
		any action implementing a crop.
			
			Make a full crop...
			.crop()
			.crop(true)
				-> this

			Make a crop keeping only the list of images...
			.crop(images)
			.crop(images, true)
				-> this

			Make a crop and use the given data object...
			NOTE: data must be an instance of data.Data
			NOTE: this will overwrite data.tags with this.data.tags
			.crop(data)
				-> this

			Make a crop and use the given data object but keep data.tags...
			.crop(data, false)
				-> this


		NOTE: this is used as a basis for all the crop operations, so 
			there is no need to bind to anything but this to handle a 
			crop unless specific action is required for a specific crop
			operation.
		NOTE: this is an in-place operation, to make a crop in a new 
			instance use .clone().crop(..)
		`,
		{undo: 'uncrop'},
		function(list, flatten){ 
			list = list || this.data.getImages()

			this.crop_stack = this.crop_stack || []
			this.crop_stack.push(this.data)

			if(list instanceof data.Data){
				if(flatten === false){
					list.tags = this.data.tags
				}

				this.data = list

			} else {
				this.data = this.data.crop(list, flatten)
			}
		}],
	uncrop: ['Crop/Uncrop',
		{browseMode: function(){ return this.cropped || 'disabled' }},
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
		{browseMode: 'uncrop'},
		function(restore_current){ this.uncrop('all', restore_current) }],
	// XXX see if we need to do this on this level??
	// 		...might be a good idea to do this in data...
	uncropAndKeepOrder: ['Crop|Edit/Uncrop and keep crop image order', {
		journal: true,
		browseMode: 'uncrop'}, 
		function(level, restore_current){ this.uncrop(level, restore_current, true) }],
	// XXX same as uncrop but will also try and merge changes...
	// 		- the order is simple and already done above...
	// 		- I think that levels should be relative to images, the 
	// 		  only problem here is how to deal with new ribbons...
	mergeCrop: ['- Crop|Edit/Merge crop', {
		journal: true,
		browseMode: 'uncrop'}, 
		function(){
			// XXX
		}],

	// XXX save a crop (catalog)..
	// XXX
	
	// XXX not sure if we actually need this...
	cropFlatten: ['Crop/Flatten',
		{browseMode: function(){ 
			return this.data.ribbon_order.length <= 1 && 'disabled' }},
		function(list){ this.data.length > 0 && this.crop(list, true) }],
	cropRibbon: ['Crop|Ribbon/Crop $ribbon',
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
	cropOutRibbon: ['Crop|Ribbon/Crop ribbon out',
		function(ribbon, flatten){
			ribbon = ribbon || this.current_ribbon
			ribbon = ribbon instanceof Array ? ribbon : [ribbon]

			// build the crop...
			var crop = this.data.crop()

			// ribbon order...
			crop.ribbon_order = crop.ribbon_order
				.filter(function(r){ return ribbon.indexOf(r) })

			// ribbons...
			ribbon.forEach(function(r){ delete crop.ribbons[r] })

			// focus image...
			var cr = this.current_ribbon
			if(ribbon.indexOf(cr) >= 0){
				var i = this.data.getRibbonOrder(cr)
				var r = this.data.ribbon_order
					.slice(i+1)
					.concat(this.data.ribbon_order.slice(0, i))
					.filter(function(r){ return crop.ribbons[r] && crop.ribbons[r].len > 0 })
					.shift()
				crop.focusImage(
					crop.getImage(this.current, 'after', r)
						|| crop.getImage(this.current, 'before', r))
			}

			this.crop(crop, flatten)
		}],
	cropOutRibbonsBelow: ['Crop/Crop out ribbons $bellow',
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
	cropTagged: ['- Tag|Crop/Crop tagged images',
		function(tags, mode, flatten){
			if(this.data.length == 0){
				return
			}
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'
			this.crop(this.data[selector](tags), flatten)
		}],

	// crop edit actions...
	// XXX use this as undo for .removeFromCrop(..)
	// 		...after we remove images from a crop we lose their containing 
	// 		ribbon information and the order might get messed up by 
	// 		horizontal shifting if not undone correctly...
	// 		...add a way to store additional info in the journal...
	// XXX undo -- .removeFromCrop(..) but only the gids that were 
	// 		actually added... (???)
	addToCrop: ['- Crop/',
		core.doc`Add gids to current crop...

			Place images to their positions in order in current ribbon
			.addToCrop(images)
			.addToCrop(images, 'keep', 'keep')
				-> this

			Place images at order into ribbon...
			.addToCrop(images, ribbon, order)
				-> this

			As above but place images before/after order...
			.addToCrop(images, ribbon, order, 'before')
			.addToCrop(images, ribbon, order, 'after')
				-> this
			
			Place images at order but do not touch ribbon position... (horizontal)
			.addToCrop(images, 'keep', order)
				-> this

			As above but place images before/after order...
			.addToCrop(images, 'keep', order, 'before')
			.addToCrop(images, 'keep', order, 'after')
				-> this


			Place images to ribbon but do not touch order... (vertical)
			.addToCrop(images, ribbon, 'keep')
				-> this


		NOTE: this is signature-compatible with .data.placeImage(..) but
			different in that it does not require the images to be loaded
			in the current crop...
		NOTE: this can only add gids to current crop...
		`,
		function(gids, ribbon, reference, mode){
			if(!this.cropped){
				return
			}

			gids = gids instanceof Array ? gids : [gids]

			var r = this.data.ribbons[this.current_ribbon]
			var o = this.data.order

			// add gids to current ribbon...
			gids.forEach(function(gid){
				var i = o.indexOf(gid)
				if(i >= 0){
					r[i] = gid
				}
			})

			// place...
			;(ribbon || reference || mode)
				&& this.data.placeImage(gids, ribbon, reference, mode)
		}],
	// XXX undo -- need containing ribbon info per gid to undo correctly...
	removeFromCrop: ['Crop|Image/Remove from crop',
		core.doc`
		`,
		{
			browseMode: 'uncrop',
			// XXX group gid - ribbon
			//getUndoState: function(data){ },
			//undo: function(data){},
		},
		function(gids){
			var that = this
			if(!this.cropped){
				return
			}

			var data = this.data
			var current = this.current
			var focus = false

			gids = arguments.length > 1 ? [].slice.call(arguments) : gids
			gids = gids || 'current'
			gids = gids instanceof Array ? gids : [gids] 

			gids
				// clear ribbons...
				.filter(function(gid){ 
					if(gid in data.ribbons){
						delete data.ribbons[gid]
						data.ribbon_order.splice(data.ribbon_order.indexOf(gid), 1)
						focus = true

						return false
					}
					return true
				})
				// clear images...
				.forEach(function(gid){
					gid = data.getImage(gid)

					delete data.ribbons[data.getRibbon(gid)][data.order.indexOf(gid)]

					if(gid == current){
						focus = true
					}
				})

			// the above may result in empty ribbons -> cleanup...
			this.data.clear('empty')

			// restore correct focus...
			focus
				&& this.focusImage(
					data.getImage(this.direction == 'left' ? 'before' : 'after')
					|| data.getImage(this.direction == 'left' ? 'after' : 'before'))
		}],
	removeRibbonFromCrop:['Crop|Ribbon/Remove ribbon from crop',
		core.doc`
		
		NOTE: this is a shorthand for .removeFromCrop(..) but only supports
			ribbon removal.`,
		{browseMode: 'uncrop'},
		function(gids){ 
			var that = this
			gids = gids || this.current_ribbon
			gids = gids == 'current' ? this.current_ribbon : gids
			gids = gids instanceof Array ? 
				gids.filter(function(gid){ return that.data.ribbons[gid] }) 
				: [gids]
			return this.removeFromCrop(gids) 
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



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
