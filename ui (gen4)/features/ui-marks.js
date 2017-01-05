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



//---------------------------------------------------------------------

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
	toggleMark: ['Mark|Image/Image mark',
		makeTagTogglerAction('selected')],
	// XXX
	toggleMarkBlock: ['Mark/Block marks',
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
module.ImageMarks = core.ImageGridFeatures.Feature({
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

	toggleBookmark: ['Bookmark|Image/Image bookmark',
		makeTagTogglerAction('bookmark')],
	// action can be:
	// 	'on'	- toggle all on
	// 	'off'	- toggle all off
	// 	'next'	- toggle each image to next state
	toggleBookmarkOnMarked: ['Bookmark|Mark/Bookmark on maked images',
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
module.ImageBookmarks = core.ImageGridFeatures.Feature({
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

core.ImageGridFeatures.Feature('marks', [
	'image-marks',
	'image-bookmarks',
])



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
