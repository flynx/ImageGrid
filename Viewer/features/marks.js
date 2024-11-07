/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var data = require('imagegrid/data')
var images = require('imagegrid/images')

var core = require('features/core')
var base = require('features/base')
var ui = require('features/ui')



/*********************************************************************/

// XXX should we rename this to "select"???

// target can be:
// 		'all'
// 		'loaded'
// 		'ribbon'	- current ribbon
// 		ribbon		- specific ribbon (gid)
// 		Array
// 		attr
// 		!attr
//
// NOTE: of no data is defined this will not have any effect...
// NOTE: we are not using the vanilla toggler here as it can't handle 
// 		toggling independently multiple elements...
// 
// XXX this is really slow on large sets of images...
function makeTagTogglerAction(tag){
	// get actual target gids...
	var _getTarget = function(target){
		target = target 
			|| this.current
		target = (target == 'all' 
					|| target == 'loaded' 
					|| target in this.data.ribbons) ? 
				this.data.getImages(target)
			: target == 'ribbon' ? 
				this.data.getImages('current')
			: target
		return target == null ?
				[]	
			: target instanceof Array ? 
				target 
			: [target] }

	// the toggler...
	var _tagToggler = toggler.Toggler('current',
		function(target, action){
			target = _getTarget.call(this, target)
			// get state...
			if(action == null){
				var res = this.data.toggleTag(tag, target, '?')
				return res.length == 1 ? res[0] : res
			} else if(action == 'on'){
				this.tag(tag, target)
			} else if(action == 'off'){
				this.untag(tag, target) } }, 
		['off', 'on'])

	// the action...
	var action = function(target, action){
		// gid list attr...
		if(target in this){
			target = this[target]
			target = target instanceof Array ?
				target
				: [target] }
		// reverse gid list attr...
		if(typeof(target) == typeof('str') 
				&& target[0] == '!'){
			target = target.slice(1)
			target = target in this ?
				this[target]
				: target
			target = target instanceof Array ?
				target
				: [target]
			var skip = new Set(target)
			target = this.data.order
				.filter(function(gid){
					return !skip.has(gid) }) }

		// special case: no data...
		if(this.data == null){
			return action == '??' ? 
				['off', 'on'] 
				: 'off'

		// special case: multiple targets and toggle action...
		// XXX do we need this???
		} else if((target == 'all' 
					|| target == 'loaded' 
					|| target == 'ribbon' 
					|| target instanceof Array) 
				&& (action == null 
					|| action == 'next' 
					|| action == 'prev' 
					|| action == '!')){
			var res = []
			var that = this
			var on = []
			var off = []
			target = _getTarget.call(this, target)
			target
				.forEach(function(gid){
					if((that.data.getTags(gid).indexOf(tag) < 0) 
							// invert check if action is '!'...
							+ (action == '!' ? -1 : 0)){
						on.push(gid)
						res.push('on')

					} else {
						off.push(gid)
						res.push('off') } })

			that.tag(tag, on)
			that.untag(tag, off)

			return res.length == 1 ? 
				res[0] 
				: res }

		// normal case...
		return _tagToggler.call(this, target, action) }

	// cheating a bit...
	action.__proto__ = toggler.Toggler.prototype
	action.constructor = toggler.Toggler
	return action }


// Build a tag toggler undo set of attrs...
// 
// This will add:
// 	'undoable'		- predicate to check if we need to undo, to handle 
// 						introspection calls correctly...
// 	'undo'			- undo function...
// 	
var undoTag = function(action){
	return {
		// do not journal calls that have no side-effects, e.g. toggler 
		// introspection...
		// XXX should this be a generic predicate???
		undoable: function(a){
			// handle ribbon-wide operations...
			// NOTE: this is specific to .toggleMark(..)
			if(a.args[0] == 'ribbon' 
					&& action == 'toggleMark'){
				a.state = this.markedInRibbon()
				return true }
			// skip introspection...
			return a.args.indexOf('?') < 0 
				&& a.args.indexOf('??') < 0 },
		undo: function(a){
			// restore state...
			if(a.state){
				this[action]('ribbon', 'off')
				this[action](a.state, 'on')
			// reverse state...
			} else {
				this[action].apply(this, 
					// XXX is argument handling here too optimistic???
					a.args
						.map(function(e){ 
							return e == 'on' ? 
									'off' 
								: e == 'off' ? 
									'on'
								: e })) } }, 
	} }


// Shift marked image action constructor...
// 
// 	Shift marked images up/down
// 	shiftMarked('up')
// 	shiftMarked('down')
// 		-> action
// 
// The resulting action affects only images in current ribbon...
// 
// NOTE: this specific to marked/selected images...
var shiftMarked = function(direction){
	return function(ribbon){
		var that = this
		var marked = this.markedInRibbon(ribbon)
		var next 

		// need to shift focus...
		if(marked.indexOf(this.current) >= 0){
			var d = this.direction == 'right' ? 'next' : 'prev'

			var getNext = function(direction){
				var next = that.data.getImage(direction)
				while(next != null 
						&& marked.indexOf(next) >= 0){
					next = that.data.getImage(next, direction) }
				return next }

			next = getNext(d) 
				|| getNext(d == 'next' ? 
					'prev' 
					: 'next')

			next != null 
				&& this.data.focusImage(next) }

		// shift the image...
		this.data['shiftImage'+ direction.capitalize()](marked)

		// obey the shiftImage protocol...
		this.shiftImage.apply(this, marked) } }


// Shift undo function constructor...
// 
// NOTE: this is specific to shiftMarkedUp/shiftMarkedDown...
var undoShift = function(undo){
	return function(a){ 
		this[undo](this.data.getRibbon(
			undo == 'shiftMarkedUp' ? 
				'next' 
				: 'prev',
			a.args.length == 0 ? 
				a.current 
				: a.args[0])) }}



//---------------------------------------------------------------------

var ImageMarkActions = actions.Actions({

	// a shorthand...
	// NOTE: this will return a copy...
	//
	// XXX should we add a caching scheme here???
	// 		...it would require invalidation on tagging...
	// 		the problem is that on large sets this may take up quite a 
	// 		chunk of memory...
	get marked(){
		return this.data == null ?
			[]
			: this.data.sortViaOrder(
				this.data.tagQuery('marked')) },
	// NOTE: this will untag only the loaded images...
	set marked(gids){
		gids = gids instanceof Array ?
			gids
			: [gids]
		this
			.untag('marked', this.data.getImages('loaded'))
			.tag('marked', gids) },

	markedInRibbon: ['- Mark|Ribbon/',
		function(ribbon){
			var ribbon = this.data.getRibbon(ribbon)
			var images = this.data.makeSparseImages(
				this.data.getImages(ribbon))

			return this.data.makeSparseImages(this.marked)
				// NOTE: this will also filter out undefined positions...
				.filter(function(img, i){ 
					return images[i] != null }) }],

	prevMarked: ['Mark|Navigate/Previous marked image',
		{mode: function(target){ 
			return this.data.getImage('current', 'before', this.marked) == null && 'disabled' }},
		function(mode){ this.prevTagged('marked', mode) }],
	nextMarked: ['Mark|Navigate/Next marked image',
		{mode: function(target){ 
			return this.data.getImage('current', 'after', this.marked) == null && 'disabled' }},
		function(mode){ this.nextTagged('marked', mode) }],

	cropMarked: ['Mark|Crop/Crop $marked images',
		{mode: function(){
			return this.marked.length == 0 && 'disabled' }},
		'crop: "marked" ...'],
		//function(flatten){ this.cropTagged('marked', flatten) }],
		//function(flatten){ this.cropTagged('marked', 'any', flatten) }],

	removeMarkedFromCrop: ['Mark|Crop/Remove marked from crop',
		{mode: function(target){ 
			return (this.marked.length == 0 || !this.cropped) && 'disabled' }},
		'removeFromCrop: marked'],

	rotateMarkedCW: ['Mark/Rotate marked clockwise',
		{mode: 'cropMarked'},
		'rotateCW: marked'],
	rotateMarkedCCW: ['Mark/Rotate marked counterclockwise',
		{mode: 'cropMarked'},
		'rotateCCW: marked'],
	flipMarkedVertical: ['Mark/Flip marked vertically',
		{mode: 'cropMarked'},
		'flipVertical: marked'],
	flipMarkedHorizontal: ['Mark/Flip marked horizontally',
		{mode: 'cropMarked'},
		'flipHorizontal: marked'],
})


// NOTE: this is usable without ribbons...
var ImageMarks = 
module.ImageMarks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-marks',

	depends: [
		'base',
	],
	suggested: [
		'image-marks-edit',
		'ui-image-marks',
		'image-marks-groups',
	],

	actions: ImageMarkActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageMarkEditActions = actions.Actions({
	// XXX should this be like .crop(..) and accept attr name???
	toggleMark: ['Mark|Image/Image $mark',
		core.doc`

		 	Toggle mark on current image
		 	.toggleMark()
		
		 	Mark current ribbon
		 	.toggleMark('ribbon', 'on')
		
		 	Unmark all loaded images
		 	.toggleMark('loaded', 'off')
		
		 	Invert marks on current ribbon
		 	.toggleMark('ribbon')
		
		`,
		undoTag('toggleMark'),
		makeTagTogglerAction('marked')],
	toggleMarkBlock: ['Mark/Invert $block marks',
		core.doc`A block is a set of adjacent images either marked on unmarked
		in the same way
		`,
		function(target){
			target = this.data.getImage(target)

			var ribbon = this.data.makeSparseImages(this.data.getImages(target))
			var marked = this.data.makeSparseImages(this.markedInRibbon(target))

			var c = ribbon.indexOf(target)
			var state = !!marked[c]

			var block = [target]

			// pre block...
			var i = c-1
			while(i >= 0 
					// NOTE: we are avoiding mixing up a tag not set condition
					// 		with image i not in ribbon...
					&& (!ribbon[i] 
						|| !!marked[i] == state)){
				ribbon[i] 
					&& block.splice(0, 0, ribbon[i])
				i-- }

			// post block...
			var i = c+1
			while(i < ribbon.length 
					// NOTE: we are avoiding mixing up a tag not set condition
					// 		with image i not in ribbon...
					&& (!ribbon[i] 
						|| !!marked[i] == state)){
				ribbon[i] 
					&& block.push(ribbon[i])
				i++ }

			// do the marking...
			return this.toggleMark(block, state ? 'off' : 'on') }],
	toggleMarkRibbon: ['Mark/$Invert ribbon marks', 
		'toggleMark: "ribbon" ...' ],
	toggleMarkLoaded: ['Mark/Invert marks', 
		'toggleMark: "loaded" ...' ],

	// NOTE: we do not need a menu hotkey as these are easy to access 
	// 		directly (via ctrl-a/ctrl-shift-a)
	markRibbon: ['Mark/Mark ribbon', 
		'toggleMark: "ribbon" "on"' ],
	markLoaded: ['Mark/Mark all', 
		'toggleMark: "loaded" "on"' ],

	markTagged: ['- Mark/Mark images by tags',
		function(query){
			var that = this
			this.data.tagQuery(query)
				.forEach(function(gid){
					that.toggleMark(gid, 'on') }) }],

	shiftMarkedUp: ['Mark/Shift marked u$p',
		{undo: undoShift('shiftMarkedDown'),
			mode: 'cropMarked'},
		shiftMarked('up')],
	shiftMarkedDown: ['Mark/Shift marked $down',
		{undo: undoShift('shiftMarkedUp'),
			mode: 'cropMarked'},
		shiftMarked('down')],

	// XXX undo...
	shiftMarkedAfter: ['Mark|Image/Shift marked $after',
		{mode: 'cropMarked'},
		function(target){
			this.shiftImageTo(this.marked, target || 'current', 'after') }],
	// XXX undo...
	shiftMarkedBefore: ['Mark|Image/Shift marked $b$efore',
		{mode: 'cropMarked'},
		function(target){
			this.shiftImageTo(this.marked, target || 'current', 'before') }],

	unmarkRibbon: ['Mark/Unmark ribbon',
		{mode: 'cropMarked'},
		'toggleMark: "ribbon" "off"'],
	unmarkLoaded: ['Mark/$Unmark all',
		{mode: 'cropMarked'},
		'toggleMark: "loaded" "off"'],
})

var ImageEditMarks = 
module.ImageEditMarks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-marks-edit',

	depends: [
		'tags-edit',
	],
	suggested: [
	],

	actions: ImageMarkEditActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageMarkGroupActions = actions.Actions({
	// NOTE: this will only group loaded images...
	groupMarked: ['Group|Mark/-70:Group loaded marked images', 
		{journal: true,
			mode: 'cropMarked'}, 
		function(){ 
			this.group(this.data.getImages(this.marked)) }],
})

var ImageMarkGroup = 
module.ImageMarkGroup = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-marks-groups',

	depends: [
		'image-marks-edit',
		'image-group-edit',
	],
	suggested: [
	],

	actions: ImageMarkGroupActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageMarksUI = 
module.ImageMarksUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-image-marks',

	depends: [
		'ui',
		'image-marks',
	],

	handlers: [
		// XXX is a full reload a good thing here???
		[[
			'shiftMarkedUp',
			'shiftMarkedDown',
		], 
			function(ribbon){ this.reload(true) }],

		// XXX is this the right way to go???
		['updateImage', function(_, gid, img, options){
			// NOTE: we are not using .toggleMark(..) here as this 
			// 		does not need to depend on the 'edit' feature...
			!(options || {}).nochrome
				&& this.ribbons
				&& this.ribbons
					.toggleImageMark(
						gid, 
						'marked', 
						this.data.hasTag(gid, 'marked') ? 
							'on' 
							: 'off') }],
	],
})


//---------------------------------------------------------------------

var ImageBookmarkActions = actions.Actions({

	// a shorthand...
	//
	// NOTE: this will return a copy...
	//
	// XXX should we add a caching scheme here???
	// 		...it would require invalidation on tagging...
	// 		the problem is that on large sets this may take up quite a 
	// 		chunk of memory...
	get bookmarked(){
		return this.data == null ?
			[]
			: this.data.sortViaOrder(this.data.tagQuery('bookmark')) },
	// NOTE: this will untag only the loaded images...
	set bookmarked(gids){
		gids = gids instanceof Array ?
			gids
			: [gids]
		this
			.untag('bookmarked', this.data.getImages('loaded'))
			.tag('bookmarked', gids) },

	prevBookmarked: ['Bookmark|Navigate/Previous bookmarked image',
		{mode: function(target){ 
			return this.data.getImage('current', 'before', this.bookmarked) == null && 'disabled' }},
		function(mode){ this.prevTagged('bookmark', mode) }],
	nextBookmarked: ['Bookmark|Navigate/Next bookmarked image',
		{mode: function(target){ 
			return this.data.getImage('current', 'after', this.bookmarked) == null && 'disabled' }},
		function(mode){ this.nextTagged('bookmark', mode) }],

	cropBookmarked: ['Bookmark|Crop/Crop $bookmarked images',
		{mode: function(target){ 
			return this.bookmarked.length == 0 && 'disabled' }},
		'crop: "bookmarked" ...'],
		//function(flatten){ this.cropTagged('bookmark', 'any', flatten) }],
		//function(flatten){ this.cropTagged('bookmark', flatten) }],
})

// NOTE: this is usable without ribbons...
var ImageBookmarks = 
module.ImageBookmarks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-bookmarks',

	depends: [
		'base',
	],
	suggested: [
		'image-bookmarks-edit',
		'ui-image-bookmarks',
	],

	actions: ImageBookmarkActions,

})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageBookmarkEditActions = actions.Actions({
	toggleBookmark: ['Bookmark|Image/Image $bookmark',
		undoTag('toggleBookmark'),
		makeTagTogglerAction('bookmark')],
	// action can be:
	// 	'on'	- toggle all on
	// 	'off'	- toggle all off
	// 	'next'	- toggle each image to next state
	toggleBookmarkOnMarked: ['Bookmark|Mark/-70:Toggle bookmark on maked images',
		{mode: 'cropMarked'},
		function(action){ 
			return this.toggleBookmark(this.marked, action) }],
})

var ImageBookmarksEdit = 
module.ImageBookmarksEdit = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'image-bookmarks-edit',

	depends: [
		'tags-edit',
	],
	suggested: [
		'ui-image-bookmarks',
	],

	actions: ImageBookmarkEditActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageBookmarksUI = 
module.ImageBookmarksUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-image-bookmarks',

	depends: [
		'ui',
		'image-bookmarks',
	],

	handlers: [
		// XXX is this the right way to go???
		['updateImage', function(_, gid, img, options){
			!(options || {}).nochrome
				&& this.ribbons
				&& this.ribbons
					.toggleImageMark(
						gid, 
						'bookmark', 
						this.data.hasTag(gid, 'bookmark') ? 
							'on' 
							: 'off') }],
	],
})



//---------------------------------------------------------------------

core.ImageGridFeatures.Feature('marks', [
	'image-marks',
	'image-bookmarks',
])



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
