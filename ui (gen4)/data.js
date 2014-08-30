/**********************************************************************
* 
* Data generation 4 implementation.
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> data')


var formats = require('formats')


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

// Data class methods and API...
//
var DataClassPrototype =
module.DataClassPrototype = {
	// NOTE: we consider the input list sorted...
	fromList: function(list){
		var res = new Data()
		// XXX make a real ribbon gid...
		var gid = res.newGid('R')
		res.order = list
		res.ribbon_order.push(gid)
		res.ribbons[gid] = list.slice()
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
var DataPrototype =
module.DataPrototype = {

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
	//
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

		gids.forEach(function(e){
			i = order.indexOf(e)
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

	// Generate a unique GID...
	//
	// XXX generate a real gid...
	newGid: function(prefix){
		prefix = prefix == null ? 'G' : prefix
		var gid = prefix + Date.now()
		while(this.ribbon_order.indexOf(gid) >= 0 
				|| this.order.indexOf(gid) >= 0
				|| this._gid_cache.indexOf(gid) >= 0){
			gid = prefix + Date.now()
		}
		// XXX not sure if this is a good idea...
		this._gid_cache.push(gid)
		return gid
	},
	


	/*********************************************** Introspection ***/

	// Get image
	//
	//	Get current image:
	//	.getImage()
	//	.getImage('current')
	// 		-> gid
	//
	// 	Check if image is loaded/exists:
	// 	.getImage(gid|order)
	// 	.getImage(gid|order, list|ribbon)
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if image does not exist.
	// 		NOTE: the second argument must not be an int (ribbon order)
	// 				to avoid conflict with the offset case below.
	//		NOTE: image order can be negative, thus getting an image 
	//				from the tail.
	//
	// 	Get first or last image in ribbon:
	// 	.getImage('first'[, ribbon])
	// 	.getImage('last'[, ribbon])
	// 		-> gid
	// 		-> null (XXX ???)
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
	// NOTE: if input gid is invalid this will return -1 (XXX is this good???)
	// NOTE: the folowing are equivalent:
	// 			D.getImage('current', -1, R)
	// 			D.getImage('before', R) 
	// 			D.getImage('current', 'before', R)
	// 		where D is a Data object and R a ribbon id/index different 
	// 		from the current ribbon (see next note for details).
	// NOTE: in before/after modes, if the target image is found then it
	// 		will be returned, use offset to explicitly get the image 
	// 		before/after target.
	//
	// XXX most of the complexity here comes from argument DSL parsing,
	// 		might be good to revise argument syntax and handling...
	getImage: function(target, mode, list){
		// no args...
		if(target == null && mode == null && list == null){
			return this.current
		}

		// current image shorthand...
		if(target == 'current'){
			target = this.current
		}

		// order -> gid special case...
		if(typeof(target) == typeof(123)){
			if(target >= this.order.length){
				return null
			}
			target = target < 0 ? 
					this.order[this.order.length+target] 
				: this.order[target]
		}

		// first/last special case...
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
		if(target in this.ribbons || target.constructor.name == 'Array'){
			list = target
			target = this.current
		} else if(['before', 'after', 'next', 'prev'].indexOf(target) >= 0){
			list = mode
			mode = target
			target = this.current
		}

		// normalize mode...
		if(mode != null 
				&& mode.constructor.name == 'Array' 
				|| mode in this.ribbons){
			list = mode
			mode = null
		}
		// relative mode and offset...
		if(typeof(mode) == typeof(123)){
			var offset = mode
			mode = offset < 0 ? 'before'
				: offset > 0 ? 'after'
				: mode
			offset = Math.abs(offset)
		} else {
			var offset = 0 
			mode = mode == null ? 'before' : mode
		}

		var i = this.order.indexOf(target)

		// invalid gid...
		// XXX need a better way to report errors...
		if(i == -1){
			return -1
		}

		// normalize the list to a sparse list of gids...
		list = list == null ? 
				this.ribbons[this.getRibbon(target)]
			: list.constructor.name == 'Array' ? 
				this.makeSparseImages(list)
			: this.ribbons[this.getRibbon(list)]

		var res = list[i]
		// we have a direct hit...
		if(res != null && offset == 0){
			return res
		}

		// prepare for the search...
		if(mode == 'before' || mode == 'prev'){
			var step = -1

		} else if(mode == 'after' || mode == 'next'){
			var step = 1

		// strict -- no hit means there is no point in searching...
		} else {
			return null
		}

		// skip the current elem...
		i += step
		// get the first non-null, also accounting for offset...
		// NOTE: we are using this.order.length here as ribbons might 
		// 		be truncated...
		for(; i >= 0 && i < this.order.length; i+=step){
			var cur = list[i]
			if(cur == null){
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
	// XXX for some reason negative target number (ribbon number) 
	// 		breaks this...
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
		} else if(target != null && target.constructor.name == 'Array'){
			var loaded = this.getImages('loaded')
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
		if(list == null){
			list = this.ribbons[this.getRibbon(target)] 
			list = list != null ? list.compact() : []
		}

		if(count == null){
			return list.slice()
		}

		target = this.getImage(target)
		var i = list.indexOf(target)

		// prepare to slice the list...
		if(mode == 'around'){
			count = count/2
			var from = i - Math.floor(count)
			var to = i + Math.ceil(count)

		} else if(mode == 'before'){
			// NOTE: we are shifting by 1 to include the target...
			var from = (i - count) + 1
			var to = i + 1

		} else if(mode == 'after'){
			var from = i
			var to = i + count

		} else {
			// XXX bad mode....
			return null
		}

		// get the actual bounds...
		from = Math.max(0, from)
		to = Math.min(list.length-1, to)

		return list.slice(from, to)
	},

	// Get ribbon...
	// 
	//	Get current ribbon:
	//	.getRibbon()
	//	.getRibbon('current')
	//		-> ribbon gid
	//
	//	Get base ribbon:
	//	.getRibbon('base')
	//		-> base ribbon gid
	//
	//	Get ribbon before/after current 
	//	.getRibbon('before')
	//	.getRibbon('after')
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
	getRibbon: function(target, offset){
		target = target == null ? this.current : target

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
			var i = this.order.indexOf(target)
			var k
			for(k in ribbons){
				if(ribbons[k][i] != null){
					o = this.ribbon_order.indexOf(k)
					break
				}
			}
		}

		if(o != null){
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
		var gid = this.newGid('R')
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

	// Sort images in ribbons via .order...
	//
	// NOTE: this sorts in-place
	sortImages: function(){
		var ribbons = this.ribbons
		for(k in ribbons){
			ribbons[k] = this.makeSparseImages(ribbons[k])
		}
		return this
	},

	// Reverse .order and all the ribbons...
	//
	// NOTE: this sorts in-place
	//
	// NOTE: this depends on setting length of an array, it works in 
	// 		Chrome but will it work the same in other systems???
	reverseImages: function(){
		this.order.reverse()
		var l = this.order.length
		for(k in ribbons){
			// XXX will this work everywhere???
			// NOTE: ribbons may be truncated, so we need to explicitly 
			// 		set their length...
			ribbons[k].length = l
			ribbons[k].reverse()
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
	// XXX check for corner cases:
	// 		- first/last in ribbon offset
	// 		- first/last in order offset
	// 		- first/last ribbon up/down
	// 			do we create new ribbons and round???
	// XXX when shifting groups of images we are using the first as a 
	// 		base, should we use last as a base for right shifting???
	// 		...another way to go could be using current as a reference
	// XXX test vertical..
	shiftImage: function(from, target, mode){
		from = from == null ? this.current : from
		from = from == 'current' ? this.current : from
		from = from.constructor.name != 'Array' ? [from] : from
		mode = mode == null ? 'after' : mode
		var ribbons = this.ribbons
		var order = this.order

		first = this.getImage(from[0])
		var f = order.indexOf(first)

		// target is an offset...
		if(mode == 'offset'){
			// XXX check that we can place an elem at first and last positions...
			var t = this.getImageOrder(this.getImage(first, target))

			var ribbon = this.getRibbon(first)

		// target is ribbon order...
		// XXX range checking???
		} else if(typeof(target) == typeof(123)){
			var t = f

			// normalize the target...
			// XXX is this the correct way to go???
			target = Math.max(0, Math.min(this.ribbon_order.length-1, target))

			var ribbon = this.ribbon_order[target]

		// target is a ribbon gid...
		} else if(target in this.ribbons){
			var t = f

			var ribbon = target

		// target is a gid or order...
		} else {
			target = this.getImage(target)
			var t = order.indexOf(target)
			t = mode == 'after' ? t+1 : t

			var ribbon = this.getRibbon(target)
		}

		var from_ribbon = this.getRibbon(first)

		// do vertical shift...
		// NOTE: image order here is not changed...
		if(ribbon != from_ribbon || from.length > 1){
			var that = this
			from.forEach(function(e){
				var i = order.indexOf(e)
				var from_ribbon = that.getRibbon(e)

				that.ribbons[ribbon][i] = e
				delete that.ribbons[from_ribbon][i]
			})
		}

		// do horizontal shift...
		// NOTE: images are packed horizontally together...
		if(f != t){
			for(var i=0; i<from.length; i++){
				f = order.indexOf(from[i])

				// update order...
				order.splice(t+i, 0, this.order.splice(f, 1)[0])

				// update ribbons...
				for(k in ribbons){
					ribbons[k].splice(t+i, 0, ribbons[k].splice(f, 1)[0])
				}
			}
		}

		return this 
	},

	// Shorthand actions...
	//
	// NOTE: shiftImageUp/shiftImageDown will create new ribbons when 
	// 		shifting from first/last ribbons respectively.
	// NOTE: none of these change .current
	//
	// XXX should these be here??
	shiftImageLeft: function(gid){ return this.shiftImage(gid, -1, 'offset') }, // Gen2
	shiftImageRight: function(gid){ return this.shiftImage(gid, 1, 'offset') }, // Gen2
	// XXX test...
	shiftImageUp: function(gid){ 
		var g = gid.constructor.name == 'Array' ? gid[0] : gid
		// check if we need to create a ribbon here...
		if(this.getRibbonOrder(g) == 0){
			this.newRibbon(g)
		}
		return this.shiftImage(gid, this.getRibbonOrder(g)-1) 
	},
	// XXX test...
	shiftImageDown: function(gid){ 
		var g = gid.constructor.name == 'Array' ? gid[0] : gid
		// check if we need to create a ribbon here...
		if(this.getRibbonOrder(g) == this.ribbon_order.length-1){
			this.newRibbon(g, 'below')
		}
		return this.shiftImage(gid, this.getRibbonOrder(g)+1) 
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
	shiftRibbonUp: function(gid){ return this.shiftRibbon(gid, -1, 'offset') }, // Gen2
	shiftRibbonDown: function(gid){ return this.shiftRibbon(gid, 1, 'offset') }, // Gen2



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
	// NOTE: this will not affect the original data object...
	// NOTE: this might result in empty ribbons, if no images are in a 
	// 		given ribbon in the section to be split...
	// NOTE: target must be a .getImage(..) compatible value.
	// NOTE: if no target is given this will assume the current image.
	split: function(target){
		if(arguments.length > 1){
			target = Array.apply(null, arguments)
		} else if(target == null 
				|| target.constructor.name != 'Array'){
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
		args = args[0].constructor.name == 'Array' ? args[0] : args

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
			for(var i=0; i < data.ribbon_order.length; i++){
				var g = data.ribbon_order[i]
				var r = data.ribbons[g]

				// push the new ribbon just before the base...
				if(d < 0){
					// see if g is unique...
					if(g in base.ribbons || base.order.indexOf(g) >= 0){
						g = base.newGid('R')
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
						g = base.newGid('R')
					}
					base.ribbon_order.push(g)
					base.ribbons[g] = r
				}

				d += 1
			}
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
	// NOTE: this may result in empty ribbons...
	// NOTE: this will not crop the .order...
	//
	// XXX should this link to .root and .parent data???
	crop: function(list){
		var crop = this.clone()
		list = crop.makeSparseImages(list)
		for(var k in crop.ribbons){
			crop.ribbons[k] = crop.makeSparseImages(crop.ribbons[k].filter(function(_, i){
				return list[i] != null
			}))
		}

		// XXX ???
		//crop.parent = this
		//crop.root = this.root == null ? this : this.root

		return crop
	},

	// Merge changes from crop into data...
	//
	// NOTE: this may result in empty ribbons...
	//
	// XXX sync ribbon order???
	// XXX should we be able to align a merged crop???
	// XXX test
	mergeCrop: function(crop){
		var that = this

		this.order = crop.order.slice()
		// XXX sync these???
		this.ribbon_order = crop.ribbon_order.slice()
		this.sortImages()

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
		res.ribbons = {}
		// make ribbons sparse...
		for(var k in this.ribbons){
			res.ribbons[k] = this.ribbons[k].slice()
		}
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

		this._gid_cache = []

		return this
	},

	// Remove duplicate gids...
	//
	// NOTE: this is slow-ish...
	removeDuplicateGIDs: function(){
		this.removeDuplicates(this.order)
		this.sortImages()
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
		this.ribbons = {}
		// make ribbons sparse...
		for(var k in data.ribbons){
			this.ribbons[k] = this.makeSparseImages(data.ribbons[k])
		}
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
		// compact ribbons...
		for(var k in this.ribbons){
			res.ribbons[k] = this.ribbons[k].compact()
		}
		if(mode == 'string' || mode == 'str'){
			res = JSON.stringify(res)
		}
		return res
	},
}



/*********************************************************************/

// Main Data object...
//
var Data = 
module.Data =
function Data(json){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Data'){
		return new Data(json)
	}

	// load initial state...
	if(json != null){
		this.loadJSON(json)
	} else {
		this._reset()
	}

	return this
}
Data.__proto__ = DataClassPrototype
Data.prototype = DataPrototype
Data.prototype.constructor = Data



/*********************************************************************/

// XXX keep this here or move this to a different module???
module.setupActionHandlers = function(context){
	// XXX
	context.on('focusImage', function(evt, img){ 
	})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
