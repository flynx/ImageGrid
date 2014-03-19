/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

var DataClassProto = {
	// NOTE: we consider the list sorted...
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


var DataPrototype = {
	// DATA structure:
	// 	.current
	// 		gid
	// 	.base
	// 		gid
	// 	.order
	// 		[ gid, .. ]
	// 	.ribbon_order
	// 		[ gid, .. ]
	// 	.ribbons
	// 		{ gid: [ gid, .. ] }
	// 		NOTE: ribbons are sparse...
	
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
	
	// target can be:
	// 	image gid
	// 	image order
	// 	ribbon gid
	// 	list
	//
	focusImage: function(target, mode){
		var current = this.getImage(target, mode)
		if(current != null){
			this.current = current
		}
		return this
	},	
	setBase: function(target){
		var base = this.getRibbon(target)
		if(base != null){
			this.base = base
		}
		return this
	},

	// Create empty ribbon...
	//
	// XXX above/below/at...
	// XXX do we remove ribbons and how...
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
	// 		-> current image gid
	//
	// 	.getImage(gid|order)
	// 	.getImage(gid|order, list|ribbon)	XXX
	// 		-> gid if the image is loaded/exists
	// 		-> null if the image is not loaded or does not exist
	// 		NOTE: if the argument gid does not exist in 
	//
	// 	.getImage('first'[, ribbon])
	// 	.getImage('last'[, ribbon])
	// 		-> gid of first/last image in ribbon 
	// 		NOTE: the second argument must be .getRibbon(..) compatible.
	//
	// 	.getImage(list|ribbon[, 'before'|'after'])
	// 		-> gid
	// 		-> null
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
	// 	.getImage(offset, 'relative'[, list|ribbon])
	// 		-> gid if the image at offset from current
	// 		-> null if there is no image at that offset
	// 		NOTE: the 'relative' string is required as there is no way to
	// 			destinguish between order and offset...
	//
	// 	.getImage(gid|order, offset[, list|ribbon])
	// 		same as the above, but relative to gid|order
	//
	// If gid|order is not given, current image is assumed.
	// Similarly, if list|ribbon is not given then the current ribbon 
	// is used.
	//
	// NOTE: if gid is invalid this will return -1 (XXX is this good???)
	//
	// XXX revise argument syntax...
	getImage: function(target, mode, list){
		if(target == 'current'){
			target = this.current
		}
		if(target == null && mode == null && list == null){
			return this.current
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

		// normalize args...
		if(target in this.ribbons || target.constructor.name == 'Array'){
			list = target
			target = this.current
		}
		if(target == 'before' || target == 'after'){
			list = mode
			mode = target
			target = this.current
		}
		if(mode != null && mode.constructor.name == 'Array'){
			list = mode
			mode = null
		}
		// relative mode and offset...
		var offset = mode == 'relative' ? target
			: typeof(mode) == typeof(123) ? mode
			: 1
		if(typeof(mode) == typeof(123)){
			mode = offset > 0 ? 'before'
				: offset < 0 ? 'after'
				: mode
		} else {
			mode = mode == null ? 'before' : mode
		}
		offset = Math.abs(offset)

		var i = this.order.indexOf(target)

		// ERROR: invalid gid...
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
		if(res != null){
			return res
		}

		if(mode == 'before'){
			var step = -1

		} else if(mode == 'after'){
			var step = 1

		// strict -- no hit means there is no point in searching...
		} else {
			return null
		}

		// get the first non-null, also accounting for offset...
		i += step
		// NOTE: we are using this.order.length here as ribbons might 
		// 		be truncated...
		for(; i >= 0 && i < this.order.length; i+=step){
			var cur = list[i]
			if(cur == null){
				continue
			}
			offset -= 1
			if(offset == 0){
				return cur
			}
		}
		// target is either first or last...
		return null
	},	
	// same as .getImage(..) but return image order.
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
	//	.getImages(list)
	//		-> only loaded images from list
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

	sortImages: function(){
		var ribbons = this.ribbons
		for(k in ribbons){
			ribbons[k] = this.makeSparseImages(ribbons[k])
		}
		return this
	},
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
	// Format version:
	// 	3.0	- Gen4 format, introduced several backwards incompatible 
	// 		cahnges:
	// 			- added ribbon GIDs, .ribbons now is a gid indexed 
	// 			  object
	// 			- added .ribbon_order
	// 			- added base ribbon
	// 			- ribbons are now sparse in memory but can be compact 
	// 			  in file
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


var Data = function(){
	this.base = null
	this.current = null
	this.order = [] 
	this.ribbon_order = [] 
	this.ribbons = {}

	this._gid_cache = []
}
Data.__proto__ = DataClassPrototype
Data.prototype = DataPrototype
Data.prototype.constructor = Data



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
