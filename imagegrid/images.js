/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var sha1 = require('ext-lib/sha1')

var object = require('lib/object')
var util = require('lib/util')



/*********************************************************************/

// decide to use a hashing function...
if(typeof(sha1) != 'undefined'){
	var hash = sha1.hash.bind(sha1)
} else {
	var hash = function(g){ return g }
}





/*********************************************************************/

var PLACEHOLDER = 
module.PLACEHOLDER = 
	'./images/placeholder.svg'

var MISSING = 
module.MISSING = 
	'./images/missing.svg'

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
	//path: './images/900px/SIZE.jpg',
	path: PLACEHOLDER,

	// Previews...
	// NOTE: the actual values depend on specific image and can be
	// 		any size...
	//preview: {
	//	'150px': './images/150px/SIZE.jpg',
	//	'350px': './images/350px/SIZE.jpg',
	//	'900px': './images/900px/SIZE.jpg',
	//},

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
	to = to == 'cw' ? 
			1 
		: to == 'ccw' ? 
			-1
		: [0, 90, 180, 270].includes(to*1) ? 
			to*1
		: [-90, -180, -270].includes(to*1) ? 
			360+(to*1)
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

	return res }



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
// XXX Image base class...
// 		...not sure if we need this... (???)

var ImageClassPrototype =
module.ImageClassPrototype = {
}

var ImagePrototype =
module.ImagePrototype = {
}

var Image = 
module.Image = 
	object.Constructor('Image', 
		ImageClassPrototype, 
		ImagePrototype)



/*********************************************************************/

// XXX depends on jli.quoteRegExp(..)
var ImagesClassPrototype =
module.ImagesClassPrototype = {
	// XXX populate the image doc better...
	// NOTE: if base is given then it will be set as .base_path and 
	// 		removed from each url if present...
	fromArray: function(data, base){
		var images = new this()
		// XXX stub...
		var i = 0
		//var base_pattern = base ? RegExp('^' + base) : null 
		var base_pattern = base ? 
			RegExp('^' + RegExp.quoteRegExp(base)) 
			: null 
		data.forEach(function(path){
			// XXX need to normalize path...
			var p = path.startsWith('data') ? 
				path 
				: (base_pattern ? path.replace(base_pattern, './') : path)
					.replace(/([\/\\])\1+/g, '/')
			// XXXX
			var gid = hash('I'+i+':'+p)

			var name = (p
					// basename...
					.split(/[\\\/]/g).pop() || '')
					// ext...
					.split(/(\.[^\.]*$)/)

			// XXX populate the image doc better...
			images[gid] = {
				id: gid,
				path: p,
				// basename...
				name: name[0],
				// ext with leading '.'
				ext: name[1],
			}

			// remove only if base path is given and in path...
			if(base && base_pattern.test(path)){
				images[gid].base_path = base
			}
			i += 1
		})
		return images
	},
	fromJSON: function(data){
		return new this().load(data)
	},
}


var ImagesPrototype =
module.ImagesPrototype = {
	//version: '3.1',

	get length(){
		return this.keys().length },

	get gids(){
		return this.keys() },

	// Generic iterators...
	//
	// function format:
	// 		function(key, value, index, object)
	//
	// reduce function format:
	// 		function(value1, value2, key, index, object)
	//
	filter: function(func){
		var that = this
		var res = new this.constructor()
		this.forEach(function(key, i){
			if(func.call(that[key], key, that[key], i++, that)){
				res[key] = that[key] } })
		return res },
	// NOTE: .map(..) and .reduce(..) will not return Images objects...
	map: function(func){
		var that = this
		return this.gids
			.map(function(key, i){
				return that[key] instanceof Function ?
					[]
					: [func.call(that[key], key, that[key], i++, that)] })
			.flat() },
	reduce: function(func, initial){
		var that = this
		var res = initial
		this.forEach(function(key, i){
			res = func.call(that[key], res, that[key], key, i++, that) })
		return res },
	forEach: function(func){
		this.map(func)
		return this },

	// make images iterable...
	[Symbol.iterator]: function*(){
		for(var key in this){
			// reject non images...
			// XXX make this cleaner...
			if(key == 'length' 
					|| key == 'version' 
					|| key == 'gids' 
					|| this[key] instanceof Function){
				continue }
			yield [key, this[key]] } },
	iter: function*(){
		yield* this },

	// XXX do we need a .values() / .entries() here too???
	keys: function(){
		var keys = Object.keys(this)
		var i = keys.lastIndexOf('version')
		i >= 0
			&& keys.splice(i, 1)
		return keys },

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
	
	getImagePath: function(gid, path){
		var img = this[gid] || IMAGE_DATA

		return (img.base_path || path) ? 
			[img.base_path || path, img.path].join('/')
			: util.path2url(img.path || IMAGE_DATA.path)
	},
	// NOTE: actual URL decoding and encoding is not done here to keep
	// 		things consistent, rather it is done the the latest possible 
	// 		stage, in images._loadImagePreviewURL(..)
	// XXX see: ribbons.js for details...
	// XXX this is the same (in part) as .getImagePath(..) 
	getBestPreview: function(gid, size, img_data, full_path){
		if(img_data === true){
			full_path = true
			img_data = null
		}
		//gid = gid == null ? getImageGID(): gid
		//size = size == null ? getVisibleImageSize('max') : size
		img_data = img_data == null ? this[gid] : img_data
		img_data = img_data || IMAGE_DATA

		// if path is explicitly null there are no previews...
		if(img_data.path === null){
			return undefined
		}

		// if no usable images are available use STUB data...
		if(!img_data 
				|| (img_data.preview == null 
					|| Object.keys(img_data.preview).length == 0)
				&& img_data.path == null){
			img_data = IMAGE_DATA
		}

		// get minimal element bigger than size or if size is null get 
		// the greatest element...
		var path = img_data.path
		var preview = img_data.preview || {}
		var p = [null, 0]
		for(var s in preview){
			var v = parseInt(s)
			p = (size == null || (v < size && p[1] < size)) ?
					(v < p[1] ? p : [s, v])
				: (p[1] >= size && (v > p[1] || v < size)) ? 
					p
				: [s, v] }

		// get the original if it exists and smaller than size...
		if(path && (size == null || p[1] < size)){
			var url = path
			var preview_size = 'Original'

		// get the largest preview...
		} else {
			var url = preview[p[0]]
			var preview_size = p[0]
		}

		// XXX LEGACY...
		//url = url.indexOf('%20') >= 0 ? decodeURI(url) : url

		return {
			url: (full_path && img_data.base_path ?
				  	img_data.base_path + '/' 
					: '') 
				+ url,
			size: preview_size,
		} },


	// Get image filename...
	//
	// NOTE: this will default to gid if not filename (.path) is set... (???)
	getImageFileName: function(gid, do_unescape){
		do_unescape = do_unescape == null ? true : do_unescape
		if(!this[gid] || !this[gid].path){
			return gid }
		if(do_unescape){
			return unescape(this[gid].path.split('/').pop())
		} else {
			return this[gid].path.split('/').pop() } },
	// Get the first sequence of numbers in the file name...
	//
	// NOTE: if no filenmae (.path) is set, this will return gid... (???)
	getImageNameSeq: function(gid){
		if(!this[gid] || !this[gid].path){
			return gid
		}
		var n = this.getImageFileName(gid)
		var r = /([0-9]+)/m.exec(n)
		return r == null ? n : parseInt(r[1])
	},
	// Get the sequence of numbers in the file name but only if it is 
	// at the filename start...
	getImageNameLeadingSeq: function(gid){
		if(!this[gid] || !this[gid].path){
			return gid
		}
		var n = this.getImageFileName(gid)
		var r = /^([0-9]+)/g.exec(n)
		return r == null ? n : parseInt(r[1])
	},

	// Replace image gid...
	//
	replaceGid: function(from, to){
		var img = this[from]

		// XXX is the test needed here???
		if(img != null){
			delete this[from]
			this[to] = img
		}

		return this
	},


	// Gid sorters...
	//
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

			/* XXX seting orientation to undefined does not save correctly (BUG?) 
			if(o == 0){
				delete img.orientation
			} else {
				img.orientation = o
			}
			//*/
			img.orientation = o

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
			if(img == null){
				img = that[key] = {}
			}
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


	clone: function(){
		return (new Images()).load(this.json()) },
	// NOTE: this will join the other data into the current object in-place,
	// 		use .clone() to preserve current data...
	join: function(other){
		var that = this

		other.forEach(function(gid, img){
			that[gid] = img
		})

		return this
	},

	// serialization...
	load: function(data){
		data = typeof(data) == typeof('str') 
			? JSON.parse(data) 
			: JSON.parse(JSON.stringify(data))
		var version = data.versio
		for(var k in data){
			var img = this[k] = data[k]

			// keep the preview paths decoded...
			//
			// NOTE: updating from legacy format...
			// XXX move this to version conversion... (???)
			version == null
				&& Object.keys(img && img.preview || {})
					.forEach(function(res){
						var p = img.preview[res]
						img.preview[res] = 
							p.includes(k+'%20-%20') ? 
								decodeURI(p) 
								: p }) }
		return this },
	// XXX this is really odd: renaming this to 'toJSON' breaks JavaScript
	// 		making chrome/node just say: "<error>" and a filename...
	json: function(data){
		var res = JSON.parse(JSON.stringify(this))
		// XXX
		res.version = '3.0'
		return res
	},

	_reset: function(){
	},


	// XXX is this a good name for this??? (see: object.js)
	__init__: function(json){
		// load initial state...
		if(json != null){
			this.load(json)
		} else {
			this._reset()
		}
		return this
	},
}



/*********************************************************************/

// Main Images object...
var Images = 
module.Images = 
	object.Constructor('Images', 
		ImagesClassPrototype, 
		ImagesPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
