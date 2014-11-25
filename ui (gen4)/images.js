/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> images')

//var DEBUG = DEBUG != null ? DEBUG : true

var sha1 = require('./ext-lib/sha1')

var object = require('object')



/*********************************************************************/

// decide to use a hashing function...
if(typeof(sha1) != 'undefined'){
	var hash = sha1.hash.bind(sha1)
} else {
	var hash = function(g){ return g }
}


/*********************************************************************/

// A stub image, also here for documentation...
var IMAGE_DATA =
module.IMAGE_DATA = {
	// Entity GID...
	id: 'GID',

	// Entity type
	type: 'image',

	// Entity state
	//
	// can be:
	// 	- 'single'
	// 	- 'grouped'
	// 	- 'hidden'
	// 	- ...
	state: 'single',

	// Creation time...
	ctime: 0,

	// Original path...
	path: './images/900px/SIZE.jpg',

	// Previews...
	// NOTE: the actual values depend on specific image and can be
	// 		any size...
	preview: {
		'150px': './images/150px/SIZE.jpg',
		'350px': './images/350px/SIZE.jpg',
		'900px': './images/900px/SIZE.jpg',
	},

	// Classes
	// XXX currently unused...
	//classes: '',

	// Image orientation (optional)
	//
	// can be:
	// 	- null/undefined	- same as 0
	// 	- 0 (default)		- load as-is
	// 	- 90				- rotate 90deg CW
	// 	- 180				- rotate 180deg CW
	// 	- 270				- rotate 270deg CW (90deg CCW)
	//
	// NOTE: use orientationExif2ImageGrid(..) to convert from EXIF 
	// 		orientation format to ImageGrid format...
	//orientation: 0,

	// Image flip state (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- array
	//
	// can contain:
	// 	- 'vertical'
	// 	- 'horizontal'
	//
	// NOTE: use orientationExif2ImageGrid(..) to convert from EXIF 
	// 		orientation format to ImageGrid format...
	//flipped: null,

	// Image comment (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- string
	//comment: null,

	// List of image tags (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- array
	//tags: null,
}


var GROUP_DATA =
module.GROUP_DATA = {
	// Entity GID...
	id: 'GID',

	// Entity type
	type: 'group',

	// Entity state
	//
	// can be:
	// 	- 'single'
	// 	- 'grouped'
	// 	- 'hidden'
	// 	- ...
	state: 'single',

	// image used to represent/display group...
	cover: 'GID',

	// list of group contents, including .cover
	items: [
		'GID',
	],

	// Classes
	// XXX currently unused...
	//classes: '',

	// Image comment (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- string
	//comment: null,

	// List of image tags (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- array
	//tags: null,
}

// Calculate relative rotation angle...
//
// Calculate rotation angle relative to from:
// 	calcRelativeRotation(from, 'cw')
// 	calcRelativeRotation(from, 'ccw')
// 		-> 0 | 90 | 180 | 270
//
// Validate an angle:
// 	calcRelativeRotation(angle)
// 	calcRelativeRotation(from, angle)
// 		-> 0 | 90 | 180 | 270
// 		-> null
//
//
module.calcRelativeRotation = function(from, to){
	if(to == null){
		to = from
		from = 0
	}
	to = to == 'cw' ? 1 
		: to == 'ccw' ? -1
		: [0, 90, 180, 270].indexOf(to*1) >= 0 ? to*1
		: [-90, -180, -270].indexOf(to*1) >= 0 ? 360+(to*1)
		: null

	// relative rotation...
	if(to == 1 || to == -1){
		var res = from
		res = res == null ? 0 : res*1
		res += 90*to
		res = res < 0 ? 270 
			: res > 270 ? 0
			: res

	// explicit direction...
	} else {
		var res = to
	}

	return res
}



/*********************************************************************/

// cmp functions...
// XXX is this the right way to seporate these???

module.makeImageDateCmp = function(data, get){
	return function(a, b){
		if(get != null){
			a = get(a)
			b = get(b)
		}
		b = data[b].ctime
		a = data[a].ctime

		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}

// NOTE: this expects gids...
module.makeImageNameCmp = function(data, get){
	return function(a, b){
		if(get != null){
			a = get(a)
			b = get(b)
		}
		a = data.getImageFileName(a)
		b = data.getImageFileName(b)
		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}

module.makeImageSeqOrNameCmp = function(data, get, seq){
	seq = seq == null ? data.getImageNameSeq : seq

	return function(a, b){
		// XXX this is ugly and non-generic...
		if(get != null){
			a = get(a)
			b = get(b)
		}
		// XXX this is ugly and non-generic...
		var aa = seq.call(data, a)
		var bb = seq.call(data, b)

		// special case: seq, name
		if(typeof(aa) == typeof(123) && typeof(bb) == typeof('str')){ return -1 }
		// special case: name, seq
		if(typeof(aa) == typeof('str') && typeof(bb) == typeof(123)){ return +1 }

		// get the names if there are no sequence numbers...
		// NOTE: at this point both a and b are either numbers or NaN's...
		a = isNaN(aa) ? data.getImageFileName(a) : aa
		b = isNaN(bb) ? data.getImageFileName(b) : bb

		// do the actual comparison
		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}



/*********************************************************************/

var ImagesClassPrototype =
module.ImagesClassPrototype = {
	// XXX populate the image doc better...
	fromArray: function(data){
		var images = new this()
		// XXX stub...
		var i = 0
		data.forEach(function(path){
			var gid = hash('I'+i)
			// XXX populate the image doc better...
			images[gid] = {
				id: gid,
				path: path,
			}
			i += 1
		})
		return images
	},
	fromJSON: function(data){
		return new this().loadJSON(data)
	},
}


var ImagesPrototype =
module.ImagesPrototype = {

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


	get length(){
		return Object.keys(this).length
	},

	// Generic iterators...
	//
	// function format:
	// 		function(key, value, index, object)
	//
	// reduce function format:
	// 		function(value1, value2, key, index, object)
	//
	//
	// this will be set to the value...
	//
	// XXX revise...
	// XXX are these slower than doing it manualy via Object.keys(..)
	forEach: function(func){
		var i = 0
		for(var key in this){
			func.call(this[key], key, this[key], i++, this)
		}
		return this
	},
	map: function(func){
		var res = this.constructor()
		var i = 0
		for(var key in this){
			res[k] = func.call(this[key], key, this[key], i++, this)
		}
		return res
	},
	filter: function(func){
		var res = this.constructor()
		var i = 0
		for(var key in this){
			if(func.call(this[key], key, this[key], i++, this)){
				res[key] = this[key]
			}
		}
		return res
	},
	reduce: function(func, initial){
		var res = initial
		for(var key in this){
			res = func.call(this[key], res, this[key], key, i++, this)
		}
		return res
	},

	keys: function(){
		return Object.keys(this)
	},

	// Build an image index relative to an attribute...
	//
	// Format:
	// 	{
	// 		<attr-value> : [
	// 			<gid>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	// XXX test out the attr list functionality...
	makeIndex: function(attr){
		var res = {}
		attr = attr.constructor !== Array ? [attr] : attr

		// buld the index...
		var that = this
		this.forEach(function(key){
			var n = attr.map(function(n){ return that[n] })
			n = JSON.stringify(n.length == 1 ? n[0] : n)
				// XXX is this the right way to go?
				.replace(/^"(.*)"$/g, '$1')
			res[n] = n in res ? res[n].concat(key) : [key]
		})

		return res
	},


	// Image data helpers...

	// XXX see: ribbons.js for details...
	getBestPreview: function(gid, size, img_data){
		//gid = gid == null ? getImageGID(): gid
		//size = size == null ? getVisibleImageSize('max') : size
		img_data = img_data == null ? this[gid] : img_data

		// if no usable images are available use STUB data...
		if((img_data.preview == null 
					|| Object.keys(img_data.preview).length == 0)
				&& img_data.path == null){
			img_data = IMAGE_DATA
		}

		var s
		var url = img_data.path
		var preview_size = 'Original'
		var p = Infinity
		var previews = img_data.preview || {}

		for(var k in previews){
			s = parseInt(k)
			if(s < p && s > size){
				preview_size = k
				p = s
				url = previews[k]
			}
		}
		return {
			//url: normalizePath(url),
			url: url,
			size: preview_size
		}
	},

	// Get image filename...
	getImageFileName: function(gid, do_unescape){
		do_unescape = do_unescape == null ? true : do_unescape
		if(do_unescape){
			return unescape(this[gid].path.split('/').pop())
		} else {
			return this[gid].path.split('/').pop()
		}
	},
	// Get the first sequence of numbers in the file name...
	getImageNameSeq: function(gid){
		var n = this.getImageFileName(gid)
		var r = /([0-9]+)/m.exec(n)
		return r == null ? n : parseInt(r[1])
	},
	// Get the sequence of numbers in the file name but only if it is 
	// at the filename start...
	getImageNameLeadingSeq: function(gid){
		var n = this.getImageFileName(gid)
		var r = /^([0-9]+)/g.exec(n)
		return r == null ? n : parseInt(r[1])
	},


	// Gid sorters...
	// XXX might be a good idea to add caching...
	// XXX chainCmp(..) is loaded from lib/jli.js
	sortImages: function(gids, cmp, reverse){
		gids = gids == null ? Object.keys(this) : gids

		cmp = cmp == null ? module.makeImageDateCmp(this) : cmp
		cmp = cmp.constructor === Array ? chainCmp(cmp) : cmp

		gids = gids.sort(cmp)
		gids = reverse ? gids.reverse() : gids

		return gids
	},
	// Shorthands...
	// XXX default gids may include stray attributes...
	sortByDate: function(gids, reverse){
		gids = gids == null ? Object.keys(this) : gids
		return this.sortImages(gids, null, reverse) 
	},
	sortByName: function(gids, reverse){
		gids = gids == null ? Object.keys(this) : gids
		return this.sortImages(gids, module.makeImageNameCmp(this), reverse) 
	},
	sortBySeqOrName: function(gids, reverse){ 
		gids = gids == null ? Object.keys(this) : gids
		return this.sortImages(gids, module.makeImageSeqOrNameCmp(this), reverse) 
	},
	sortByNameXPStyle: function(gids, reverse){ 
		gids = gids == null ? Object.keys(this) : gids
		return this.sortImages(gids, 
				module.makeImageSeqOrNameCmp(this, null, this.getImageNameLeadingSeq), 
				reverse) 
	},
	sortByDateOrSeqOrName: function(gids, reverse){
		gids = gids == null ? Object.keys(this) : gids
		return this.sortImages(gids, [
					module.makeImageDateCmp(this),
					module.makeImageSeqOrNameCmp(this)
				], reverse)
	},
	// XXX 
	sortedImagesByFileNameSeqWithOverflow: function(gids, reverse){
		gids = gids == null ? Object.keys(this) : gids

		// XXX see ../ui/sort.js
	},

	// Actions...

	// Rotate image...
	//
	// Rotate image clockwise:
	//	.rotateImage(target, 'cw')
	//		-> images
	//
	// Rotate image counterclockwise:
	//	.rotateImage(target, 'ccw')
	//		-> images
	//
	// Set explicit image rotation angle:
	//	.rotateImage(target, 0|90|180|270)
	//	.rotateImage(target, -90|-180|-270)
	//		-> images
	//
	// NOTE: target can be a gid or a list of gids...
	rotateImage: function(gids, direction){
		gids = gids.constructor !== Array ? [gids] : gids
		// validate direction...
		if(module.calcRelativeRotation(direction) == null){
			return this
		}

		var that = this
		gids.forEach(function(key){
			var img = that[key]
			if(img == null){
				img = that[key] = {}
			}
			var o = direction == 'cw' || direction == 'ccw' 
				? module.calcRelativeRotation(img.orientation, direction) 
				: direction*1
			if(o == 0){
				delete img.orientation
			} else {
				img.orientation = o
			}
			// account for proportions...
			//that.correctImageProportionsForRotation(img)
			// XXX this is a bit of an overkill but it will update the 
			// 		preview if needed...
			//that.updateImage(img)
		})
		return this
	},

	// Flip image...
	//
	//	.flipImage(target, 'horizontal')
	//	.flipImage(target, 'vertical')
	//		-> images
	//
	flipImage: function(gids, direction, reference){
		gids = gids.constructor !== Array ? [gids] : gids
		reference = reference || 'view'
		var that = this
		gids.forEach(function(key){
			var img = that[key]
			var o = img.orientation
			var d = direction

			// flip relative to 
			if(reference == 'view' && (o == 90 || o == 270)){
				d = d == 'horizontal' ? 'vertical' : 'horizontal'
			}

			if(img == null){
				img = that[key] = {}
			}
			var state = img.flipped
			state = state == null ? [] : state
			// toggle the specific state...
			var i = state.indexOf(d)
			if(i >= 0){
				state.splice(i, 1)
			} else {
				state.push(d)
			}
			if(state.length == 0){
				delete img.flipped
			} else {
				img.flipped = state
			}
		})
		return this
	},


	// serialization...
	loadJSON: function(data){
		data = typeof(data) == typeof('str') 
			? JSON.parse(data) 
			: JSON.parse(JSON.stringify(data))
		for(var k in data){
			this[k] = data[k]
		}
		return this
	},
	dumpJSON: function(data){
		return JSON.parse(JSON.stringify(this))
	},

	_reset: function(){
	},
}



/*********************************************************************/

// Main Images object...
var Images = 
module.Images = 
object.makeConstructor('Images', 
		ImagesClassPrototype, 
		ImagesPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
