/**********************************************************************
* 
* All the base features...
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var data = require('data')
var images = require('images')

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


/*********************************************************************/

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
		core.makeConfigToggler('ribbon-focus-mode', 
			function(){ return this.config['ribbon-focus-modes'] })],


	// basic life-cycle actions...
	//
	// XXX do we need to call .syncTags(..) here???
	load: ['- File|Interface/',
		function(d){
			this.clear()

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
	loadURLs: ['- File/Load a URL list',
		function(lst, base){
			var imgs = images.Images.fromArray(lst, base)

			this.load({
				images: imgs,
				data: data.Data.fromArray(imgs.keys()),
			})
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
				if(this[k] != null && this[k].dumpJSON != null){
					res[k] = this[k].dumpJSON()
				}
			}
			return res
		}],

	replaceGid: ['- System/Replace image gid',
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
		function(img, list){
			this.data.focusImage(img, list) }],
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

	// basic image editing...
	//
	// XXX should we have .rotate(..) and .flip(..) generic actions???
	rotateCW: ['Image|Edit/', 
		function(target){ 
			this.images 
				&& this.images.rotateImage(this.data.getImage(target), 'cw') }],
	rotateCCW: ['Image|Edit/', 
		function(target){ 
			this.images 
				&& this.images.rotateImage(this.data.getImage(target), 'ccw') }],
	flipVertical: ['Image|Edit/',
		function(target){ 
			this.images 
				&& this.images.flipImage(this.data.getImage(target), 'vertical') }],
	flipHorizontal: ['Image|Edit/',
		function(target){ 
			this.images
				&& this.images.flipImage(this.data.getImage(target), 'horizontal') }],
})


var Base =
module.Base = core.ImageGridFeatures.Feature({
	title: 'ImageGrid base',

	tag: 'base',
	/* XXX ???
	suggested: [
		'tags',
		'sort',
	],
	*/

	actions: BaseActions,
})



//---------------------------------------------------------------------
// Sort...

var SortActions = 
module.SortActions = actions.Actions({
	config: {
		// this can be:
		// 	- sort mode name		- as set in .config['sort-mode'] key
		// 								Example: 'Date'
		// 	- explicit sort method	- as set in .config['sort-mode'] value
		// 								Example: 'metadata.createDate birthtime'
		'default-sort': 'Date',
		
		// Format:
		// 	The value is a space separated string of methods.
		// 	A method is either a sort method defined in .__sort_methods__
		// 	or a dot-separated image attribute path.
		//
		// NOTE: 'Date' is descending by default
		// NOTE: .toggleImageSort('?') may also show 'Manual' when 
		// 		.data.manual_order is present.
		// NOTE: 'Manual' mode is set after .shiftImageLeft(..)/.shiftImageRight(..)
		// 		are called or when restoring a pre-existing .data.manual_order 
		// 		via .toggleImageSort('Manual')
		//
		// XXX need a natural way to reverse these...
		'sort-methods': {
			'none': '',
			// NOTE: this is descending by default...
			'Date': 'metadata.createDate birthtime reverse',
			'Name (XP-style)': 'name-leading-sequence name path',
			'File sequence number': 'name-leading-sequence name path',
			'Name': 'name path',
			// XXX sequence number with overflow...
			//'File sequence number with overflow': 'name-leading-sequence name path',
		},
	},

	// Custom sort methods...
	//
	// Format:
	// 	{
	// 		<method-name>: function(a, b){ ... },
	// 		...
	// 	}
	//
	// NOTE: the cmp function is called in the actions context.
	__sort_methods__: {
		'name-leading-sequence': function(a, b){
			a = this.images.getImageNameLeadingSeq(a)
			a = typeof(a) == typeof('str') ? 0 : a
			b = this.images.getImageNameLeadingSeq(b)
			b = typeof(b) == typeof('str') ? 0 : b

			return a - b
		},
		'name-sequence': function(a, b){
			a = this.images.getImageNameSeq(a)
			a = typeof(a) == typeof('str') ? 0 : a
			b = this.images.getImageNameSeq(b)
			b = typeof(b) == typeof('str') ? 0 : b

			return a - b
		},
	},
	//	Sort using the default sort method
	//	.sortImages()
	//		NOTE: the actual sort method used is set via 
	//			.config['default-sort']
	//
	//	Sort using a specific method(s):
	//	.sortImages(<method>)
	//	.sortImages([<method>, ..])
	//		NOTE: <method> can either be one of:
	//			1) method name (key) from .config['sort-methods']
	//			2) a space separated string of methods or attribute paths
	//				as in .config['sort-methods']'s values.
	//			for more info se doc for: .config['sort-methods']
	//
	//	Update current sort order:
	//	.sortImages('update')
	//		NOTE: unless the sort order (.data.order) is changed manually
	//			this will have no effect.
	//		NOTE: this is designed to facilitate manual sorting of 
	//			.data.order
	//
	//
	// NOTE: reverse is calculated by oddity -- if an odd number indicated
	// 		then the result is reversed, otherwise it is not. 
	// 		e.g. adding:
	// 		 	'metadata.createDate birthtime' + ' reverse' 
	// 		will reverse the result's order while:
	// 		 	'metadata.createDate birthtime reverse' + ' reverese' 
	// 		will cancel reversal.
	//
	// XXX this also requires images...
	// XXX cache order???
	sortImages: ['- Edit|Sort/Sort images',
		function(method, reverse){ 
			var that = this

			if(method == 'reverse'){
				method = null
				reverse = true
			}

			reverse = reverse == null ? false 
				: reverse == 'reverse' 
				|| reverse

			method = method == 'update' ? [] : method
			method = method 
				|| this.config['sort-methods'][this.config['default-sort']]
				|| this.config['default-sort'] 
				|| 'birthtime'
			method = this.config['sort-methods'][method] || method
			// handle multiple methods....
			method = typeof(method) == typeof('str') ? method.split(/ +/g) : method
			method = method instanceof Array ? method : [method]

			// get the reverse...
			var i = method.indexOf('reverse')
			while(i >=0){
				reverse = !reverse
				method.splice(i, 1)

				i = method.indexOf('reverse')
			}

			// build the compare routine...
			method = method.map(function(m){
				return SortActions.__sort_methods__[m] 
					|| (that.__sort_methods__ && that.__sort_methods__[m])
					// sort by attr path...
					|| (function(){
						var p = m.split(/\./g)
						var _get = function(obj){
							for(var i=0; i<p.length; i++){
								obj = obj[p[i]]
								if(obj === undefined){
									return null
								}
							}
							return obj
						}
						return function(a, b){
							a = _get(this.images[a])
							b = _get(this.images[b])

							if(a == b){
								return 0
							} else if(a < b){
								return -1
							} else {
								return +1
							}
						}})() 
			})

			// prepare the cmp function...
			var cmp = method.length == 1 ? 
				method[0] 
				// chain compare -- return first non equal (0) result...
				: function(a, b){
					var res = 0
					for(var i=0; i < method.length; i++){
						res = method[i].call(that, a, b)
						if(res != 0){
							return res
						}
					}
					return res
				}

			// do the sort (in place)...
			if(method && method.length > 0 && this.images){
				this.data.order = this.data.order.slice()
				reverse ? 
					this.data.order.sort(cmp.bind(this)).reverse()
					: this.data.order.sort(cmp.bind(this))
			}

			this.data.updateImagePositions()
		}],

	// XXX should this be a dialog with ability to edit modes???
	// 		- toggle reverse sort
	// XXX currently this will not toggle past 'none'
	toggleImageSort: ['Edit|Sort/Sort images by',
		toggler.Toggler(null,
			function(){ return this.data.sort_method || 'none' },
			function(){ 
				return Object.keys(this.config['sort-methods'])
					.concat(this.data.manual_order ? ['Manual'] : [])},
			// prevent setting 'none' as mode...
			function(mode){ 
				return mode != 'none' 
					|| (mode == 'Manual' && this.data.manual_order) },
			function(mode){ 
				// save manual order...
				if(this.data.sort_method == 'Manual'){
					this.data.manual_order = this.data.order.slice()
				}

				// special case: manual order...
				// XXX this does not use .sortImages(..) thus this does not update...
				if(mode == 'Manual'){
					this.data.order = this.data.manual_order.slice()
					this.sortImages('update')

				} else {
					this.sortImages(this.config['sort-methods'][mode]) 
				}

				this.data.sort_method = mode
			})],

	// Store/load sort data:
	// 	.data.sort_method	- current sort mode (optional)
	// 	.manual_order		- manual sort order (optional)
	load: [function(data){
		return function(){
			if(data.data && data.data.sort_method){
				this.data.sort_method = data.data.sort_method
			}

			if(data.data && data.data.manual_order){
				this.data.manual_order = data.data.manual_order
			}
		}
	}],
	json: [function(){
		return function(res){
			if(this.data.sort_method){
				res.data.sort_method = this.data.sort_method
			}

			if(this.data.manual_order){
				res.data.manual_order = this.data.manual_order

			} else if(this.toggleImageSort('?') == 'Manual'){
				res.data.manual_order = this.data.order
			}
		}
	}],
})

var Sort =
module.Sort = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'sort',
	depends: [
		'base',
	],

	actions: SortActions,

	handlers: [
		['shiftImageRight shiftImageLeft',
			function(){
				this.data.sort_method = 'Manual'
			}],
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
		if(data.crop_stack){
			this.crop_stack = data.crop_stack.map(function(j){
				return data.Data(j)
			})
		}
	}],
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
		return this.crop_stack != null
	},

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
	'base',
	'tags',
	'sort',
	'crop',
	'image-group',
])



//---------------------------------------------------------------------
// Journal...

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


// Format:
// 	{
// 		<action>: <undo-action> | <undo-function> | null,
// 		...
// 	}
var journalActions = {
	clear: null,
	load: null,

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




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
