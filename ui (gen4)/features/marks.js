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
//
// NOTE: of no data is defined this will not have any effect...
// NOTE: we are not using the vanilla toggler here as it can't handle 
// 		toggling independently multiple elements...
function makeTagTogglerAction(tag){
	// get actual target gids...
	var _getTarget = function(target){
		target = target || 'current'
		target = target == 'all' 
				|| target == 'loaded' 
				|| target in this.data.ribbons 
					? this.data.getImages(target)
			: target == 'ribbon' ? this.data.getImages('current')
			: target
		return target.constructor !== Array ? [target] : target
	}

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
				this.untag(tag, target)
			}
		}, 
		['off', 'on'])

	// the action...
	var action = function(target, action){
		// special case: no data...
		if(this.data == null){
			return action == '??' ? ['off', 'on'] : 'off'

		// special case: multiple targets and toggle action...
		} else if((target == 'all' || target == 'loaded' || target == 'ribbon' 
					|| target instanceof Array) 
				&& (action == null || action == 'next' || action == 'prev' 
					|| action == '!')){
			var res = []
			var that = this
			target = _getTarget.call(this, target)
			target.forEach(function(t){
				if((that.data.getTags(t).indexOf(tag) < 0) 
						// invert check if action is '!'...
						+ (action == '!' ? -1 : 0)){
					that.tag(tag, t)
					res.push('on')

				} else {
					that.untag(tag, t)
					res.push('off')
				}
			})
			return res.length == 1 ? res[0] : res
		}

		// normal case...
		return _tagToggler.call(this, target, action)
	}

	// cheating a bit...
	action.__proto__ = toggler.Toggler.prototype
	action.constructor = toggler.Toggler
	return action
}


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
			if(a.args[0] == 'ribbon' && action == 'toggleMark'){
				a.state = this.markedInRibbon()
				return true
			}
			// skip introspection...
			return a.args.indexOf('?') < 0 
				&& a.args.indexOf('??') < 0
		},
		undo: function(a){
			// restore state...
			if(a.state){
				this[action]('ribbon', 'off')
				this[action](a.state, 'on')

			// reverse state...
			} else {
				this[action].apply(this, 
					// XXX is argument handling here too optimistic???
					a.args.map(function(e){ 
						return e == 'on' ? 'off' 
							: e == 'off' ? 'on'
							: e })) 
			}
		},
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
				while(next != null && marked.indexOf(next) >= 0){
					next = that.data.getImage(next, direction)
				}
				return next
			}

			next = getNext(d) 
				|| getNext(d == 'next' ? 'prev' : 'next')

			next != null 
				&& this.data.focusImage(next)
		}

		// shift the image...
		this.data['shiftImage'+ direction.capitalize()](marked)

		// obey the shiftImage protocol...
		this.shiftImage.apply(this, marked)
	}
}


// Shift undo function constructor...
// 
// NOTE: this is specific to shiftMarkedUp/shiftMarkedDown...
var undoShift = function(undo){
	return function(a){ 
		this[undo](this.data.getRibbon(
			undo == 'shiftMarkedUp' ? 'next' : 'prev',
			a.args.length == 0 ? a.current : a.args[0])) }}



//---------------------------------------------------------------------

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

	markedInRibbon: ['- Mark|Ribbon/',
		function(ribbon){
			var ribbon = this.data.getRibbon(ribbon)
			var images = this.data.makeSparseImages(this.data.getImages(ribbon))

			return this.data.makeSparseImages(this.marked)
				// NOTE: this will also filter out undefined positions...
				.filter(function(img, i){ return images[i] != null })
		}],

	prevMarked: ['Mark|Navigate/Previous marked image',
		function(mode){ this.prevTagged('selected', mode) }],
	nextMarked: ['Mark|Navigate/Next marked image',
		function(mode){ this.nextTagged('selected', mode) }],

	cropMarked: ['Mark|Crop/Crop $marked images',
		function(flatten){ this.cropTagged('selected', 'any', flatten) }],
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
	],

	actions: ImageMarkActions,
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var ImageMarkEditActions = actions.Actions({
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
	toggleMark: ['Mark|Image/Image $mark',
		undoTag('toggleMark'),
		makeTagTogglerAction('selected')],
	toggleMarkBlock: ['Mark/Mark $block',
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
					&& (!ribbon[i] || !!marked[i] == state)){
				ribbon[i] 
					&& block.splice(0, 0, ribbon[i])
				i--
			}

			// post block...
			var i = c+1
			while(i < ribbon.length 
					// NOTE: we are avoiding mixing up a tag not set condition
					// 		with image i not in ribbon...
					&& (!ribbon[i] || !!marked[i] == state)){
				ribbon[i] 
					&& block.push(ribbon[i])
				i++
			}

			// do the marking...
			return this.toggleMark(block, state ? 'off' : 'on')
		}],

	markTagged: ['- Mark/Mark images by tags',
		function(tags, mode){
			var selector = mode == 'any' ? 'getTaggedByAny' : 'getTaggedByAll'

			var that = this
			this.data[selector](tags).forEach(function(gid){
				that.toggleMark(gid, 'on')
			})
		}],

	shiftMarkedUp: ['Mark|Ribbon/Shift marked $up',
		{undo: undoShift('shiftMarkedDown')},
		shiftMarked('up')],
	shiftMarkedDown: ['Mark|Ribbon/Shift marked $down',
		{undo: undoShift('shiftMarkedUp')},
		shiftMarked('down')],
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
		['updateImage', function(_, gid, img){
			// update only when ribbons are preset... 
			if(this.ribbons != null){
				// NOTE: we are not using .toggleMark(..) here as this 
				// 		does not need to depend on the 'edit' feature...
				if(this.data.toggleTag('selected', gid, '?') == 'on'){
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

	prevBookmarked: ['Bookmark|Navigate/Previous bookmarked image',
		function(mode){ this.prevTagged('bookmark', mode) }],
	nextBookmarked: ['Bookmark|Navigate/Next bookmarked image',
		function(mode){ this.nextTagged('bookmark', mode) }],

	cropBookmarked: ['Bookmark|Crop/Crop $bookmarked images',
		function(flatten){ this.cropTagged('bookmark', 'any', flatten) }],
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
	toggleBookmarkOnMarked: ['Bookmark|Mark/Bookmark on maked images',
		function(action){ 
			return this.toggleBookmark(this.data.getTaggedByAny('selected'), action) 
		}],
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
		['updateImage', function(_, gid, img){
			// update only when ribbons are preset... 
			if(this.ribbons != null){
				if(this.data.toggleTag('bookmark', gid, '?') == 'on'){
					this.ribbons.toggleImageMark(gid, 'bookmark', 'on')
				} else {
					this.ribbons.toggleImageMark(gid, 'bookmark', 'off')
				}
			}
		}],
	],
})


//---------------------------------------------------------------------

core.ImageGridFeatures.Feature('marks', [
	'image-marks',
	'image-bookmarks',
])



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })