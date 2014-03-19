/**********************************************************************
* 
*
*
**********************************************************************/

// General format info...
//
// Version format:
// 	<major>.<minor>
//
// Major version change mean a significant incompatibility.
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
// 	none - Gen1 data format, mostly experimental,
// 			- has no explicit version set,
// 			- not used for real data.
// 	2.0 - Gen3 data format, still experimental,
// 			- completely new and incompatible structure,
// 			- use convertDataGen1(..) to convert Gen1 to 2.0 
// 			- used for my archive, not public,
// 			- auto-convert form gen1 on load...
// 	2.1 - Minor update to format spec,	
// 			- MARKED now maintained sorted, live,
// 			- will auto-sort marks on load of 2.0 data and change 
// 			  data version to 2.1, will need a re-save,
// 	2.2 - Minor update to how data is handled and saved
// 			- now DATA.current is saved separately in current.json,
// 			  loading is done from current.json and if not found from
// 			  data.json.
// 			  the file is optional.
// 			- data, marks, bookmarks, tags are now saved only if updated
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
// 	3.0	- Gen4 DATA format, introduced several backwards incompatible 
// 		cahnges:
// 			- added ribbon GIDs, .ribbons now is a gid indexed object
// 			- added .ribbon_order
// 			- added base ribbon
// 			- ribbons are now sparse in memory but can be compact when
// 			  serialized.
// 			- auto-convert from gen1 (no version) and gen3 (2.*) on load
//
//
// NOTE: Gen1 and Gen3 refer to code generations rather than data format
// 		iterations, Gen2 is skipped here as it is a different project 
// 		(PortableMag) started on the same code base as ImageGrid.Viewer
// 		generation 1 and advanced from there, backporting some of the 
// 		results eventually formed Gen3...
//
//



/*********************************************************************/

// Data class methods and API...
//
var DataClassPrototype = {
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
		return new Data().loadJSON(data)
	},
}



// Data object methods and API...
//
// DATA format:
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
//	 	NOTE: this list may contain gids not loaded at the moment, a 
//	 		common case for this is when data is cropped.
//
// 	.ribbon_order
// 		List of ribbon gids setting the ribbon order.
//
// 		format:
// 			[ gid, .. ]
//
// 	.ribbons
// 		Dict of ribbons, indexed by ribbon gid, each ribbon is a sparse
// 		list of image gids.
//
// 		format:
// 			{ gid: [ gid, .. ], .. }
//
// 		NOTE: ribbons are sparse...
//
var DataPrototype = {
	_reset: function(){
		this.base = null
		this.current = null
		this.order = [] 
		this.ribbon_order = [] 
		this.ribbons = {}

		this._gid_cache = []
	},

	// util methods...
	compactSparseList: function(list){
		return list.filter(function(){return true})
	},
	makeSparseImages: function(gids, target){
		target = target == null ? [] : target
		order = this.order

		gids.forEach(function(e){
			i = order.indexOf(e)
			if(i >= 0){
				target[i] = e
			}
		})

		return target
	},
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
	
	// This is signature compatible with .getImage(..), see it for more
	// info...
	//
	// XXX do we need more specific focus operations like:
	// 		.focusImageOffset(offset)
	// 			XXX reference impelementation:
	// 				return this.focusImage('current', offset)
	// 		.focusRibbonOffset(offset)
	// 			XXX reference impelementation:
	// 				var c = this.getRibbonOrder()
	// 				var t = c+offset
	// 				return this.focusImage('current', (t < c ? 'after' : 'before'), t)
	focusImage: function(target, mode, list){
		var current = this.getImage(target, mode, list)
		if(this.order.indexOf(current) >= 0){
			this.current = current
		}
		return this
	},	
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
	// XXX above/below/at...
	// XXX do we remove ribbons and how...
	// XXX test
	newRibbon: function(target, mode){
		var gid = this.newGid('R')
		var i = this.getRibbonOrder(target)

		this.ribbon_order.splice(i, 0, gid)
		this.ribbons[gid] = []

		// XXX should we return this or gid???
		return this
	},
	// Merge ribbons
	//
	//	.mergeRibbons('all')
	//	.mergeRibbons(ribbon, ribbon, ...)
	//		-> data
	// If 'all' is the first argumet, this will merge all the ribbons.
	//
	// This will merge the ribbons into the first.
	//
	// XXX we should update .base
	// XXX test
	mergeRibbons: function(target, other){
		var targets = target == 'all' ? this.ribbon_order : arguments
		var base = arguments[0]

		for(var i=1; i < arguments.length; i++){
			var r = arguments[i]
			this.makeSparseImages(this.ribbons[r], this.ribbons[base])

			delete this.ribbons[r]
			this.ribbon_order.splice(this.ribbon_order.indexOf(r), 1)
		}

		// XXX we should update .base

		return this
	},

	// Get image
	//
	//	.getImage()
	//	.getImage('current')
	// 		-> current image gid
	//
	// 	.getImage(gid|order)
	// 	.getImage(gid|order, list|ribbon)
	// 		-> gid if the image is loaded/exists
	// 		-> null if the image is not loaded or does not exist
	// 		NOTE: the second argument must not be an int (ribbon order)
	// 				to avoid conflict with the offset case below.
	//		NOTE: image order can be negative, thus getting an image 
	//				from the tail.
	//
	// 	.getImage('first'[, ribbon])
	// 	.getImage('last'[, ribbon])
	// 		-> gid of first/last image in ribbon 
	// 		-> null
	// 		NOTE: the second argument must be .getRibbon(..) compatible.
	//
	// 	.getImage(list|ribbon[, 'before'|'after'])
	// 		-> gid of image closest to current in list|ribbon
	// 		-> null
	// 		NOTE: 'before' is default.
	// 		NOTE: the first argument must not be a number.
	//
	// 	.getImage('before'[, list|ribbon])
	// 	.getImage(gid|order, 'before'[, list|ribbon])
	// 		-> gid of the image before gid|order
	// 		-> null of nothing is before
	// 	.getImage('after'[, list|ribbon])
	// 	.getImage(gid|order, 'after'[, list|ribbon])
	// 		-> gid of the image after git|order
	// 		-> null of nothing is after
	// 		NOTE: in both the above cases if gid|order is found explicitly
	// 			it will be returned.
	//
	// 	.getImage(gid|order, offset[, list|ribbon])
	// 		-> gid if the image at offset from current
	// 		-> null if there is no image at that offset
	// 		NOTE: the 'relative' string is required as there is no way to
	// 			destinguish between order and offset...
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

		// nirmalize target...
		if(target in this.ribbons || target.constructor.name == 'Array'){
			list = target
			target = this.current
		} else if(target == 'before' || target == 'after'){
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
		} else {
			var offset = 0 
			mode = mode == null ? 'before' : mode
		}
		offset = Math.abs(offset)

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
		if(mode == 'before'){
			var step = -1

		} else if(mode == 'after'){
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
	// same as .getImage(..) but return image order.
	//
	// XXX should be able to get order in the following contexts:
	// 		- all (default)
	// 		- loaded
	// 		- ribbon
	// 		- list
	getImageOrder: function(target, mode, list){
		return this.order.indexOf(this.getImage(target, mode, list))
	},	
	// Get a list of gids...
	//
	//	.getImages()
	//	.getImages('loaded')
	//		-> list of currently loaded images, from all ribbons
	//
	//	.getImages('all')
	//		-> list of all images, both loaded and not
	//
	//	.getImages('current')
	//		-> list of images, in current ribbon
	//
	//	.getImages(list)
	//		-> return only loaded images from list
	//
	//	.getImages(gid|order|ribbon)
	//		-> get loaded images from ribbon
	//
	//	.getImages(gid|order|ribbon, count)
	//	.getImages(gid|order|ribbon, count, 'around')
	//	.getImages(gid|order|ribbon, count, 'after')
	//	.getImages(gid|order|ribbon, count, 'before')
	//		-> get a fixed number of gids around (default) before or
	//			after the target
	//
	// If no image is given the current image/ribbon is assumed as target.
	//
	// This will allways return count images if there is enough images 
	// in ribbon from the requested sides of target.
	//
	// NOTE: this expects ribbon order and not image order.
	// NOTE: if count is even, it will return 1 more image to the left 
	// 		(before) the target.
	// NOTE: if the target is present in the image-set it will be included
	// 		in the result regardless of mode...
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
			list = this.compactSparseList(res)
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
			list = list != null ? this.compactSparseList(list) : []
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
	//	.getRibbon()
	//		-> current ribbon gid
	//
	//	.getRibbon(ribbon|order|gid)
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//	.getRibbon(ribbon|order|gid, 'before')
	//	.getRibbon(ribbon|order|gid, 'after')
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//	.getRibbon(ribbon|order|gid, offset)
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	// NOTE: this expects ribbon order and not image order.
	//		
	getRibbon: function(target, offset){
		target = target == null ? this.current : target
		offset = offset == null ? 0 : offset
		offset = offset == 'before' ? -1 : offset
		offset = offset == 'after' ? 1 : offset

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
	// XXX this depends on setting length of an array, it works in Chrome
	// 		but will it work the same in other systems???
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
	//	.shiftImage(from, gid|ribbon)
	//	.shiftImage(from, gid|ribbon, 'before')
	//	.shiftImage(from, gid|ribbon, 'after')
	//		-> data
	//
	//	.shiftImage(from, offset, 'offset')
	//		-> data
	//
	// from must be a .getImage(..) compatible object. usually an image
	// gid, order, or null, see .getImage(..) for more info.
	//
	// NOTE: this will not create new ribbons.
	//
	// XXX process from as a list of gids...
	// XXX test
	shiftImage: function(from, target, mode){
		from = from.constructor.name != 'Array' ? [from] : from
		mode = mode == null ? 'before' : mode
		var ribbons = this.ribbons
		var order = this.order

		first = this.getImage(from[0])
		var f = order.indexOf(first)

		// target is an offset...
		if(mode == 'offset'){
			target = target == null ? 0 : target
			var t = f + target
			t = t > order.length ? order.length-1
				: t < 0 ? 0
				: t
			target = order[t]

			var ribbon = this.getRibbon(target)

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
		if(f != t){
			for(var i=0; i<from.length; i++){
				f = order.indexOf(from[i])

				// update order...
				order.splice(t+i, 0, this.splice(f, 1)[0])

				// update ribbons...
				for(k in ribbons){
					ribbons[k].splice(t+i, 0, ribbons[k].splice(f, 1)[0])
				}
			}
		}

		return this 
	},

	// Split data into 2 or more sections...
	//
	// NOTE: this might result in empty ribbons, if no images are in a 
	// 		given ribbon in the section to be split...
	// XXX test
	split: function(target){
		if(target.constructor.name != 'Array'){
			target = [target]
		}
		var res = []
		var tail = this.clone()

		target.forEach(function(i){
			i = tail.getImageOrder(i)-1
			var n = new Data()
			n.base = tail.base
			n.ribbon_order = base.ribbon_order.slice()
			n.order = tail.order.splice(0, i)
			for(var k in this.ribbons){
				n.ribbons[k] = tail.ribbons.splice(0, i)
			}
			n.current = n.order.indexOf(tail.current) >= 0 ? tail.current : n.order[0]
			
			res.push(n)
		})

		// update .current of the last element...
		tail.current = tail.order.indexOf(tail.current) >= 0 ? tail.current : tail.order[0]

		res.push(tail)
		return res
	},
	// align can be:
	// 	'gid'
	// 	'base'
	// 	'top'
	// 	'bottom'
	//
	// NOTE: this will merge the items into the first list element...
	//
	// XXX should this join to this or create a new data???
	// XXX test
	join: function(data, align){
		var res = data.pop()

		data.forEach(function(d){
		})
		// XXX

		return res
	},

	// NOTE: this may result in empty ribbons...
	// NOTE: this will not crop the .order...
	crop: function(list){
		var crop = this.clone()
		list = crop.makeSparseImages(list)
		for(var k in crop.ribbons){
			crop.ribbons[k] = crop.makeSparseImages(crop.ribbons[k].filter(function(_, i){
				return list[i] != null
			}))
		}
		return crop
	},
	// Merge changes from crop into data...
	//
	// NOTE: this may result in empty ribbons...
	//
	// XXX should we be able to align a merged crop???
	// XXX test
	mergeCrop: function(crop){
		var that = this

		this.order = crop.order.slice()
		// XXX sync these???
		this.ribbon_order = crop.ribbon_order.slice()
		this.sortRibbons()

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

	// JSON serialization...
	//
	// NOTE: this loads in-place, use .fromJSON(..) to create new data...
	// XXX check if we need more version checking...
	convertDataGen3: function(data){
		// XXX check for earlier versions...
		// XXX do we need to do more here???
		data = data.version == null ? convertDataGen1(data) : data
		var that = this
		var res = {}
		res.version = '3.0'
		res.current = data.current
		res.order = data.order.slice()
		res.ribbon_order = []
		res.ribbons = {}
		// generate gids...
		data.ribbons.forEach(function(e){
			var gid = that.newGid('R')
			res.ribbon_order.push(gid)
			res.ribbons[gid] = e.slice()
		})
		// we set the base to the first ribbon...
		res.base = res.ribbon_order[0]
		return res
	},
	loadJSON: function(data){
		if(typeof(data) == typeof('str')){
			data = JSON.parse(data)
		}
		data = data.version < '3.0' ? this.convertDataGen3(data) : data
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
	// NOTE: if mode is either 'str' or 'string' then this will stringify
	// 		the result...
	dumpJSON: function(mode){
		var res = {
			varsion: '3.0',
			base: this.base,
			current: this.current,
			order: this.order.slice(),
			ribbon_order: this.ribbon_order.slice(),
			ribbons: {},
		}
		// compact ribbons...
		for(var k in this.ribbons){
			res.ribbons[k] = this.compactSparseList(this.ribbons[k])
		}
		if(mode == 'string' || mode == 'str'){
			res = JSON.stringify(res)
		}
		return res
	},
}



// Main Data object...
//
function Data(json){
	if(this.constructor.name != 'Data'){
		obj = new Data
	} else {
		obj = this
	}

	// load initial state...
	if(json != null){
		obj.loadJSON(json)
	} else {
		obj._reset()
	}

	return obj
}
Data.__proto__ = DataClassPrototype
Data.prototype = DataPrototype
Data.prototype.constructor = Data



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
