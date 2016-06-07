/**********************************************************************
* 
* Data generation 4 implementation.
*
*
* XXX might be a good idea to make a set of universal argument parsing 
* 	utils...
*
**********************************************************************/

define(function(require){ var module = {}


var sha1 = require('ext-lib/sha1')

var object = require('lib/object')

var formats = require('imagegrid/formats')


module.DATA_VERSION = '3.0'


/*********************************************************************/
//
// General format info...
//
// Version format:
// 	<major>.<minor>
//
// Major version changes mean a significant incompatibility.
//
// Minor version changes mean some detail changed and can be handled
// by it's specific handler seamlessly. Backwards compatible.
//
//
// For more info see:
// 	DATA			- main data
// 	IMAGES			- image data
// 	MARKED			- marks data
// 	BOOKMARKS		- bookmarks data
// 	BOOKMARKS_DATA	- bookmarks metadata
// 	TAGS			- tag data
//
//
// Data format change history:
// 	3.0	- Gen4 DATA format, introduced several backwards incompatible 
// 		changes:
// 			- added ribbon GIDs, .ribbons now is a gid indexed object
// 			- added .ribbon_order
// 			- added .base ribbon
// 			- ribbons are now sparse in memory but can be compact when
// 			  serialized.
// 			- auto-convert from gen1 (no version) and gen3 (2.*) on load
// 	2.3 - Minor update to sorting restrictions
// 			- now MARKED and BOOKMARKS do not need to be sorted 
// 			  explicitly in json, they are now sorted as a side-effect 
// 			  of being sparse.
// 			  This negates some restrictions posed in 2.1, including 
// 			  conversion of 2.0 data.
// 			  NOTE: TAGS gid sets are still compact lists, thus are 
// 			  		actively maintained sorted.
// 			  		...still thinking of whether making them sparse is
// 			  		worth the work...
// 	2.2 - Minor update to how data is handled and saved
// 			- now DATA.current is saved separately in current.json,
// 			  loading is done from current.json and if not found from
// 			  data.json.
// 			  the file is optional.
// 			- data, marks, bookmarks, tags are now saved only if updated
// 	2.1 - Minor update to format spec,	
// 			- MARKED now maintained sorted, live,
// 			- will auto-sort marks on load of 2.0 data and change 
// 			  data version to 2.1, will need a re-save,
// 	2.0 - Gen3 data format, still experimental,
// 			- completely new and incompatible structure,
// 			- use convertDataGen1(..) to convert Gen1 to 2.0 
// 			- used for my archive, not public,
// 			- auto-convert form gen1 on load...
// 	none - Gen1 data format, mostly experimental,
// 			- has no explicit version set,
// 			- not used for real data.
//
//
// NOTE: Gen1 and Gen3 refer to code generations rather than data format
// 		iterations, Gen2 is skipped here as it is a different project 
// 		(PortableMag) started on the same code base as ImageGrid.Viewer
// 		generation 1 and advanced from there, back-porting some of the 
// 		results eventually formed Gen3...
//
//
/*********************************************************************/
//
// TODO save current crop/state as JSON (named)...
// TODO save current order (named)...
// TODO auto-save manual sort -- on re-sort...
//
//
/*********************************************************************/

// decide to use a hashing function...
if(typeof(sha1) != 'undefined'){
	var hash = sha1.hash.bind(sha1)
} else {
	var hash = function(g){ return g }
}


/*********************************************************************/

// Data class methods and API...
//
var DataClassPrototype = {
	// NOTE: we consider the input list sorted...
	fromArray: function(list){
		var res = new Data()
		// XXX make a real ribbon gid...
		var gid = res.newGid()
		res.order = list
		res.ribbon_order.push(gid)
		res.ribbons[gid] = list.slice()

		res.focusImage(list[0])
		res.setBase(gid)

		return res
	},
	// XXX is this the right way to construct data???
	fromJSON: function(data){
		//return new Data().loadJSON(data)
		return new this().loadJSON(data)
	},
}



/*********************************************************************/

// Data object methods and API...
//
var DataPrototype = {

	/*****************************************************************/
	//
	// Base Terminology:
	// 	- gen1 methods
	// 		- use the data API/Format
	// 		- use other gen1 methods
	// 	- gen2 methods
	// 		- do NOT use the data API/Format
	// 		- use other methods from any of gen1 and gen2
	//
	// NOTE: only gen2 methods are marked.
	//
	//
	/****************************************************** Format ***/
	//
	// 	.current (gid)
	// 		gid of the current image
	//
	// 	.base (gid)
	// 		gid of the base ribbon
	//
	// 	.order
	// 		List of image gids setting the image order
	//
	// 		format:
	//	 		[ gid, .. ]
	//
	//	 	NOTE: this list may contain gids not loaded at the moment, 
	//	 		a common case for this is when data is cropped.
	//
	// 	.ribbon_order
	// 		List of ribbon gids setting the ribbon order.
	//
	// 		format:
	// 			[ gid, .. ]
	//
	// 	.ribbons
	// 		Dict of ribbons, indexed by ribbon gid, each ribbon is a 
	// 		sparse list of image gids.
	//
	// 		format:
	// 			{ gid: [ gid, .. ], .. }
	//
	// 		NOTE: ribbons are sparse...
	// 		NOTE: ribbons can be compact when serialized...
	//
	/*****************************************************************/

	// XXX is this a good name for this??? (see: object.js)
	__init__: function(json){
		// load initial state...
		if(json != null){
			this.loadJSON(json)
		} else {
			this._reset()
		}
		return this
	},



	/******************************************************* Utils ***/
	
	// Make a sparse list of image gids...
	//
	// This uses .order as the base for ordering the list.
	//
	// If target is given then it will get updated with the input gids.
	//
	// NOTE: this can be used to re-sort sections of a target ribbon, 
	// 		but care must be taken not to overwrite existing data...
	// NOTE: if target is given some items in it might get pushed out
	// 		by the new gids, especially if target is out of sync with 
	// 		.order, this can be avoided by setting keep_target_items 
	// 		(see next for more info).
	// 		Another way to deal with this is to .makeSparseImages(target)
	// 		before using it as a target.
	// NOTE: if keep_target_items is set items that are overwritten in 
	// 		the target will get pushed to gids.
	// 		This flag has no effect if target is an empty list (default).
	makeSparseImages: function(gids, target, keep_target_items){
		target = target == null ? [] : target
		keep_target_items = keep_target_items == null ? false : keep_target_items
		order = this.order

		// avoid directly updating self...
		if(gids === target){
			gids = gids.slice()
		}

		gids.forEach(function(e, i){
			// if the element is in its place alredy do nothing...
			if(e == order[i] && e == target[i]){
				return
			}
			
			// NOTE: try and avoid the expensive .indexOf(..) as much as
			// 		possible...
			i = e != order[i] ? order.indexOf(e) : i

			if(i >= 0){
				var o = target[i]
				// save overwritten target items if keep_target_items 
				// is set...
				if(keep_target_items 
						&& o != null 
						// if the items is already in gids, forget it...
						// NOTE: this is to avoid juggling loops...
						&& gids.indexOf(o) < 0){
					gids.push(o)
				}

				target[i] = e
			}
		})

		return target
	},

	// Remove duplicate items from list in-place...
	//
	// NOTE: only the first occurrence is kept...
	// NOTE: this is slow-ish...
	removeDuplicates: function(lst, skip_undefined){
		skip_undefined = skip_undefined == null ? true : skip_undefined
		for(var i=0; i < lst.length; i++){
			if(skip_undefined && lst[i] == null){
				continue
			}
			if(lst.indexOf(lst[i]) != i){
				lst.splice(i, 1)
				i -= 1
			}
		}
		return lst
	},

	// List of sparse image set names...
	//
	// NOTE: this is used mostly by .eachImageList(..), not intended for
	// 		client use.
	__gid_lists: ['ribbons', 'groups'],

	// Iterate through image lists...
	//
	// This accepts a function:
	// 	func(list, key, set)
	//
	// Where:
	// 	list		- the sparse list of gids
	// 	key			- the list key in set
	// 	set			- the set name
	//
	// The function is called in the context of the data object.
	//
	// The arguments can be used to access the list directly like this:
	// 	this[set][key]	-> list
	//
	eachImageList: function(func){
		var that = this
		this.__gid_lists.forEach(function(k){
			var lst = that[k]
			if(lst == null){
				return
			}
			Object.keys(lst).forEach(function(l){
				func.call(that, lst[l], l, k)
			})
		})
		return this
	},

	// Generate a GID...
	//
	// If no arguments are given then a unique gid will be generated.
	//
	// XXX revise...
	newGid: function(str, nohash){
		// prevent same gids from ever being created...
		// NOTE: this is here in case we are generating new gids fast 
		// 		enough that Date.now() produces identical results for 2+
		// 		consecutive calls...
		var t = module.__gid_ticker = (module.__gid_ticker || 0) + 1

		var p = typeof(location) != 'undefined' ? location.hostname : ''

		// if we are on node.js add process pid
		if(typeof(process) != 'undefined'){
			p += process.pid
		}

		// return string as-is...
		if(nohash){
			return str || p+'-'+t+'-'+Date.now()
		}

		// make a hash...
		var gid = hash(str || (p+'-'+t+'-'+Date.now()))

		// for explicit string return the hash as-is...
		if(str != null){
			return gid
		}

		// check that the gid is unique...
		while(this.ribbon_order.indexOf(gid) >= 0 
				|| this.order.indexOf(gid) >= 0){
			gid = hash(p+'-'+t+'-'+Date.now())
		}

		return gid
	},
	
	// Clear elements from data...
	//
	// 	Clear all data:
	// 	.clear()
	// 	.clear('*')
	// 	.clear('all')
	// 		-> data
	//
	// 	Clear empty ribbons:
	// 	.clear('empty')
	// 		-> data
	//
	// 	Clear gid(s) form data:
	// 	.clear(gid)
	// 	.clear([gid, gid, ..])
	// 		-> data
	//
	//
	// Two extra arguments are considered:
	// 	- deep		- if set to true (default), when cleared a ribbon all
	// 				  images within that ribbon will also be cleared.
	// 	- clear_empty
	// 				- if true (default), empty ribbons will be removed 
	// 				  after all gids are cleared.
	// 				  this is equivalent to calling:
	// 				  	.clear('empty')
	//
	//
	// NOTE: at this point this will not set .base and .current but this
	// 		will reset them to null if a base ribbon or current image is
	// 		cleared...
	// 		thus setting appropriate .base and .current values is the 
	// 		responsibility of the caller.
	//
	// XXX not sure this should be here...
	// XXX should this reset .base and .current to appropriate values 
	// 		other than null?
	// XXX should this return this or the removed gids???
	clear: function(gids, deep, clear_empty){
		gids = gids || 'all'
		deep = deep == null ? true : false
		clear_empty = clear_empty == null ? true : false 

		// clear all data...
		if(gids == '*' || gids == 'all'){
			this._reset()

		// clear empty ribbons only...
		} else if(gids == 'empty'){
			for(var r in this.ribbons){
				if(this.ribbons[r].len == 0){
					this.clear(r)
				}
			}

		// clear gids...
		} else {
			gids = gids.constructor === Array ? gids : [gids]
			var that = this
			gids.forEach(function(gid){
				var r = that.ribbon_order.indexOf(gid)
				var i = that.order.indexOf(gid)
				// gid is a ribbon...
				if(r >= 0){
					// clear from order...
					that.ribbon_order.splice(r, 1)

					// clear from ribbons...
					var images = that.ribbons[gid]
					delete that.ribbons[gid]

					// remove ribbon images...
					if(deep){
						images.forEach(function(gid){ that.clear(gid) })
					}

					// no more ribbons left...
					if(that.ribbon_order.length == 0){
						that.base = null

					// shift base up or to first image...
					} else if(that.base == gid){
						that.setBase(Math.max(0, r-1))
					}

				// gid is an image...
				} else if(i >= 0) {
					// remove from order...
					that.order.splice(i, 1)

					that.eachImageList(function(lst){
						lst.splice(i, 1)
					})

					if(that.current == gid){
						that.current = null
					}
				}
			})

			// cleanup...
			if(clear_empty){
				this.clear('empty')
			}
		}

		return this
	},

	// Replace image gid...
	//
	// XXX should this work for ribbon gids???
	replaceGid: function(from, to){
		from = this.getImage(from)
		var i = this.getImageOrder(from)

		var t = this.getImage(to)

		if(t != -1 && t != null){
			return
		}

		// current...
		if(from == this.current){
			this.current = to
		}
		// order...
		this.order[i] = to
		// image lists...
		this.eachImageList(function(list){
			if(list[i] != null){
				list[i] = to
			}
		})

		return this
	},



	/*********************************************** Introspection ***/

	get length(){
		return this.order.length
	},
	get ribbonLength(){
		return this.getImages(this.getRibbon()).len
	},


	// Get image
	//
	//	Get current image:
	//	.getImage()
	//	.getImage('current')
	// 		-> gid
	//
	// 	Check if image is loaded/exists:
	// 	.getImage(gid)
	// 		-> gid
	// 		-> null
	//
	// 	Get image or closest to it from list/ribbon:
	// 	.getImage(gid, list|ribbon)
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get image by order in ribbon: 
	// 	.getImage(n)
	// 	.getImage(n, ribbon)
	// 		-> gid
	// 		-> null
	//		NOTE: n can be negative, thus getting an image from the tail.
	// 		NOTE: the second argument must not be an int (ribbon order)
	// 				to avoid conflict with the offset case below.
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get image by global order: 
	// 	.getImage(n, 'global')
	// 		-> gid
	// 		-> null
	//		NOTE: n can be negative, thus getting an image from the tail.
	// 		NOTE: this is similar to .order[n], aside from negative index
	// 				processing.
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get first or last image in ribbon:
	// 	.getImage('first'[, ribbon])
	// 	.getImage('last'[, ribbon])
	// 		-> gid
	// 		-> null (XXX empty ribbon??? ...test!)
	// 		NOTE: the second argument must be .getRibbon(..) compatible.
	// 		NOTE: to get global first/last image use the index, e.g.:
	// 			.getImage(0) / .getImage(-1)
	//
	// 	Get image closest to current in list/ribbon:
	// 	.getImage(list|ribbon[, 'before'|'after'])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image before/after the
	// 				current image in the given list/ribbon, e.g. the 
	// 				current image is first/last resp.
	// 		NOTE: 'before' is default.
	// 		NOTE: the first argument must not be a number.
	//
	// 	Get image closest to current or a specific image:
	// 	.getImage('before'[, list|ribbon])
	// 	.getImage(gid|order, 'before'[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 	.getImage('after'[, list|ribbon])
	// 	.getImage(gid|order, 'after'[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image before/after the
	// 				current image in the given list/ribbon, e.g. the 
	// 				current image is first/last resp.
	// 		NOTE: in both the above cases if gid|order is found explicitly
	// 			it will be returned.
	//
	// 	Get next/prev image (offset of 1):
	// 	.getImage('next')
	// 	.getImage('prev')
	// 	.getImage(gid|order, 'next'[, list|ribbon])
	// 	.getImage(gid|order, 'prev'[, list|ribbon])
	// 		-> gid
	//
	// 	Get image at an offset from a given image:
	// 	.getImage(gid|order, offset[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image at given offset.
	//		NOTE: offset is calculated within the same ribbon...
	//
	// NOTE: If gid|order is not given, current image is assumed.
	// 		Similarly, if list|ribbon is not given then the current 
	// 		ribbon is used.
	// NOTE: if input gid is invalid this will return -1
	// NOTE: the following are equivalent:
	// 			D.getImage('current', -1, R)
	// 			D.getImage('before', R) 
	// 			D.getImage('current', 'before', R)
	// 		where D is a Data object and R a ribbon id/index different 
	// 		from the current ribbon, i.e. the current image is not present
	// 		in R (see next note for details).
	// NOTE: in before/after modes, if the target image is found then it
	// 		will be returned, thus the mode has no effect unless the 
	// 		target image is not loaded.
	// 		Use offset to explicitly get the image before/after target.
	//
	// XXX most of the complexity here comes from argument DSL parsing,
	// 		might be good to revise argument syntax and handling...
	getImage: function(target, mode, list){
		// empty data...
		if(this.order == null || (this.order && this.order.length == 0)){
			return null
		}
		// no args...
		if(target == null && mode == null && list == null){
			return this.current
		}

		// current image shorthand...
		if(target == 'current'){
			target = this.current
		}

		// explicit image gid -- get the loaded group gid...
		if(this.order.indexOf(target) >= 0){
			var x = this.getLoadedInGroup(target)
			target = x != null ? x : target
		}

		// first/last special case...
		// XXX need to get first loaded...
		if(target == 'first'){
			list = this.ribbons[this.getRibbon(mode)]
			for(var res in list){
				return list[res]
			}
			return null
		}
		if(target == 'last'){
			list = this.ribbons[this.getRibbon(mode)]
			for(var i=list.length; i >= 0; i--){
				if(list[i] != null){
					return list[i]
				}
			}
			return null
		}

		// normalize target...
		if(target in this.ribbons || target.constructor === Array){
			list = target
			target = this.current
		} else if(['before', 'after', 'next', 'prev'].indexOf(target) >= 0){
			list = mode
			mode = target
			target = this.current
		}

		var offset = list == 'before' ? -1
			: list == 'after' ? 1 
			: 0
		if(list == 'before' || list == 'after'){
			list = null
		}

		// normalize mode...
		if(mode != null 
				&& mode.constructor === Array
				|| mode in this.ribbons){
			list = mode
			mode = null
		}
		// relative mode and offset...
		if(typeof(mode) == typeof(123)){
			offset += mode
			mode = offset < 0 ? 'before'
				: offset > 0 ? 'after'
				: mode
			offset = Math.abs(offset)
		} else if(mode == 'global'){
			list = mode
			mode = 'before'
		} else if(mode == 'next'){
			offset = 1
		} else if(mode == 'prev'){
			offset = -1
		} else {
			var offset = 0 
			mode = mode == null ? 'before' : mode
		}

		// normalize the list to a sparse list of gids...
		list = list == null ? 
				this.ribbons[
					this.getRibbon(typeof(target) == typeof(123) ? undefined : target)
						// target exists but is not loaded...
						|| this.getRibbon() 
						// no current ribbon...
						|| this.getRibbon(this.getImage(target, 'before', this.getImages()))
						|| this.getRibbon(this.getImage(target, 'after', this.getImages()))]
			: list == 'global' ?
				this.order
			: list.constructor === Array ? 
				this.makeSparseImages(list)
			: this.ribbons[this.getRibbon(list)]

		// order -> gid special case...
		var i
		if(typeof(target) == typeof(123)){
			list = list.compact()
			if(target >= list.length){
				return null
			}
			i = target

		} else {
			i = this.order.indexOf(target)

			// invalid gid...
			// XXX need a better way to report errors...
			if(i == -1){
				return -1
			}
		}

		// normalize i...
		i = i >= 0 ? i : list.length+i

		var res = list[i]
		// we have a direct hit...
		if(res != null && offset == 0){
			return res
		}

		// prepare for the search...
		var step = (mode == 'before' || mode == 'prev') ? -1
			: (mode == 'after' || mode == 'next') ? 1
			: null

		// strict -- no hit means there is no point in searching...
		if(step == null){
			return null
		}

		// skip the current elem...
		i += step
		// get the first non-null, also accounting for offset...
		// NOTE: we are using this.order.length here as ribbons might 
		// 		be truncated...
		// XXX currently this works correctly ONLY when step and offset
		// 		are in the same direction...
		for(; i >= 0 && i < this.order.length; i+=step){
			var cur = list[i]
			// skip undefined or unloaded images...
			if(cur == null || this.getRibbon(cur) == null){
				continue
			}
			offset -= 1
			if(offset <= 0){
				return cur
			}
		}
		// target is either first or last...
		return null
	},	

	// Get image order...
	//
	// This is similar to .getImage(..) but adds an optional context.
	//
	// The context can be:
	//	'all' 		- global order (default)
	// 	'loaded'	- order in loaded images
	// 	'ribbon'	- order in ribbon
	//
	// NOTE: acquiring the gid is exactly the same as with .getImage(..)
	// 		next, that gid is used to get the order, in case of the 
	// 		'ribbon' context, the order is relative to the ribbon where
	// 		the image is located.
	// 		To get the order of an image in a different ribbon, get an 
	// 		appropriate before/after image in that ribbon and get it's 
	// 		order.
	getImageOrder: function(context, target, mode, list){
		if(context == 'loaded'){
			return this.getImages('loaded').indexOf(this.getImage(target, mode, list))

		} else if(context == 'ribbon'){
			var gid = this.getImage(target, mode, list)
			return this.getImages(gid).indexOf(gid)

		} else if(context == 'all'){
			return this.order.indexOf(this.getImage(target, mode, list))
		} 

		return this.order.indexOf(this.getImage(context, target, mode))
	},	

	// Get a list of image gids...
	//
	//	Get list of loaded images:
	//	.getImages()
	//	.getImages('loaded')
	//		-> list
	//
	//	Get all images, both loaded and not:
	//	.getImages('all')
	//		-> list
	//
	//	Get list of images in current ribbon:
	//	.getImages('current')
	//		-> list
	//
	//	Filter the list and return only loaded images from it:
	//	.getImages(list)
	//	.getImages(list, 'loaded')
	//		-> list
	//
	//	.getImages(list, 'current')
	//	.getImages(list, order|ribbon)
	//		-> list
	//
	//	Get loaded images from ribbon:
	//	.getImages(gid|order|ribbon)
	//		-> list 
	//
	//	Get count gids around (default) before or after the target image:
	//	.getImages(gid|order|ribbon, count)
	//	.getImages(gid|order|ribbon, count, 'around')
	//	.getImages(gid|order|ribbon, count, 'after')
	//	.getImages(gid|order|ribbon, count, 'before')
	//		-> list 
	//
	//
	// If no image is given the current image/ribbon is assumed as target.
	//
	// This will always return count images if there is enough images 
	// in ribbon from the requested sides of target.
	//
	// NOTE: this expects ribbon order and not image order.
	// NOTE: if count is even, it will return 1 more image to the left 
	// 		(before) the target.
	// NOTE: if the target is present in the image-set it will be included
	// 		in the result regardless of mode...
	// NOTE: to get a set of image around a specific (non-current) image
	// 		in a specific (non-current) ribbon first get an apropriate image
	// 		via. .getImage(..) and then get the list with this...
	// 			D.getImages(D.getImage(gid, ribbon_gid), N, 'around')
	//
	// XXX add group support -- get the loaded, either a group gid or 
	// 		one of the contained images (first?)
	// XXX for some reason negative target number (ribbon number) 
	// 		breaks this...
	//
	// NOTE: this is a partial rewrite avoiding .compact() as much as 
	// 		possible and restricting it to as small a subset as possible
	getImages: function(target, count, mode){
		target = (target == null && count == null) ? 'loaded' : target
		mode = mode == null ? 'around' : mode
		var list

		// normalize target and build the source list...

		// 'current' ribbon...
		target = target == 'current' ? this.current : target

		// get all gids...
		if(target == 'all'){
			list = this.order
			target = null

		// get loaded only gids...
		} else if(target == 'loaded'){
			var res = []
			var ribbons = this.ribbons
			for(var k in ribbons){
				this.makeSparseImages(ribbons[k], res)
			}
			list = res.compact()
			target = null 

		// filter out the unloaded gids from given list...
		} else if(target != null && target.constructor === Array){
			var loaded = count == 'current' ? this.getImages('current')
				: count in this.ribbons ? this.ribbons[count].compact()
				: typeof(count) == typeof(123) ? 
					this.ribbons[this.getRibbon(count)].compact()
				: this.getImages('loaded')
			count = null 

			list = target.filter(function(e){
				return loaded.indexOf(e) >= 0
			})

			target = null 

		// target is ribbon gid...
		} else if(target in this.ribbons){
			list = this.ribbons[target]
		}

		// NOTE: list can be null if we got an image gid or ribbon order...
		// get the ribbon gids...
		list = list || this.ribbons[this.getRibbon(target)] || []

		if(count == null){
			return list.compact()
		}

		target = this.getImage(target)
		var i = list.indexOf(target)

		// prepare to slice the list...
		if(mode == 'around'){
			count = count/2
			var pre = Math.floor(count)
			var post = Math.ceil(count) - 1

		} else if(mode == 'before'){
			var pre = count - 1 
			var post = 0 

		} else if(mode == 'after'){
			var pre = 0
			var post = count - 1

		} else {
			// XXX bad mode....
			return null
		}

		var res = [target]

		// pre...
		for(var n = i-1; n >= 0 && pre > 0; n--){
			if(n in list){
				res.push(list[n])
				pre--
			}
		}

		res.reverse()

		// post...
		for(var n = i+1; n < list.length && post > 0; n++){
			if(n in list){
				res.push(list[n])
				post--
			}
		}

		return res
	},

	// Get ribbon...
	// 
	//	Get current ribbon:
	//	.getRibbon()
	//	.getRibbon('current')
	//		-> ribbon gid
	//
	//	Get first/last ribbon:
	//	.getRibbon('first')
	//	.getRibbon('last')
	//		-> ribbon gid
	//
	//	Get base ribbon:
	//	.getRibbon('base')
	//		-> base ribbon gid
	//
	//	Get ribbon before/after current 
	//	.getRibbon('before')
	//	.getRibbon('prev')
	//	.getRibbon('after')
	//	.getRibbon('next')
	//		-> gid
	//		-> null
	//
	//	Get ribbon by target image/ribbon:
	//	.getRibbon(ribbon|order|gid)
	//		-> ribbon gid
	//		-> null -- invalid target
	//		NOTE: if ribbon gid is given this will return it as-is.
	//
	//	Get ribbon before/after target:
	//	.getRibbon(ribbon|order|gid, 'before')
	//	.getRibbon(ribbon|order|gid, 'after')
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//	Get ribbon at offset from target:
	//	.getRibbon(ribbon|order|gid, offset)
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//
	// NOTE: this expects ribbon order and not image order.
	// NOTE: negative ribbon order is relative to list tail.
	//
	// XXX add group support -- get the loaded, either a group gid or 
	// 		one of the contained images (first?)
	getRibbon: function(target, offset){
		target = target == null ? this.current : target

		if(target == 'first'){
			return this.ribbon_order[0]

		} else if(target == 'last'){
			return this.ribbon_order.slice(-1)[0]
		}

		target = target == 'next' ? 'after' : target
		target = target == 'prev' ? 'before' : target

		if(target == 'before' || target == 'after'){
			offset = target
			target = 'current'
		}

		offset = offset == null ? 0 : offset
		offset = offset == 'before' ? -1 : offset
		offset = offset == 'after' ? 1 : offset

		// special keywords...
		if(target == 'base'){
			return this.base
		} else if(target == 'current'){
			target = this.current
		}

		var ribbons = this.ribbons
		var o

		// we got a ribbon gid...
		if(target in ribbons){
			o = this.ribbon_order.indexOf(target)

		// we got a ribbon order...
		} else if(typeof(target) == typeof(123)){
			o = target

		// image gid...
		} else {
			// get the loaded group gid...
			var x = this.getLoadedInGroup(target)
			target = x != null ? x : target

			var i = this.order.indexOf(target)
			if(i == -1){
				return null
			}
			var k
			for(k in ribbons){
				if(ribbons[k][i] != null){
					o = this.ribbon_order.indexOf(k)
					break
				}
			}
		}

		if(o != null){
			// negative indexes are relative to list tail...
			o = o < 0 ? o + this.ribbon_order.length : o

			o += offset


			if(o < 0 || o > this.ribbon_order.length){
				// ERROR: offset out of bounds...
				return null
			}
			return this.ribbon_order[o]
		}

		// ERROR: invalid target...
		return null
	},
	// same as .getRibbon(..) but returns ribbon order...
	getRibbonOrder: function(target, offset){
		return this.ribbon_order.indexOf(this.getRibbon(target, offset))
	},



	/******************************************************** Edit ***/

	// Focus an image -- make it current...
	//
	// This is signature compatible with .getImage(..), see it for more
	// info...
	focusImage: function(target, mode, list){
		var current = this.getImage(target, mode, list)
		if(this.order.indexOf(current) >= 0){
			this.current = current
		}
		return this
	},	

	// Focus a ribbon -- focus an image in that ribbon
	//
	// NOTE: target must be .getRibbon(..) compatible.
	focusRibbon: function(target){
		var cur = this.getRibbonOrder()
		var ribbon = this.getRibbon(target)

		// nothing to do...
		if(target == null || ribbon == null){
			return this
		}

		var t = this.getRibbonOrder(ribbon)

		// XXX revise this...
		var direction = t < cur ? 'before' : 'after'

		var img = this.getImage(ribbon, direction)

		// first/last image...
		if(img == null){
			img = direction == 'before' 
				? this.getImage('first', ribbon) 
				: this.getImage('last', ribbon)
		}

		return this.focusImage(img)
	},


	// Shorthand methods...
	//
	// XXX should these be here???
	focusBaseRibbon: function(){ return this.focusImage(this.base) },
	focusImageOffset: function(offset){
		offset = offset == null ? 0 : offset

		var min = -this.getImageOrder('ribbon')
		var max = this.getImages('current').length-1

		offset = Math.max(min, Math.min(max, offset))

		return this.focusImage('current', offset)
	},
	nextImage: function(){ return this.focusImageOffset(1) }, // Gen2
	prevImage: function(){ return this.focusImageOffset(-1) }, // Gen2
	firstImage: function(){ return this.focusImage('first') }, // Gen2
	lastImage: function(){ return this.focusImage('last') }, // Gen2
	focusRibbonOffset: function(offset){
		var c = this.getRibbonOrder()
		var t = c+offset
		t = Math.max(0, Math.min(this.ribbon_order.length-1, t))

		// NOTE: the modes here are different for directions to balance
		// 		up/down navigation...
		return this.focusImage('current', (t < c ? 'after' : 'before'), t)
	},
	nextRibbon: function(){ return this.focusRibbonOffset(1) }, // Gen2
	prevRibbon: function(){ return this.focusRibbonOffset(-1) }, // Gen2

	// Set base ribbon...
	//
	// This is signature compatible with .getRibbon(..), see it for more
	// info...
	setBase: function(target, offset){
		var base = this.getRibbon(target, offset)
		if(base in this.ribbons){
			this.base = base
		}
		return this
	},

	// Create empty ribbon...
	//
	// If mode is 'below' this will create a new ribbon below the target,
	// otherwise the new ribbon will be created above.
	newRibbon: function(target, mode){
		var gid = this.newGid()
		var i = this.getRibbonOrder(target)

		i = mode == 'below' ? i+1 : i

		this.ribbon_order.splice(i, 0, gid)
		this.ribbons[gid] = []

		return gid
	},

	// Merge ribbons
	//
	//	.mergeRibbons('all')
	//	.mergeRibbons(ribbon, ribbon, ...)
	//		-> data
	//
	// If 'all' is the first argument, this will merge all the ribbons.
	//
	// This will merge the ribbons into the first.
	mergeRibbons: function(target){
		var targets = target == 'all' ? this.ribbon_order.slice() : arguments
		var base = targets[0]

		for(var i=1; i < targets.length; i++){
			var r = targets[i]
			this.makeSparseImages(this.ribbons[r], this.ribbons[base])

			delete this.ribbons[r]
			this.ribbon_order.splice(this.ribbon_order.indexOf(r), 1)
		}

		// update .base if that gid got merged in...
		if(this.ribbon_order.indexOf(this.base) < 0){
			this.base = base
		}

		return this
	},

	// Update image position via .order...
	//
	//	Full sort
	//	.updateImagePositions()
	//		-> data
	//
	//	Reposition item(s)
	//	.updateImagePositions(gid|index)
	//		-> data
	//
	//	Reposition item(s) and the item(s) they replace
	//	.updateImagePositions(gid|index, 'keep')
	//		-> data
	//
	//	Hide item(s) from lists
	//	.updateImagePositions(gid|index, 'hide')
	//		-> data
	//
	//	Remove item(s) from lists
	//	.updateImagePositions(gid|index, 'remove')
	//		-> data
	//
	// NOTE: hide will not change the order of other items while remove 
	// 		will do a full sort...
	// NOTE: in any case other that the first this will not try to 
	// 		correct any errors.
	//
	// XXX needs more thought....
	// 		do we need to move images by this???
	updateImagePositions: function(from, mode){
		from = from != null && from.constructor !== Array ? [from] : from

		this.eachImageList(function(cur, key, set){
			set = this[set]

			// resort...
			if(from == null){
				set[key] = this.makeSparseImages(cur)

			// remove/hide elements...
			} else if(mode == 'remove' || mode == 'hide'){
				from.forEach(function(g){
					delete cur[cur.indexOf(g)]
				})
				// if we are removing we'll also need to resort...
				if(mode == 'remove'){
					set[key] = this.makeSparseImages(cur)
				}

			// place and keep existing...
			} else if(mode == 'keep'){
				set[key] = this.makeSparseImages(from, cur, true)

			// only place...
			} else {
				set[key] = this.makeSparseImages(from, cur)
			}
		})

		return this
	},

	// Reverse .order and all the ribbons...
	//
	// NOTE: this sorts in-place
	//
	// NOTE: this depends on setting length of an array, it works in 
	// 		Chrome but will it work the same in other systems???
	reverseImages: function(){
		var order = this.order
		order.reverse()
		var l = order.length

		var that = this
		this.eachImageList(function(lst){
			lst.length = l
			lst.reverse()
		})

		return this
	},

	// Sort images in ribbons via .order...
	//
	// NOTE: this sorts in-place
	// NOTE: this will not change image order
	sortImages: function(cmp){

		// sort the order...
		this.order.sort(cmp)
		
		return this.updateImagePositions()
	},

	reverseRibbons: function(){
		this.ribbon_order.reverse()
	},


	// Gather gids into a connected section...
	//
	// The section is positioned relative to a reference gid, which also
	// determines the ribbon.
	//
	// 	Gather images relative to current image 
	// 	.gatherImages(images)
	// 	.gatherImages(images, 'current')
	// 		-> data
	//
	// 	Gather images relative to image/ribbon
	// 	.gatherImages(images, image|ribbon)
	// 		-> data
	//
	// 	Gather images relative to first/last image in given images
	// 	.gatherImages(images, 'first')
	// 	.gatherImages(images, 'last')
	// 		-> data
	//
	// 	Gather images relative to image/ribbon and place them strictly 
	// 	after (default) or before it...
	// 	.gatherImages(images, 'auto')
	// 	.gatherImages(images, 'after')
	// 	.gatherImages(images, 'before')
	// 	.gatherImages(images, image|ribbon, 'auto')
	// 	.gatherImages(images, image|ribbon, 'after')
	// 	.gatherImages(images, image|ribbon, 'before')
	// 		-> data
	//
	// 	Gather images only in one explicit dimension...
	// 	.gatherImages(.., 'horizontal')
	// 	.gatherImages(.., 'vertical')
	// 		-> data
	//
	// NOTE: if mode is 'vertical' then place is ignored...
	//
	// XXX this is very similar to .placeImage(..) should keep one...
	gatherImages: function(gids, reference, place, mode){
		gids = this.makeSparseImages(gids)

		var that = this

		var modes = /vertical|horizontal|both/
		var placements = /before|after|auto/

		// parse arguments...
		var  _mode = mode
		mode = modes.test(reference) ? reference
			: modes.test(place) ? place
			: mode
		mode = mode || 'both'

		place = placements.test(reference) ? reference
			: placements.test(_mode) ? _mode
			: place
		place = place == 'auto' ? null : place

		reference = modes.test(reference) || placements.test(reference) ? null : reference
		reference = reference == 'first' ? gids[0]
			: reference == 'last' ? gids.slice(-1)[0]
			: reference

		//console.log('reference:', reference, '\nplace:', place, '\nmode:', mode)

		// shift all gids to a reference ribbon...
		if(mode == 'both' || mode == 'vertical'){
			var ref = this.getRibbon(reference)

			var ribbons = this.ribbons
			gids.forEach(function(gid, i){
				var r = that.getRibbon(gid)

				// do the move...
				if(r != ref){
					ribbons[ref][i] = gid
					delete ribbons[r][i]
				}
			})
		}

		// shift all gids to a reference image...
		if(mode == 'both' || mode == 'horizontal'){
			var order = this.order
			var ref = this.getImage(reference)

			place = gids.indexOf(ref) < 0 && place == null ? 'after' : place

			// NOTE: the reference index will not move as nothing will 
			// 		ever change it's position relative to it...
			var ri = this.order.indexOf(ref)
			var l = ri

			gids.forEach(function(gid){
				if(gid == ref){
					return
				}

				// we need to get this live as we are moving images around...
				var f = this.order.indexOf(gid)

				// target is left of the reference -- place at reference...
				// NOTE: we are moving left to right, thus the final order
				// 		of images will stay the same.
				if(f < ri){
					if(place == 'after'){
						order.splice(l, 0, order.splice(f, 1)[0])

					} else {
						order.splice(ri-1, 0, order.splice(f, 1)[0])
					}

				// target is right of the reference -- place each new image
				// at an offset from reference, the offset is equal to 
				// the number of the target image the right of the reference
				} else {
					if(place == 'before'){
						order.splice(l, 0, order.splice(f, 1)[0])
						l += 1

					} else {
						l += 1
						order.splice(l, 0, order.splice(f, 1)[0])
					}
				}
			})

			// NOTE: this is cheating, but if it's fast and simple I do
			// 		not care ;)
			this.updateImagePositions()
		}

		return this
	},
	
	// Place image at position... 
	//
	//	Place imagess at order into ribbon...
	//	.placeImage(images, ribbon, order)
	//		-> data
	//
	//	Place images at order but do not touch ribbon position...
	//	.placeImage(images, 'keep', order)
	//		-> data
	//
	//	Place images to ribbon but do not touch order...
	//	.placeImage(images, ribbon, 'keep')
	//		-> data
	//
	// images is .getImage(..) compatible or a list of compatibles.
	// ribbon is .getRibbon(..) compatible or 'keep'.
	// order is .getImageOrder(..) compatible or 'keep'.
	//
	// NOTE: if images is a list, all images will be placed in the order
	// 		they are given.
	// NOTE: this can affect element indexes, thus for example element 
	// 		at input order may be at a different position after this is 
	// 		run.
	//
	// XXX this is very similar to .gatherImages(..) should keep one...
	placeImage: function(images, ribbon, order, mode){
		var that = this
		mode = mode || 'before'

		// XXX how do we complain and fail here??
		if(mode != 'before' && mode != 'after'){
			console.error('invalid mode:', mode)
			return this
		}

		images = images instanceof Array ? images : [images]
		images = images.map(function(img){ return that.getImage(img) })

		// vertical shift...
		// NOTE: this will gather all the images to the target ribbon...
		if(ribbon != 'keep'){
			var to = this.getRibbon(ribbon)
			this.makeSparseImages(images)
				.forEach(function(img, f){
					var from = that.getRibbon(img)
					if(from != to){
						that.ribbons[to][f] = img
						delete that.ribbons[from][f]
					}
				})
		}
		
		// horizontal shift...
		// NOTE: this will gather the images horizontally...
		if(order != 'keep'){
			var reorder = false
			order = this.getImage(this.getImageOrder(order) 
				+ (mode == 'after' ? 1 : 0))
			images.forEach(function(img){
				var f = that.order.indexOf(img)
				var t = order == null ? 
					// special case: add after last element...
					that.order.length 
					: that.order.indexOf(order)

				if(f > t){
					that.order.splice(t, 0, that.order.splice(f, 1)[0])
					reorder = true

				} else if(f < t){
					// NOTE: need to compensate for when we are remoing 
					// 		an image before where we want to place it...
					that.order.splice(t-1, 0, that.order.splice(f, 1)[0])
					reorder = true
				}
			})

			// update the rest of sparse data...
			if(reorder){
				this.updateImagePositions()
			}
		}

		return this
	},

	// Shift image...
	//
	//	Shift image to target position:
	//	.shiftImage(from, gid|order|ribbon)
	//	.shiftImage(from, gid|order|ribbon, 'before')
	//	.shiftImage(from, gid|order|ribbon, 'after')
	//		-> data
	//
	//	Shift image by offset:
	//	.shiftImage(from, offset, 'offset')
	//		-> data
	//
	//
	// order is expected to be ribbon order.
	//
	// from must be one of:
	// 	- a .getImage(..) compatible object. usually an image gid, order,
	// 	  or null, see .getImage(..) for more info.
	// 	- a list of .getImage(..) compatible objects.
	//
	// When shifting a set of gids horizontally this will pack them 
	// together in order.
	//
	//
	// NOTE: this will not create new ribbons.
	// NOTE: .getImage(..) defaults to 'before' thus this to defaults
	// 		to 'after'
	//
	// XXX needs better docs...
	shiftImage: function(from, target, mode, direction){
		from = from == null || from == 'current' ? this.current : from
		from = from.constructor !== Array ? [from] : from

		var place

		// target is an offset...
		if(mode == 'offset'){
			if(target > 0){
				var t = this.getImage(from.slice(-1)[0], target)
					|| this.getImage('last', from.slice(-1)[0])
				place = from.indexOf(t) >= 0 ? null : 'after'
			} else {
				var t = this.getImage(from[0], target) 
					|| this.getImage('first', from[0])
				place = from.indexOf(t) >= 0 ? null : 'before'
			}

		// target is ribbon index...
		} else if(typeof(target) == typeof(123)){
			var t = this.getImage(this.getRibbon(target))
				// in case of an empty ribbon...
				|| this.getRibbon(target)
			place = mode || 'after'

		// target is an image...
		} else {
			var t = this.getImage(target)
			place = mode || 'after'
		}

		return this.gatherImages(from, t, place, direction)
	},

	// Shorthand actions...
	//
	// NOTE: none of these change .current
	shiftImageLeft: function(gid){ return this.shiftImage(gid, -1, 'offset') },
	shiftImageRight: function(gid){ return this.shiftImage(gid, 1, 'offset') },
	// NOTE: these will not affect ribbon order.
	// NOTE: these will create new ribbons when shifting from first/last
	// 		ribbons respectively.
	// NOTE: these will remove an empty ribbon after shifting the last 
	// 		image out...
	// NOTE: if base ribbon is removed this will try and reset it to the
	// 		ribbon above or the top ribbon...
	shiftImageUp: function(gid){ 
		var g = gid.constructor === Array ? gid[0] : gid
		var r = this.getRibbonOrder(g)
		// check if we need to create a ribbon here...
		if(r == 0){
			r += 1
			this.newRibbon(g)
		}
		var res = this.shiftImage(gid, r-1, 'vertical') 
		// clear empty ribbon...
		r = r == 0 ? 1 : r
		if(this.ribbons[this.ribbon_order[r]].len == 0){
			this.clear(this.ribbon_order[r])
		}
		return res
	},
	shiftImageDown: function(gid){ 
		var g = gid.constructor === Array ? gid[0] : gid
		var r = this.getRibbonOrder(g)
		// check if we need to create a ribbon here...
		if(r == this.ribbon_order.length-1){
			this.newRibbon(g, 'below')
		}
		var res = this.shiftImage(gid, r+1, 'vertical') 
		// clear empty ribbon...
		if(this.ribbons[this.ribbon_order[r]].len == 0){
			this.clear(this.ribbon_order[r])
		}
		return res
	},

	// Shift ribbon vertically...
	//
	// 	Shift ribbon to position...
	// 	.shiftRibbon(gid, gid)
	// 	.shiftRibbon(gid, gid, 'before')
	// 	.shiftRibbon(gid, gid, 'after')
	// 		-> data
	// 		NOTE: 'before' is default.
	//
	// 	Shift ribbon by offset...
	// 	.shiftRibbon(gid, offset, 'offset')
	// 		-> data
	//
	// XXX test...
	shiftRibbon: function(gid, to, mode){
		var i = this.getRibbonOrder(gid)

		// to is an offset...
		if(mode == 'offset'){
			to = i + to

		// to is a gid...
		} else {
			to = this.getRibbonOrder(to)
			if(mode == 'after'){
				to += 1
			}
		}

		// normalize to...
		to = Math.max(0, Math.min(this.ribbon_order.length-1, to))

		this.ribbon_order.splice(to, 0, this.ribbon_order.splice(i, 1)[0])

		return this
	},

	// Shorthand actions...
	//
	// XXX should these be here??
	shiftRibbonUp: function(gid){ return this.shiftRibbon(gid, -1, 'offset') },
	shiftRibbonDown: function(gid){ return this.shiftRibbon(gid, 1, 'offset') },


	/****************************************************** Groups ***/
	// A group is a small set of images...
	//
	// All images in a group are in ONE ribbon but can be at any location
	// in order.
	//
	// It can be in one of two states:
	// 	- collapsed
	// 		- group images are not loaded
	// 		- group cover is loaded
	// 	- expanded
	// 		- group cover is not loaded
	// 		- group images are loaded
	//
	// XXX group cover -- which image and should this question be asked
	// 		on this level???
	//
	// XXX experimental...
	// 		...not sure if storing groups in .groups here is the right 
	// 		way to go...
	// XXX need to set default cover... (???)
	// XXX should these be here or in a separate class???
	
	// Test if a gid is a group gid...
	//
	isGroup: function(gid){
		gid = gid == null ? this.getImage() : gid
		return this.groups != null ? gid in this.groups : false
	},

	// Get a group gid...
	//
	// This will check if the given gid is contained in a group and 
	// return the group's gid or null if the image is ungrouped.
	//
	getGroup: function(gid){
		gid = gid == null ? this.getImage() : gid
		if(this.isGroup(gid)){
			return gid
		}
		if(this.groups == null){
			return null
		}

		for(var k in this.groups){
			if(this.groups[k].indexOf(gid) >= 0){
				return k
			}
		}

		return null
	},

	// Get loaded gid representing a group...
	//
	// This will either be a group gid if collapsed or first loaded gid
	// from within if group expanded...
	//
	// NOTE: this will get the first loaded image of a group regardless
	// 		of group/image gid given...
	// 		Thus, this will return the argument ONLY if it is loaded.
	// NOTE: this does not account for current position in selecting an
	// 		image from the group...
	getLoadedInGroup: function(gid){
		var group = this.getGroup(gid)

		// not a group...
		if(group == null){
			return null
		}

		// get the actual image gid...
		var gids = gid == group ? this.groups[group] : [gid]

		// find either
		for(var k in this.ribbons){
			if(this.ribbons[k].indexOf(group) >= 0){
				return group
			}
			// get the first loaded gid in group...
			for(var i=0; i<gids.length; i++){
				if(this.ribbons[k].indexOf(gids[i]) >= 0){
					return gids[i]
				}
			}
		}

		// nothing loaded...
		return null
	},

	// Group image(s)...
	//
	// 	Group image(s) into a new group
	// 	.group(image(s))
	// 		-> data
	//
	// 	Group image(s) into a specific group, creating one if needed
	// 	.group(image(s), group)
	// 		-> data
	//
	// NOTE: image(s) can be either a single image gid or a list of gids.
	// NOTE: group intersections are not allowed, i.e. images can not 
	// 		belong to two groups.
	// NOTE: nesting groups is supported. (XXX test)
	//
	// XXX test if generated gid is unique...
	group: function(gids, group){
		gids = gids == null ? this.getImage() : gids
		gids = gids.constructor !== Array ? [gids] : gids
		// XXX not safe -- fast enough and one can generate two identical
		// 		gids...
		group = group == null ? this.newGid('G' + Date.now()) : group

		if(this.groups == null){
			this.groups = {}
		}

		// take only images that are not part of a group...
		if(this.__group_index !== false){
			var that = this
			var index = this.__group_index || []
			Object.keys(this.groups).forEach(function(k){ 
				that.makeSparseImages(that.groups[k], index) 
			})
			gids = gids.filter(function(g){ return index.indexOf(g) < 0 })
			// update the index...
			this.__group_index = this.makeSparseImages(gids, index)
		}

		// no images no group...
		// XXX should we complain??
		if(gids.length == 0){
			return this
		}

		// existing group...
		if(group in this.groups){
			var lst = this.makeSparseImages(this.groups[group])
			var place = false

		// new group...
		} else {
			var lst = []
			var place = true
		}

		this.groups[group] = this.makeSparseImages(gids, lst)

		// when adding to a new group, collapse only if group is collapsed...
		if(this.getRibbon(group) != null){
			this.collapseGroup(group)
		}

		return this
	},

	// Ungroup grouped images
	//
	// The containing group will be removed placing the images in the 
	// ribbon where the group resided.
	//
	ungroup: function(group){
		group = this.getGroup(group)

		if(group == null){
			return this
		}

		this.expandGroup(group)

		// cleanup the index if it exists...
		if(this.__group_index){
			var index = this.__group_index
			this.groups[group].forEach(function(g){
				delete index[index.indexOf(g)]
			})
		}

		// remove the group...
		delete this.groups[group]
		this.clear(group)

		return this
	},

	// Expand a group...
	//
	// This will show the group images and hide group cover.
	//
	expandGroup: function(groups){
		groups = groups == null ? this.getGroup()
			: groups == 'all' || groups == '*' ? Object.keys(this.groups)
			: groups
		groups = groups.constructor !== Array ? [groups] : groups

		var that = this
		groups.forEach(function(group){
			group = that.getGroup(group)
			
			if(group == null){
				return
			}

			var lst = that.groups[group]
			var r = that.getRibbon(group)

			// already expanded...
			if(r == null){
				return
			}

			// place images...
			lst.forEach(function(gid, i){
				that.ribbons[r][i] = gid
			})

			if(that.current == group){
				that.current = lst.compact()[0]
			}

			// hide group...
			delete that.ribbons[r][that.order.indexOf(group)]
		})

		return this
	},

	// Collapse a group...
	//
	// This is the opposite of expand, showing the cover and hiding the
	// contained images.
	//
	// NOTE: if group gid is not present in .order it will be added and 
	// 		all data sets will be updated accordingly...
	collapseGroup: function(groups, safe){
		groups = groups == null ? this.getGroup() 
			: groups == 'all' || groups == '*' ? Object.keys(this.groups)
			: groups
		groups = groups.constructor !== Array ? [groups] : groups
		safe = safe || false

		var that = this
		groups.forEach(function(group){
			group = that.getGroup(group)
			
			if(group == null){
				return
			}

			var lst = that.groups[group]

			if(lst.len == 0){
				return
			}

			var r = that.getRibbon(group)
			r = r == null ? that.getRibbon(that.groups[group].compact()[0]) : r

			// if group is not in olace place it...
			var g = that.order.indexOf(group)
			if(g == -1){
				g = that.order.indexOf(that.groups[group].compact(0)[0])

				// update order...
				that.order.splice(g, 0, group)

				if(safe){
					that.updateImagePositions()

				// NOTE: if the data is not consistent, this might be 
				// 		destructive, but this is faster...
				} else {
					// update lists...
					that.eachImageList(function(lst){
						// insert a place for the group...
						lst.splice(g, 0, undefined)
						delete lst[g]
					})
				}
			}

			// remove grouped images from ribbons...
			lst.forEach(function(gid, i){
				Object.keys(that.ribbons).forEach(function(r){
					delete that.ribbons[r][i]
				})
			})

			// insert group...
			that.ribbons[r][that.order.indexOf(group)] = group

			// shift current...
			if(lst.indexOf(that.current) >= 0){
				that.current = group
			}
		})

		return this
	},

	// Croup current group...
	//
	cropGroup: function(target){
		var target = this.getImage(target)
		var group = this.getGroup(target)
		
		// not a group...
		if(group == null){
			return
		}

		// group is expanded -- all the images we need are loaded...
		if(target != group){
			var res = this.crop(this.groups[group])

		// group collapsed -- need to get the elements manually...
		} else {
			var r = this.getRibbon(target)
			var res = this.crop(this.groups[group])
			res.ribbon_order = [r]
			res.ribbons[r] = this.groups[group].slice()
			res.focusImage(this.current, 'before', r)
		}
		
		return res
	},



	/********************************************* Data-level edit ***/

	// Split data into sections...
	//
	// 	.split(target, ..)
	// 	.split([target, ..])
	// 		-> list
	//
	//
	// This will "split" the data just before each target, i.e. target N
	// will get the head of N+1 section.
	//
	// 		 Data							 Data		 Data
	// 		[...oooooXooooo...]		->		[...ooooo]	[Xooooo...]
	// 				 ^									 ^
	// 			  target							  target
	//
	//
	// Special case: target is .order.length
	// This will indicate that the last data section will be empty.
	//
	// 		 Data							 Data		 		 Data
	// 		[...oooooooooooo]		->		[...oooooooooooo]	[]
	// 						^								^
	//					 target							 target
	//
	//
	// Targets MUST be listed in order of occurrence.
	//
	// Returns list of split sections.
	//
	// NOTE: this will not affect the original data object...
	// NOTE: this might result in empty ribbons, if no images are in a 
	// 		given ribbon in the section to be split...
	// NOTE: target must be a .getImage(..) compatible value.
	// NOTE: if no target is given this will assume the current image.
	//
	// XXX do .eachImageList(..)
	split: function(target){
		if(arguments.length > 1){
			target = Array.apply(null, arguments)
		} else if(target == null 
				|| target.constructor !== Array){
			target = [ target ]
		}
		var res = []
		var tail = this.clone()
		var that = this

		// NOTE: we modify tail here on each iteration...
		target.forEach(function(i){
			i = i >= that.order.length 
				? tail.order.length
				: tail.getImageOrder(that.getImage(i))
			var n = new Data()
			n.base = tail.base
			n.ribbon_order = tail.ribbon_order.slice()
			n.order = tail.order.splice(0, i)
			for(var k in tail.ribbons){
				n.ribbons[k] = tail.ribbons[k].splice(0, i)
			}
			n.current = n.order.indexOf(tail.current) >= 0 ? tail.current : n.order[0]
			
			res.push(n)
		})

		// update .current of the last element...
		tail.current = tail.order.indexOf(tail.current) >= 0 ? tail.current : tail.order[0]

		res.push(tail)
		return res
	},

	// Join data objects into the current object...
	//
	//	.join(data, ..)
	//	.join([ data, .. ])
	//		-> data with all the other data objects merged in, aligned 
	//			via base ribbon.
	//
	//	.join(align, data, ..)
	//	.join(align, [ data, .. ])
	//		-> data with all the other data objects merged in, via align
	//
	//
	// align can be:
	// 	'base'		- base ribbons (default)
	// 	'top'		- top ribbons
	// 	'bottom'	- bottom ribbons
	//
	// NOTE: data can be both a list of arguments or an array.
	// NOTE: this will merge the items in-place, into the method's object;
	// 		if it is needed to keep the original intact, just .clone() it...
	//
	// XXX test more complex cases...
	join: function(){
		var args = Array.apply(null, arguments)
		var align = typeof(args[0]) == typeof('str') ? args.splice(0, 1)[0] : 'base'
		args = args[0].constructor === Array ? args[0] : args

		var base = this

		args.forEach(function(data){
			// calculate align offset...
			if(align == 'base'){
				var d = base.getRibbonOrder('base') - data.getRibbonOrder('base')

			} else if(align == 'top'){
				var d = 0

			} else if(align == 'bottom'){
				var d = base.ribbon_order.length - data.ribbon_order.length
			}

			var t = 0

			// merge order...
			base.order = base.order.concat(data.order)

			// merge ribbons...
			// NOTE: this is a special case, so we do not handle it in 
			// 		the .eachImageList(..) below. the reason being that
			// 		ribbons can be merged is different ways.
			for(var i=0; i < data.ribbon_order.length; i++){
				var g = data.ribbon_order[i]
				var r = data.ribbons[g]

				// push the new ribbon just before the base...
				if(d < 0){
					// see if g is unique...
					if(g in base.ribbons || base.order.indexOf(g) >= 0){
						g = base.newGid()
					}
					base.ribbon_order.splice(t, 0, g)
					base.ribbons[g] = r
					t += 1
					d -= 1

				// append ribbons...
				} else if(d < base.ribbon_order.length){
					var tg = base.ribbon_order[d]
					base.ribbons[tg] = base.ribbons[tg].concat(r)

				// push the new ribbon to the end...
				} else {
					// see if g is unique...
					if(g in base.ribbons || base.order.indexOf(g) >= 0){
						g = base.newGid()
					}
					base.ribbon_order.push(g)
					base.ribbons[g] = r
				}

				d += 1
			}

			// merge other stuff...
			data.eachImageList(function(list, key, set){
				if(set == 'ribbons'){
					return
				}

				if(base[set] == null){
					base[set] = {key: base.makeSparseImages(list)}

				} else if(base[set][key] == null){
					base[set][key] = base.makeSparseImages(list)

				} else {
					base[set][key] = base.makeSparseImages(base[set][key].concat(list))
				}
			})
		})

		// XXX this is slow-ish...
		base.removeDuplicateGIDs()

		return base
	},

	// Align data to ribbon...
	//
	// NOTE: if either start or end is not given this will infer the 
	// 		missing values via the ribbon above.
	// NOTE: if either start or end is not given this can only align 
	// 		downward, needing a ribbon above the target to infer the 
	// 		values.
	//
	// XXX test
	alignToRibbon: function(ribbon, start, end){
		ribbon = ribbon == null ? this.base : this.getRibbon(ribbon)

		if(start == null || end == null){
			var r = this.getRibbonOrder(ribbon)
			// ribbon is top ribbon, nothing to do...
			if(r <= 0){
				return this
			}

			var above = this.getRibbon(r-1)
		}

		start = start == null 
			? this.getImageOrder('first', above)
			: this.getImageOrder(start)
		end = end == null 
			// NOTE: we need to exclude the last image in ribbon from 
			// 		the next section, this the offset.
			? this.getImageOrder('last', above)+1
			: this.getImageOrder(end)

		// split the data into three sections...
		var res = this.split(start, end)
		var rest = res.splice(1)

		// set the base ribbon on the middle section...
		rest[0].setBase(0)

		// join the resulting data to the base ribbon...
		res = res.join(rest)

		// transfer data to new data object...
		res.current = this.current
		res.base = this.base

		return res
	},

	// Crop the data...
	//
	// NOTE: this will not affect the original data object...
	// NOTE: this will not crop the .order...
	crop: function(list, flatten){
		var crop = this.clone()
		list = crop.makeSparseImages(list)

		if(!flatten){
			// place images in ribbons...
			for(var k in crop.ribbons){
				crop.ribbons[k] = crop.makeSparseImages(crop.ribbons[k].filter(function(_, i){
					return list[i] != null
				}))
			}

		// flatten the crop...
		} else {
			crop.ribbons = {}
			crop.ribbon_order = []
			crop.ribbons[crop.newRibbon()] = list
		}

		// clear empty ribbons...
		crop.clear('empty')

		// set the current image in the crop...
		var r = this.getRibbon()
		// if current ribbon is not empty get the closest image in it...
		if(r in crop.ribbons && crop.ribbons[r].length > 0){
			// XXX is this the correct way to do this???
			// 		...should we use direction???
			var target = crop.getImage(this.current, 'after', this.getRibbon())
				|| crop.getImage(this.current, 'before', this.getRibbon())

		// if ribbon got deleted, get the closest loaded image...
		} else {
			// XXX is this the correct way to do this???
			// 		...should we use direction???
			var target = crop.getImage(this.current, 'after', list)
				|| crop.getImage(this.current, 'before', list)
		}
		crop.focusImage(target)

		// XXX ???
		//crop.parent = this
		//crop.root = this.root == null ? this : this.root

		return crop
	},

	// Merge changes from crop into data...
	//
	// NOTE: this may result in empty ribbons...
	//
	// XXX what are we doing with new ribbons???
	// XXX sync ribbon order???
	// XXX should we be able to align a merged crop???
	// XXX test
	mergeCrop: function(crop){
		var that = this

		this.order = crop.order.slice()
		// XXX sync these???
		this.ribbon_order = crop.ribbon_order.slice()
		this.updateImagePositions()

		// 
		for(var k in crop.ribbons){
			var local = k in this.ribbons ? this.ribbons[k] : []
			var remote = crop.ribbons[k]

			this.ribbons[k] = local

			remote.forEach(function(e){
				// add gid to local ribbon...
				if(local.indexOf(e) < 0){
					this.shiftImage(e, k)
				}
			})
		}

		return this
	},

	// Create a sortable ribbon representation...
	//
	// 	.cropRibbons()
	// 	.cropRibbons(mode)
	// 		-> Data
	//
	// mode controls which images represent each ribbon, it can be:
	// 	'current'	- the closest to current image (default)
	// 	'first'		- first image in ribbon
	// 	'last'		- last ribbon in image
	// 	func(ribbon) -> gid
	// 				- a function that will get a ribbon gid and return 
	// 				  an apropriate image gid
	//
	// NOTE: the images used with a given string mode are the same as 
	// 		the returned via .getImage(mode, ribbon)
	//
	// 				v
	// 		 oooooo|a|ooooooo
	// 		ooooooo|A|ooooooooooooo		->		aAa
	// 			ooo|a|ooooo
	//
	//
	// The resulting data will contain a single ribbon, each image in 
	// which represents a ribbon in the source data.
	// This view allows convenient sorting of ribbons as images.
	//
	// The crop can be merged back into the source ribbon via the 
	// .mergeRibbonCrop(..) method.
	//
	// XXX should there be a way to set the base ribbon???
	// XXX should this link to .root and .parent data???
	// XXX do these belong here???
	cropRibbons: function(mode){
		mode = mode == null ? 'current' : mode
		var crop = new Data()

		// get image representations from each ribbon...
		var that = this
		var images = this.ribbon_order.map(
			typeof(mode) == typeof('str') 
				? function(e){ return that.getImage(mode, e) }
				: mode)

		var r = crop.newRibbon()

		crop.ribbons[r] = images
		crop.order = images.slice()
		crop.base = r
		crop.current = images[0]

		// XXX ???
		//crop.parent = this
		//crop.root = this.root == null ? this : this.root

		return crop
	},

	// Merge the sortable ribbon representation into data...
	//
	// This will take the image order from the crop and merge it into 
	// the .ribbon_order of this, essentially sorting ribbons...
	//
	// NOTE: see .cropRibbons(..) for more details...
	// NOTE: this will set the base to the top ribbon, but only if base
	// 		was the top ribbon (default) in the first place...
	// 		XXX is this correct???
	//
	// XXX should there be a way to set the base ribbon???
	mergeRibbonCrop: function(crop){
		var b = this.ribbon_order.indexOf(this.base)
		var that = this
		this.ribbon_order = crop.order.map(function(e){
			return that.getRibbon(e)
		})
		// set the base to the first/top ribbon...
		// XXX is this the correct way???
		if(b == 0){
			this.base = this.ribbon_order[0]
		}
		return this
	},


	// Clone/copy the data object...
	//
	clone: function(){
		var res = new Data()
		res.base = this.base
		res.current = this.current
		res.order = this.order.slice()
		res.ribbon_order = this.ribbon_order.slice()

		this.eachImageList(function(lst, k, s){
			if(res[s] == null){
				res[s] = {}
			}
			res[s][k] = this[s][k].slice()
		})

		return res
	},

	// Reset the state to empty...
	//
	_reset: function(){
		this.base = null
		this.current = null
		this.order = [] 
		this.ribbon_order = [] 
		this.ribbons = {}

		return this
	},

	// Remove duplicate gids...
	//
	// NOTE: this is slow-ish...
	removeDuplicateGIDs: function(){
		this.removeDuplicates(this.order)
		this.updateImagePositions()
		return this
	},



	/****************************************** JSON serialization ***/

	// Load data from JSON...
	//
	// NOTE: this loads in-place, use .fromJSON(..) to create new data...
	// XXX should this process defaults for unset values???
	loadJSON: function(data){
		data = typeof(data) == typeof('str') ? JSON.parse(data) : data
		data = formats.updateData(data)
		this.base = data.base
		this.current = data.current
		this.order = data.order.slice()
		this.ribbon_order = data.ribbon_order.slice()

		// make sparse lists...
		var that = this
		this.__gid_lists.forEach(function(s){
			if(data[s] == null){
				return
			}
			if(that[s] == null){
				that[s] = {}
			}
			for(var k in data[s]){
				that[s][k] = that.makeSparseImages(data[s][k])
			}
		})
		return this
	},

	// Generate JSON from data...
	//
	// NOTE: if mode is either 'str' or 'string' then this will stringify
	// 		the result...
	dumpJSON: function(mode){
		var res = {
			varsion: module.DATA_VERSION,
			base: this.base,
			current: this.current,
			order: this.order.slice(),
			ribbon_order: this.ribbon_order.slice(),
			ribbons: {},
		}
		// compact sets...
		this.eachImageList(function(lst, k, s){
			if(res[s] == null){
				res[s] = {}
			}
			res[s][k] = lst.compact()
		})
		if(mode == 'string' || mode == 'str'){
			res = JSON.stringify(res)
		}
		return res
	},
}



/*********************************************************************/

var DataWithTagsPrototype = {

	// XXX hate manual super calls...
	// 		....is there a way not to say DataPrototype here???
	__gid_lists: DataPrototype.__gid_lists.concat(['tags']),


	// Load tags from images...
	//
	// 	Merge image tags to data...
	// 	.tagsFromImages(images)
	// 		-> data
	//
	// 	Load image tags to data dropping any changes in data...
	// 	.tagsFromImages(images, 'reset')
	// 		-> data
	//
	// XXX should this be here???
	// XXX this depend on image structure...
	tagsFromImages: function(images, mode){
		if(mode == 'reset'){
			this.tags = {}
		}
		for(var gid in images){
			var img = images[gid]
			if(img.tags != null){
				this.tag(img.tags, gid)
			}
		}
		return this
			.sortTags()
	},

	// Transfer tags to images...
	//
	// 	Merge data tags to images...
	// 	.tagsToImages(images)
	// 	.tagsToImages(images, true)
	// 	.tagsToImages(images, 'merge')
	// 		-> data
	//
	// 	Merge data tags to images without buffering...
	// 	.tagsToImages(images, 'unbuffered')
	// 		-> data
	//
	// 	Reset image tags from data...
	// 	.tagsToImages(images, 'reset')
	// 		-> data
	//
	// XXX should this be here???
	// XXX this depend on image structure...
	// XXX should this use image API for creating images???
	tagsToImages: function(images, mode, updated){
		mode = mode || 'merge'
		updated = updated || []

		// mark gid as updated...
		var _updated = function(gid){
			if(updated != null && updated.indexOf(gid) < 0){
				updated.push(gid)
			}
		}
		// get or create an image with tags...
		// XXX should this use image API for creating???
		var _get = function(images, gid){
			var img = images[gid]
			// create a new image...
			if(img == null){
				img = images[gid] = {}
				_updated(gid)
			}

			var tags = img.tags
			// no prior tags...
			if(tags == null){
				tags = img.tags = []
				_updated(gid)
			}

			return img
		}

		// buffered mode...
		// 	- uses more memory
		// 	+ one write mer image
		if(mode != 'unbuffered'){
			// build the buffer...
			var buffer = {}
			this.tagsToImages(buffer, 'unbuffered')

			// reset mode...
			if(mode == 'reset'){
				// iterate through all the gids (both images and buffer/data)
				for(var gid in Object.keys(images)
									.concat(Object.keys(buffer))
									.unique()){
					// no tags / remove...
					if(buffer[gid] == null || buffer[gid].tags.length == 0){
						// the image exists and has tags...
						if(images[gid] != null && images[gid].tags != null){
							delete images[gid].tags
							_updated(gid)
						}

					// tags / set...
					} else {
						var img = _get(images, gid)
						var before = img.tags.slice()

						img.tags = buffer[gid].tags

						// check if we actually changed anything...
						if(!before.setCmp(img.tags)){
							_updated(gid)
						}
					}
				}

			// merge mode...
			} else {
				for(var gid in buffer){
					var img = _get(images, gid)
					var l = img.tags.length
					img.tags = img.tags.concat(buffer[gid].tags).unique()
					// we are updated iff length changed...
					// NOTE: this is true as we are not removing anything 
					// 		thus the length can only increase if changes are
					// 		made...
					if(l != img.tags.length){
						_updated(gid)
					}
				}
			}

		// unbuffered (brain-dead) mode...
		// 	+ no extra memory
		// 	- multiple writes per image (one per tag)
		} else {
			var tagset = this.tags
			for(var tag in tagset){
				tagset[tag].forEach(function(gid){
					var img = _get(images, gid)

					if(img.tags.indexOf(tag) < 0){
						img.tags.push(tag)
						_updated(gid)
					}
				})
			}
		}
		return this
	},


	// NOTE: this is here only to make the tags mutable...
	crop: function(){
		var crop = DataWithTagsPrototype.__proto__.crop.apply(this, arguments)

		// make the tags mutable...
		if(this.tags != null){
			crop.tags = this.tags
		}

		return crop
	},


	sortTags: function(){
		var that = this
		var tags = this.tags

		if(tags == null){
			return this
		}

		Object.keys(tags).forEach(function(tag){
			tags[tag] = that.makeSparseImages(tags[tag])
		})
		return this
	},

	tag: function(tags, gids){
		tags = tags.constructor !== Array ? [tags] : tags

		gids = gids == null || gids == 'current' ? this.getImage() : gids
		gids = gids.constructor !== Array ? [gids] : gids

		if(this.tags == null){
			this.tags = {}
		}

		var that = this
		var tagset = this.tags
		var order = this.order
		tags.forEach(function(tag){
			gids.forEach(function(gid){
				gid = that.getImage(gid)
				if(tagset[tag] == null){
					tagset[tag] = []
				}
				tagset[tag][order.indexOf(gid)] = gid
			})
		})

		return this
	},
	untag: function(tags, gids){
		if(this.tags == null){
			return this
		}
		tags = tags.constructor !== Array ? [tags] : tags

		gids = gids == null || gids == 'current' ? this.getImage() : gids
		gids = gids.constructor !== Array ? [gids] : gids

		var that = this
		var tagset = this.tags
		var order = this.order
		tags.forEach(function(tag){
			if(tag in tagset){
				gids.forEach(function(gid){
					if(tag in tagset){
						delete tagset[tag][order.indexOf(gid)]
					}
				})
				if(tagset[tag].len == 0){
					delete tagset[tag]
				}
			}
		})

		return this
	},

	// NOTE: this does not support multiple tags at this point...
	toggleTag: function(tag, gids, action){
		gids = gids == null || gids == 'current' ? this.getImage() : gids
		gids = gids.constructor !== Array ? [gids] : gids

		// tag all...
		if(action == 'on'){
			this.tag(tag, gids)
			return action

		// untag all...
		} else if(action == 'off'){
			this.untag(tag, gids)
			return action

		// get tag state...
		} else if(action == '?'){
			if(this.tags == null){
				return gids.length > 1 ? gids.map(function(gid){ return 'off' }) : 'off'
			}
			var that = this
			var tagset = this.tags
			var order = this.order
			var res = gids.map(function(gid){
				gid = that.getImage(gid)
				if(!(tag in tagset)){
					return 'off'
				}
				//return that.getTags(gid).indexOf(tag) != -1 ? 'on' : 'off'
				return tagset[tag][order.indexOf(gid)] != null ?  'on' : 'off'
			})

		// toggle each...
		} else {
			var that = this
			var tagset = this.tags
			var order = this.order
			var res = gids.map(function(gid){
				gid = that.getImage(gid)
				//var t = that.getTags(gid).indexOf(tag) != -1 ? 'off' : 'on'
				var t = tagset == null || !(tag in tagset) ? 'on'
					: tagset[tag][order.indexOf(gid)] == null ? 'on'
					: 'off'
				if(t == 'on'){
					that.tag(tag, gid)
				} else {
					that.untag(tag, gid)
				}
				return t
			})
		}

		return res.length == 1 ? res[0] : res
	},

	getTags: function(gids){
		gids = arguments.length > 1 ? [].slice.call(arguments) : gids
		gids = gids == null || gids == 'current' ? this.getImage() : gids
		gids = gids == null ? [] : gids
		gids = gids.constructor !== Array ? [gids] : gids

		if(this.tags == null){
			return []
		}

		var tags = this.tags
		var order = this.order

		// index the gids...
		var indexes = gids.map(function(gid){ return order.indexOf(gid) })

		// return only those tags that have at least one non-null gid index...
		return Object.keys(tags).filter(function(tag){
			return indexes.filter(function(i){ 
				return tags[tag][i] != null 
			}).length > 0
		})
	},

	// selectors...
	getTaggedByAny: function(tags){
		tags = arguments.length > 1 ? [].slice.call(arguments) : tags
		tags = tags.constructor !== Array ? [tags] : tags

		var res = []

		if(this.tags == null){
			return res
		}

		var that = this
		var tagset = this.tags
		tags.forEach(function(tag){
			if(tag in tagset){
				that.makeSparseImages(tagset[tag], res)
			}
		})

		return res.compact()
	},
	getTaggedByAll: function(tags){
		tags = arguments.length > 1 ? [].slice.call(arguments) : tags
		tags = tags.constructor !== Array ? [tags] : tags

		if(this.tags == null){
			return []
		}

		var index = []
		var l = tags.length

		// count how many of the tags each image is tagged...
		var that = this
		var tagset = this.tags
		tags.forEach(function(tag){
			if(tag in tagset){
				Object.keys(tagset[tag]).forEach(function(n){
					if(index[n] == null){
						index[n] = 1
					} else {
						index[n] += 1
					}
				})
			}
		})

		// filter only the images tagged by all of the tags...
		var order = this.order
		var res = []
		var i = index.indexOf(l)
		while(i != -1){
			res.push(order[i])
			delete index[i]

			i = index.indexOf(l)
		}

		return res
	},
}
DataWithTagsPrototype.__proto__ = DataPrototype



/*********************************************************************/

// Proxy Data API to one of the target data objects...
var DataProxyPrototype = {
	datasets: null,

	get order(){
		// XXX
	},

}
//DataProxyPrototype.__proto__ = DataPrototype
DataProxyPrototype.__proto__ = DataWithTagsPrototype


/*********************************************************************/

// Main Data object...
var BaseData = 
module.BaseData = 
object.makeConstructor('BaseData', 
		DataClassPrototype, 
		DataPrototype)


var DataWithTags = 
module.DataWithTags = 
object.makeConstructor('DataWithTags', 
		DataClassPrototype, 
		DataWithTagsPrototype)


var Data =
module.Data = DataWithTags



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })