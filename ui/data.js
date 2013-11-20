/**********************************************************************
* 
* Data API and Data DOM connections...
*
* TODO move DATA to a more logical context avoiding the global vars...
* TODO try and split this into:
* 		- data.js -- pure DATA API
* 		- data-ribbons.js -- DATA and Ribbon API mashup...
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var APP_NAME = 'ImageGrid.Viewer'

var DATA_ATTR = 'DATA'

var LOAD_SCREENS = 6

var DEFAULT_SCREEN_IMAGES = 4
var MAX_SCREEN_IMAGES = 12

var CACHE_DIR = '.ImageGrid'
var CACHE_DIR_VAR = '${CACHE_DIR}'

// A stub image, also here for documentation...
var STUB_IMAGE_DATA = {
	// Entity GID...
	id: 'SIZE',

	// Entity type
	// can be:
	// 	- 'image'
	// 	- 'group'
	type: 'image',

	// Entity state
	// can be:
	// 	- 'single'
	// 	- 'grouped'
	// 	- 'hidden'
	// 	- ...
	state: 'single',

	// Creation time...
	ctime: 0,

	// Original path...
	path: './images/sizes/900px/SIZE.jpg',

	// Previews...
	// NOTE: the actual values depend on specific image and can be
	// 		any size...
	preview: {
		'150px': './images/sizes/150px/SIZE.jpg',
		'350px': './images/sizes/350px/SIZE.jpg',
		'900px': './images/sizes/900px/SIZE.jpg',
	},

	// Classes
	// XXX currently unused...
	classes: '',

	// Image orientation
	//
	// can be:
	// 	- 0 (default)	- load as-is
	// 	- 90			- rotate 90deg CW
	// 	- 180			- rotate 180deg CW
	// 	- 270			- rotate 270deg CW (90deg CCW)
	orientation: 0,

	// Image flip state
	//
	// can be:
	// 	- null/undefined
	// 	- array
	//
	// can contain:
	// 	- 'vertical'
	// 	- 'horizontal'
	flipped: null,
}

// Data format...
var DATA = {
	// Format version...
	version: '2.0',

	// Current position, GID...
	current: null,

	// The ribbon cache...
	// in the simplest form this is a list of lists of GIDs
	ribbons: [],

	// Flat ordered list of images in current context...
	// in the simplest form this is a list of GIDs.
	order: [],

	// This can be used to store the filename/path of the file containing 
	// image data...
	image_file: null
}

// the images object, this is indexed by image GID and contains all 
// the needed data...
var IMAGES = {}
// list of image GIDs that have been updated...
var IMAGES_UPDATED = []

var IMAGES_CREATED = false

var MARKED = []

// NOTE: these are named: <mode>-<feature>
var SETTINGS = {
	'global-theme': null,
	'ribbon-mode-screen-images': null,
	'single-image-mode-screen-images': null,
	'single-image-mode-proportions': null,
	'ribbon-mode-image-info': 'off',
}

var BASE_URL = '.'
var BASE_URL_HISTORY = []
var BASE_URL_LIMIT = 10

var IMAGE_CACHE = []

// XXX make these usable for both saving and loading...
// XXX get these from config...
var IMAGES_FILE_DEFAULT = 'images.json'
var IMAGES_FILE_PATTERN = /^[0-9]*-images.json$/
var IMAGES_DIFF_FILE_PATTERN = /^[0-9]*-images-diff.json$/

var MARKED_FILE_DEFAULT = 'marked.json'
var MARKED_FILE_PATTERN = /^[0-9]*-marked.json$/

var DATA_FILE_DEFAULT = 'data.json'
var DATA_FILE_PATTERN = /^[0-9]*-data.json$/

var IMAGE_PATTERN = /.*\.(jpg|jpeg|png|gif)$/i

var UPDATE_SORT_ENABLED = false
// XXX for some reason the sync version appears to work faster...
var UPDATE_SYNC = false



/**********************************************************************
* Helpers
*/

// Zip concatenate lists from each argument.
//
// NOTE: this will skip null values.
function concatZip(){
	var res = []
	$.each(arguments, function(i, lst){
		$.each(lst, function(j, e){
			if(e != null){
				if(res[j] == null){
					res[j] = e
				} else {
					res[j] = res[j].concat(e)
				}
			}
		})
	})
	return res
}


function getImageFileName(gid, images, do_unescape){
	gid = gid == null ? getImageGID() : gid
	images = images == null ? IMAGES : images
	do_unescape = do_unescape == null ? true : do_unescape

	if(do_unescape){
		return unescape(images[gid].path.split('/').pop())
	} else {
		return images[gid].path.split('/').pop()
	}
}


// Get the first sequence of numbers in the file name...
function getImageNameSeq(gid, data){
	data = data == null ? IMAGES : data
	var n = getImageFileName(gid, data)
	var r = /([0-9]+)/m.exec(n)
	return r == null ? n : parseInt(r[1])
}


// Get the first sequence of numbers in the file name but only if it is
// at the filename start...
function getImageNameLeadingSeq(gid, data){
	data = data == null ? IMAGES : data
	var n = getImageFileName(gid, data)
	var r = /^([0-9]+)/g.exec(n)
	return r == null ? n : parseInt(r[1])
}


function getGIDDistance(a, b, get, data){
	data = data == null ? DATA : data
	var order = data.order
	if(get != null){
		a = get(a)
		b = get(b)
	}
	a = order.indexOf(a)
	b = order.indexOf(b)
	return Math.abs(a - b)
}


// Construct 2D distance from gid getter
//
// The distance dimensions are:
// 	- ribbons
// 	- gids within a ribbon
//
// This is a constructor to cache the generated index as it is quite 
// slow to construct, but needs to be current...
//
// NOTE: this is very similar in effect to getGIDDistance(...) but will
// 		also account for ribbons...
// NOTE: see getGIDRibbonDistance(...) for usage example...
function makeGIDRibbonDistanceGetter(gid, data){
	data = data == null ? DATA : data

	// make a cmp index...
	var ribbons = $.map(DATA.ribbons, function(r, i){ 
		// sort each ribbon by distance from closest gid...
		//return [r.slice().sort(makeGIDDistanceCmp(getGIDBefore(gid, i)))] 
		return [r.slice().sort(makeGIDDistanceCmp(gid))] 
	})
	var gids = $.map(ribbons, function(e){ return [e[0]] })
	var ri = gids.indexOf(gid)

	// the basic calculator...
	return function(gid){
		var r = ribbons[getGIDRibbonIndex(gid, {ribbons: ribbons})]
		var x = r.indexOf(gid)
		var y = Math.abs(gids.indexOf(r[0]) - ri)

		// calculate real distance...
		return Math.sqrt(x*x + y*y)
	}
}


// Get distance between two gids taking into account ribbons...
//
// This is essentially a 2D distance between two gids in data.
//
// NOTE: to get lots of distances from a specific image use 
// 		makeGIDDistanceCmp(...) for faster results...
function getGIDRibbonDistance(a, b, data){
	return makeDistanceFromGIDGetter(a, data)(b)
} 



function cmp(a, b, get){
	if(get == null){
		return a - b
	}
	return get(a) - get(b)
}


// Generic image ordering comparison via DATA.order
//
// NOTE: see updateRibbonORder(...) for a general view on image sorting
// 		and re-sorting mechanics.
// NOTE: this expects gids...
// NOTE: this is not in sort.js because it is a generic base sort method
function imageOrderCmp(a, b, get, data){
	data = data == null ? DATA : data
	if(get != null){
		a = get(a)
		b = get(b)
	}
	return data.order.indexOf(a) - data.order.indexOf(b)
}


// Check if a is at position i in lst
//
// This will return:
// 	- 0 if a is equal to position i
// 	- -1 if a is less than position i
// 	- +1 if a is greater than position i
//
// NOTE: the signature is different from the traditional cmp(a, b) so as 
// 		to enable more complex comparisons involving adjacent elements
// 		(see isBetween(...) for an example)
function lcmp(a, i, lst, get){
	var b = get == null ? lst[i] : get(lst[i])

	if(a == b){
		return 0
	} else if(a < b){
		return -1
	} else {
		return 1
	}
}


// Check if a is at position i in lst or between positions i and i+1
//
// This will return:
// 	- 0 if a is equal at position i in lst or is between i and i+1
// 	- -1 if a is "below" position i
// 	- +1 if a is "above" position i
//
// NOTE: this is here mostly to make debugging easy...
function isBetween(a, i, lst, get){
	var b = get == null ? lst[i] : get(lst[i])

	// special case: tail...
	if(i == lst.length-1 && a >= b){
		return 0
	}

	var c = lst[i+1]
	
	// hit...
	if(a == b || (a > b && a < c)){
		return 0
	// before...
	} else if(a < b){
		return -1
	// later...
	} else {
		return 1
	}
}


/*
// Basic liner search...
//
// NOTE: this is here for testing reasons only...
function linSearch(target, lst, check, return_position, get){
	check = check == null ? lcmp : check

	for(var i=0; i < lst.length; i++){
		if(check(target, i, lst, get) == 0){
			return return_position ? i : lst[i]
		}
	}

	// no hit...
	return return_position ? -1 : null
}
Array.prototype.linSearch = function(target, cmp, get){
	return linSearch(target, this, cmp, true, get)
}
*/


// Basic binary search implementation...
//
// NOTE: this will return the object by default, to return position set
// 		return_position to true.
// NOTE: by default this will use cmp as a predicate.
// NOTE: this expects lst to be sorted in a check-compatible way...
function binSearch(target, lst, check, return_position, get){
	check = check == null ? lcmp : check
	var h = 0
	var t = lst.length - 1
	var m, res

	while(h <= t){
		m = Math.floor((h + t)/2)
		res = check(target, m, lst, get)
		
		// match...
		if(res == 0){
			return return_position ? m : lst[m]

		// below...
		} else if(res < 0){
			t = m - 1

		// above...
		} else {
			h = m + 1
		}
	}

	// no result...
	return return_position ? -1 : null
}
Array.prototype.binSearch = function(target, cmp, get){
	return binSearch(target, this, cmp, true, get)
}


// Base ribbon index interface...
//
// XXX we need a persistent way to store this index
//
// 		- DATA.base_ribbon 
// 			- need to be kept in sync all the time (for shift)
// 			+ simple and obvious for a data format
//
// 		- DATA.ribbons[n].base = true
// 			+ persistent and no sync required
// 			- not storable directly via JSON.stringify(...)
//
// 		- do not persistently store the base ribbon unless explicitly 
// 		  required, and set it to 0 on each load/reload
// 		  	~ will need to decide what to do on each save/exit:
// 		  		- align ribbons to top (base = 0)
// 		  		- save "in-progress" state as-is (base > 0)
// 		  		- reset base (base = 0)
// 		  this is a good idea if we have fine grained auto-save and 
// 		  a Ctrl-S triggers a major save, possibly requiring a user 
// 		  comment (a-la VCS)
//
// 		- treat ribbons in the same way as images, with a GID...
// 			- format change (v3.0)
// 			~ rewrite everything that accesses DATA.ribbons
// 			  this is not that critical as the changes are simple in 
// 			  most cases...
// 			+ ribbons are a first class object and can be treated as 
// 			  such...
// 			  	- more natural ribbon operations: grouping, combining, ...
// 			  	- ribbon tagging
// 			  	- a ribbon can be treated as an entity, thus simplifying
// 			  	  work on collections...
// 			- added complexity
//
// XXX this is a stub...
function getBaseRibbonIndex(){

	// XXX

	return 0
}
function setBaseRibbonIndex(n){
	n = n == null ? 0 : n

	// XXX

	return n
}


// like getRibbonIndex but get the index only via DATA...
function getGIDRibbonIndex(gid, data){
	gid = gid == null ? getImageGID() : gid
	data = data == null ? DATA : data

	var ribbons = data.ribbons

	for(var i=0; i < ribbons.length; i++){
		if(ribbons[i].indexOf(gid) >= 0){
			return i
		}
	}
	return -1
}


// Same as getImageBefore(...), but uses gids and searches in DATA...
//
// Return:
// 	null	- no image is before gid
// 	gid		- the image before
//
// NOTE: if gid is present in the searched ribbon this will return it.
// NOTE: this uses it's own predicate...
function getGIDBefore(gid, ribbon, search, data){
	gid = gid == null ? getImageGID() : gid
	data = data == null ? DATA : data
	// XXX get a ribbon without getting into DOM...
	// 		...dependency leek...
	ribbon = ribbon == null ? getGIDRibbonIndex(gid, data) : ribbon
	search = search == null ? binSearch : search
	//search = search == null ? match2(linSearch, binSearch) : search
	ribbon = data.ribbons[ribbon]
	var order = data.order

	var target = order.indexOf(gid)

	return search(target, ribbon, function(a, i, lst){
		var b = order.indexOf(lst[i])

		// special case: tail...
		if(i == lst.length-1 && a >= b){
			return 0
		}

		var c = order.indexOf(lst[i+1])
	
		// hit...
		if(a == b || (a > b && a < c)){
			return 0

		// before...
		} else if(a < b){
			return -1

		// later...
		} else {
			return 1
		}
	})
}


// Get "count" of GIDs starting with a given gid ("from")
//
// NOTE: this will not include the 'from' GID in the resulting list, 
// 		unless inclusive is set to true.
// NOTE: count can be either negative or positive, this will indicate 
// 		load direction...
// NOTE: this can calculate the ribbon number where the image is located.
// NOTE: if an image can be in more than one ribbon, one MUST suply the
// 		correct ribbon number...
//
// XXX do we need more checking???
// XXX Race condition: when this is called while DATA is not yet fully 
// 		loaded (old data), the from gid will not be present in 
// 		DATA.ribbons...
function getImageGIDs(from, count, ribbon, inclusive){
	if(count == 0){
		return []
	}
	// ribbon default value...
	// XXX Race condition: if DATA is not yet loaded this can return 
	// 		ribbon == null...
	if(ribbon == null){
		$(DATA.ribbons).each(function(i, e){ 
			if(e.indexOf(from) >= 0){ 
				ribbon = i
				return false 
			} 
		})
	}
	ribbon = DATA.ribbons[ribbon]

	// ribbon this is empty or non-existant...
	// XXX need to check when can we get a ribbon == undefined case...
	// 		...race?
	//if(ribbon == null){
	//	// XXX
	//}
	if(ribbon == null || ribbon.length == 0){
		return []
	}
	if(count > 0){
		var c = inclusive == null ? 1 : 0
		var start = ribbon.indexOf(from) + c
		return ribbon.slice(start, start + count)
	} else {
		var c = inclusive == null ? 0 : 1
		var end = ribbon.indexOf(from)
		return ribbon.slice((Math.abs(count) >= end ? 0 : end + count + c), end + c)
	}
}


// Base URL interface...
//
// NOTE: changing a base URL will trigger a baseURLChanged event...
function getBaseURL(){
	return BASE_URL
}
function setBaseURL(url){
	var old_url = BASE_URL
	url = url.replace(/\/*$/, '/')
	BASE_URL = url
	$('.viewer').trigger('baseURLChanged', [old_url, url])
	return url
}


// Normalize the path...
//
// This will:
// 	- convert windows absolute paths 'X:\...' -> 'file:///X:/...'
// 	- if mode is 'absolute':
// 		- return absolute paths as-is
// 		- base relative paths on base/BASE_URL, returning an absolute 
// 			path
// 	- if mode is relative:
// 		- if absolute path is based on base/BASE_URL make a relative 
// 			to base path out of it buy cutting the base out.
// 		- return absolute paths as-is
// 		- return relative paths as-is
//
// NOTE: mode can be either 'absolute' (default) or 'relative'...
function normalizePath(url, base, mode, do_unescape){
	base = base == null ? getBaseURL() : base
	//mode = /^\./.test(base) && mode == null ? 'relative' : null
	mode = mode == null ? 'absolute' : mode
	// XXX is this the correct default?
	do_unescape = do_unescape == null ? true : do_unescape

	res = ''

	// windows path...
	//	- replace all '\\' with '/'...
	url = url.replace(/\\/g, '/')
	//	- replace 'X:/...' with 'file:///X:/...' 
	if(/^[A-Z]:\//.test(url)){
		url = 'file:///' + url
	}
	// UN*X/OSX path...
	if(url[0] == '/'){
		// XXX test exactly how many slashes to we need, two or three?
		url = 'file://' + url
	}

	// we got absolute path...
	if(/^(file|http|https):\/\/.*$/.test(url)){
		// check if we start with base, and remove it if so...
		if(mode == 'relative' && url.substring(0, base.length) == base){
			url = url.substring(base.length - 1)
			res = url[0] == '/' ? url.substring(1) : url

		// if it's a different path, return as-is
		} else if(mode == 'absolute'){
			res = url
		}

	// make an absolute path...
	} else if(mode == 'absolute') {
		// if base ends and url starts with '.' avoid making it a '..'
		if(base[base.length-1] == '.' && url[0] == '.'){
			res = base + url.substring(1)
		// avoid creating '//'...
		} else if(base[base.length-1] != '/' && url[0] != '/'){
			res = base + '/' + url
		} else {
			res = base + url
		}
	}

	// get the actual path...
	res = res.replace('${CACHE_DIR}', CACHE_DIR)

	// XXX legacy support...
	res = res.replace('.ImageGridCache', CACHE_DIR)

	if(do_unescape){
		return unescape(res)
	} else {
		return res
	}
}


// Select best preview by size...
//
// NOTE: this will use the original if everything else is smaller...
function getBestPreview(gid, size){
	gid = gid == null ? getImageGID(): gid
	size = size == null ? getVisibleImageSize('max') : size
	var s
	var img_data = IMAGES[gid]
	var url = img_data.path
	var preview_size = 'Original'
	var p = Infinity

	for(var k in img_data.preview){
		s = parseInt(k)
		if(s < p && s > size){
			preview_size = k
			p = s
			url = img_data.preview[k]
		}
	}
	return {
		url: normalizePath(url),
		size: preview_size
	}
}


// Orientation translation...
function orientationExif2ImageGrid(orientation){
	return {
		orientation: {
			0: 0,
			1: 0,
			2: 0,
			3: 180,
			4: 0,
			5: 90,
			6: 90,
			7: 90, 
			8: 270,
		}[orientation],
		flipped: {
			0: null,
			1: null,
			2: ['horizontal'],
			3: null,
			4: ['vertical'],
			5: ['vertical'],
			6: null,
			7: ['horizontal'],
			8: null,
		}[orientation]
	}
}



/**********************************************************************
* Constructors and general data manipulation
*/

// Construct an IMAGES object from list of urls.
//
// NOTE: this depends on that the base dir contains ALL the images...
// NOTE: if base is not given, this will not read image to get 
// 		orientation data...
function imagesFromUrls(lst, ctime_getter){
	ctime_getter = (ctime_getter == null 
			? function(){ return Date.now()/1000 } 
			: ctime_getter)
	var res = {}

	$.each(lst, function(i, e){

		/*
		// this is ugly but I'm bored so this is pretty...
		var ii =  i < 10		? '0000000' + i 
				: i < 100		? '000000' + i
				: i < 1000		? '00000' + i
				: i < 10000		? '0000' + i
				: i < 100000	? '000' + i
				: i < 1000000	? '00' + i
				: i < 10000000	? '0' + i
				: i
		*/
		i = i+''
		var ii = ('00000000' + i).slice(i.length)
		var gid = 'image-' + ii
		res[gid] = {
			id: gid,
			type: 'image',
			state: 'single',
			path: e,
			ctime: ctime_getter(e),
			preview: {},
			classes: '',
			orientation: 0,
		}
	})

	return res
}


// Construct a DATA object from a list of images
//
// NOTE: this will create a single ribbon...
function dataFromImages(images){
	var gids = Object.keys(images).sort()

	return {
		version: '2.0',
		current: gids[0],
		ribbons: [
			gids
		],
		order: gids.slice(),
		image_file: null
	}
}


// Clean out empty ribbons...
//
function dropEmptyRibbons(data){
	data = data == null ? DATA : data

	var ribbons = data.ribbons

	var i = 0
	while(i < ribbons.length){
		if(ribbons[i].length == 0){
			ribbons.splice(i, 1)
		} else {
			i++
		}
	}

	return data
}


// Merge two or more data objects
//
// Each data object can be:
// 	- straight data object
// 	- array with ribbon shift at position 0 and the data at 1.
//
// The shift can be either positive or negative value. Positive shift 
// will shift the ribbons down (add padding to the top), while negative 
// will shift the ribbons up.
//
// NOTE: if no shift is given it will default to 0, i.e. align by top 
// 		ribbon.
// NOTE: shifting one set of ribbons up (negative shift) is the same as
// 		shifting every other set down by the same amount down (positive).
// 		e.g. these shifts:
// 			-1	0	2	-5	0	0
// 		will be normalized to, or are equivalent to:
// 			4	5	7	0	5	5
// 		(we add abs max shift |-5| to each element, to align top to 0)
// NOTE: this will not set .current
// NOTE: there should not be any gid collisions between data sets.
//
// XXX should we try and resolve gid collisions here??
// 		...don't think so...
// XXX should we check the data version???
// XXX needs testing...
function mergeData(a, b){
	var order = []
	var ribbon_sets = []
	var shifts = []
	var shift = 0

	// prepare the data...
	// build the ribbon_set, shifts, accumulate order and set shift bounds...
	$.each(arguments, function(_, d){
		if(typeof(d) == typeof([]) && d.constructor.name == 'Array'){
			// process the shift...
			var s = d[0]
			shifts.push(s)
			// NOTE: min shift (max negative shift) is needed so as to 
			// 		calculate the actual padding per each aligned ribbon
			// 		set in the resulting structure...
			shift = Math.min(s, shift)
			// get the actual data...
			d = d[1]

		} else {
			// default shift...
			shifts.push(0)
		}
		ribbon_sets.push(d.ribbons)
		order = order.concat(d.order)
	})
	shift = Math.abs(shift)

	// normalize ribbon_set...
	// NOTE: this will shift the ribbons to the required alignment...
	$.each(shifts, function(i, s){
		if(shift + s != 0){
			ribbon_sets[i] = new Array(shift + s).concat(ribbon_sets[i])
		}
	})

	return {
		version: '2.0',
		current: null,
		ribbons: concatZip.apply(null, ribbon_sets),
		order: order, 
		image_file: null
	}
}


// Split the given data at gid1[, gid2[, ...]]
//
// This will return a list of data objects, each containing gids that 
// are later than gidN and earlier or the same as gidN+1, preserving the
// ribbon structure.
//
// NOTE: if a given object does not contain any gid in ribbon N then that
// 		ribbon will be represented by an empty list.
// NOTE: the above makes the data objects not compatible with anything that 
// 		expects the ribbon to have at least one gid.
// NOTE: this takes one or more gids.
// NOTE: this will not set .current fields.
// NOTE: this is the opposite of mergeData():
// 			mergeData(splitData(data, ...)) == data
// 		with the exception of .current
// NOTE: this will ALWAYS return n+1 sections for n gids, even though 
// 		some of them may be empty...
// 
// XXX this is a bit brain-dead at the moment...
// XXX do we need to check if supplied gids exist in data???
function splitData(data, gid1){
	var gids = []
	var res = []
	var cur = 0

	// build the resulting data objects...
	// XXX revise...
	for(var i=1; i<arguments.length; i++){
		var prev = cur
		cur = data.order.indexOf(arguments[i])
		gids.push(arguments[i])

		res.push({
			version: '2.0',
			current: null,
			ribbons: [], 
			order: data.order.slice(prev, cur), 
			image_file: null
		})
	}
	// tail section...
	res.push({
		version: '2.0',
		current: null,
		ribbons: [], 
		order: data.order.slice(cur), 
		image_file: null
	})

	// split the ribbons...
	for(var i=0; i<data.ribbons.length; i++){
		var r = data.ribbons[i]
		var cur = 0

		// get all split positions...
		// XXX revise...
		for(var j=0; j<gids.length; j++){
			var prev = cur
			var gid = getGIDBefore(gids[j], i, null, data)
			if(gid == gids[j]){
				var cur = r.indexOf(gid)
			} else {
				var cur = r.indexOf(gid) + 1
			}

			// split and save the section to the corresponding data object...
			res[j].ribbons.push(r.slice(prev, cur))
		}
		// tail section...
		res[j].ribbons.push(r.slice(cur))
	}

	return res
}


// Align a section of data to the base ribbon.
//
// The data will be "cut" vertically from start gid (inclusive) up until
// end the gid (non-inclusive), if given.
//
// If neither start and/or end gids are given then the ribbons above the
// base ribbon will be used to set the start and end.
//
// This will return a new data object, without modifying the original.
//
//
// Illustration of operation:
//	1) Initial state, locate bounds...
//
//			start ---+					 +--- end
//					 v					 v
//					|	oooooooooooo	|
//		...ooooooooo|ooooooooooooooooooo|ooooooooooooooooo... < base
//			oooo|oooooooooooooooooooooooo|ooooooo
//
//		The sections are split by precedence relative to the first and 
//		last elements of the ribbon above the current...
//		i.e. the first section contains all the elements less than the 
//		first, the third is greater than the last, and the mid-section 
//		contains all elements that are in-between (inclusive).
//
//
//	2) Split and realign sections...
//
//		...ooooooooo|   oooooooooooo    |ooooooooooooooooo... < base
//			oooo|    ooooooooooooooooooo |ooooooo
//			    |oooooooooooooooooooooooo|
//
//		The central section is shifted down (dropped), by 1 in this case.
//
//
//	3) Merge...
//
//		...ooooooooo|oooooooooooo|oooooooooooooooooooooooo... < base
//			oooo|ooooooooooooooooooo|ooooooo
//			    |oooooooooooooooooooooooo|
//
//
// NOTE: the ends of the set may get "messed up" unless explicitly marked.
// 		...the first/last several images in the base ribbon (if present)
// 		will get shifted to the top.
// NOTE: setting the start/end to the first/last images of the set will 
// 		effectively just change the base ribbon w.o. affecting any data.
// 		XXX test this!!!
// 		XXX does this require a faster short path (special case)?
//
//
// XXX for this to be "smart" we need to introduce a concept of a 
// 		"base ribbon" (default ribbon to align to) and supporting API...
// XXX figure out a way to accomplish one of (in order of preference):
// 		- auto-call this and make it expected and transparent to the user
// 		- manually called in *obvious* situations...
function alignDataToRibbon(base_ribbon, data, start, end){
	// XXX get base ribbon...
	base_ribbon = base_ribbon == null ? getBaseRibbonIndex() : base_ribbon
	data = data == null ? DATA : data

	// get the first and last elements of the ribbon-set above the base 
	// ribbon...
	if(start == null || end == null){
		var r = []
		for(var i=0; i < base_ribbon; i++){
			r.push(data.ribbons[i][0])
			r.push(data.ribbons[i][data.ribbons[i].length-1])
		}
		r.sort(function(a, b){return imageOrderCmp(a, b, null, data)})
	}
	start = start == null ? r[0] : start
	if(end == null){
		end = r[r.length-1]
		// get the gid after the end...
		// NOTE: this can be null/undefined if we are looking at the last 
		// 		element...
		end = data.order[data.order.indexOf(end)+1]
	}

	// NOTE: will this always return 3 sections (see docs), even if 
	// 		start and/or end are null...
	var sections = splitData(data, start, end)

	// prepare to align...
	sections[1] = [ base_ribbon, sections[1] ]
	
	var res = mergeData.apply(null, sections)
	res.current = data.current

	dropEmptyRibbons(res)

	return res
}


// Shift a section of ribbons n positions.
//
// Illustration of operation:
//	1) Initial state, X is the current image...
//
// 				oooooo|oooo
// 			oooooooooo|Xoooooooooo
// 		oooooooooooooo|oooooooooooooooo
//
//
//	2) shiftRibbons(X, n) with positive n (shift down)
//
// 				oooooo|
// 			oooooooooo|oooo
// 		oooooooooooooo|Xoooooooooo
// 					  |oooooooooooooooo
//
//
//	3) shiftRibbons(X, n) with negative n (shift up)
//
// 					  |oooo
// 				oooooo|Xoooooooooo
// 			oooooooooo|oooooooooooooooo
// 		oooooooooooooo|
//
//
// XXX needs testing...
// XXX should this modify the view in place (and reload?)???
// XXX this and alignDataToRibbon(...) share a lot of code, split into 
// 		two generations...
function shiftRibbonsBy(n, gid, data){
	gid = gid == null ? getImageGID() : gid
	data = data == null ? DATA : data

	var sections = splitData(data, gid)

	// prepare to align...
	sections[1] = [ n, sections[1] ]

	var res = mergeData.apply(null, sections)
	res.current = data.current

	dropEmptyRibbons(res)

	return res
}



/**********************************************************************
* Format conversion
*/

// Convert legacy Gen1 data format to current Gen3 (v2.0)
function convertDataGen1(data, cmp){
	var res = {
		data: {
			version: '2.0',
			current: null,
			ribbons: [],
			order: [], 
		},
		images: {}
	}
	cmp = cmp == null ?
			function(a, b){ 
				return imageDateCmp(a, b, null, res.images) 
			}
			: cmp
	var ribbons = res.data.ribbons
	var order = res.data.order
	var images = res.images

	// position...
	res.data.current = data.position
	
	// ribbons and images...
	$.each(data.ribbons, function(i, input_images){
		var ribbon = []
		ribbons.push(ribbon)
		for(var id in input_images){
			var image = input_images[id]
			ribbon.push(id)
			order.push(id)
			images[id] = image
		}
		ribbon.sort(cmp)
	})

	order.sort(cmp)

	// XXX STUB
	res.data.current = order[0]

	return res
}



/**********************************************************************
* Loaders
*/

// Update an image element
//
// NOTE: care must be taken to reset ALL attributes an image can have,
// 		a common bug if this is not done correctly, is that some settings
// 		may leak to newly loaded images...
// XXX do a pre-caching framework...
function updateImage(image, gid, size){
	image = $(image)
	var oldgid = getImageGID(image)

	if(oldgid == gid || gid == null){
		gid = oldgid

	} else {
		image
			.attr('gid', JSON.stringify(gid))
			.css({
				// clear the old preview...
				'background-image': '',
			})
	}
	size = size == null ? getVisibleImageSize('max') : size

	// get the image data...
	var img_data = IMAGES[gid]
	if(img_data == null){
		img_data = STUB_IMAGE_DATA
	}

	// preview...
	var p_url = getBestPreview(gid, size).url
	// NOTE: due to the fact that loading/caching the image might be at 
	// 		a different pace than calling updateImage(...) and .onload
	// 		events may trigger in any sequence, we need to update the
	// 		url in a persistent way so as to load the last call's image
	// 		regardless of actual handler call sequence...
	image.data().loading = p_url

	// pre-cache and load image...
	// NOTE: this will make images load without a blackout...
	// XXX add a cache of the form:
	// 			{
	// 				[<gid>, <size>]: Image,
	// 				...
	// 			}
	// 		- sort by use...
	// 		- limit length...
	//
	// 		...might also be a good idea to split cache to sizes and have
	// 		different  but as limits for different sizes, but as sizes 
	// 		can differ between images this is not trivial...
	var img = new Image()
	img.onload = function(){
		image.css({
				'background-image': 'url("'+ image.data().loading +'")',
			})
	}
	img.src = p_url

	// main attrs...
	image
		.attr({
			order: DATA.order.indexOf(gid),
			orientation: img_data.orientation == null ? 0 : img_data.orientation,
		})

	// flip...
	setImageFlipState(image, img_data.flipped == null ? [] : img_data.flipped)

	// marks...
	if(MARKED.indexOf(gid) != -1){
		image.addClass('marked')
	} else {
		image.removeClass('marked')
	}

	return image
}


// Same as updateImage(...) but will update all images.
//
// NOTE: this will prioritize images by distance from current image...
//
// XXX need to run this in the background...
function updateImages(size, cmp){
	var deferred = $.Deferred()

	function _worker(){
		size = size == null ? getVisibleImageSize('max') : size

		// sorted run...
		if(UPDATE_SORT_ENABLED && cmp != false){
			cmp = cmp == null ? 
					makeGIDDistanceCmp(getImageGID(), getImageGID) 
					// XXX this is more correct but is slow...
					//makeGIDRibbonDistanceCmp(getImageGID(), getImageGID) 
				: cmp
			deferred.resolve($('.image')
				// sort images by distance from current, so as to update what 
				// the user is looking at first...
				.sort(cmp)
				.each(function(){
					updateImage($(this), null, size)
				}))

		// do a fast run w.o. sorting images...
		} else {
			deferred.resolve($('.image')
				.each(function(){
					updateImage($(this), null, size)
				}))
		}
	}

	if(UPDATE_SYNC){
		_worker()
	} else {
		setTimeout(_worker, 0)
	}

	return deferred
}


/* XXX for some very odd reason this is slower that the monster above...
function updateImages(size){
	size = size == null ? getVisibleImageSize('max') : size
	return $('.image')
		.each(function(){
			updateImage($(this), null, size)
		})
}
*/

// Get a sub-ribbon of count elements around a given gid
//
//	+- ribbon	   count
//	v			|<------>|
// 	ooooooooooooooooXoooooooooooooooo	->	ooooXoooo
// 					^
// 				   gid
//
// If gid does not exist in the requested ribbon then getGIDBefore() is
// used to get an appropriate alternative gid.
//
// NOTE: skipping gid and ribbon while passing data may not work correctly...
// NOTE: count represents section diameter...
function getGIDsAround(count, gid, ribbon, data){
	// default values...
	data = data == null ? DATA : data
	gid = gid == null ? getImageGID() : gid
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	count = count == null ? Math.round(LOAD_SCREENS * getScreenWidthInImages()) : count

	var ribbon_data = data.ribbons[ribbon]
	// get a gid that's in the current ribbon...
	gid = ribbon_data.indexOf(gid) < 0 ? getGIDBefore(gid, ribbon, null, data) : gid

	// calculate the bounds...
	var i = ribbon_data.indexOf(gid)

	var start = i - Math.floor(count/2)
	start = start < 0 ? 0 : start

	var end = i + Math.ceil(count/2)
	end = end > ribbon_data.length ? ribbon_data.length : end

	// get the actual data...
	return ribbon_data.slice(start, end)
}


// NOTE: this expects that both arrays cleanly intersect each other only 
// 		once...
function getCommonSubArrayOffsets(L1, L2){
	var res = {}

	// defaults for if one of the lists is empty...
	if(L1.length == 0){
		res.left = -(L2.length)
		res.right = 0
		return res
	} else if(L2.length == 0){
		res.left = L1.length 
		res.right = 0
		return res
	}

	// head...
	var a = L2.indexOf(L1[0])
	var b = L1.indexOf(L2[0])
	res.left = a >= 0 ? -a 
			: b >= 0 ? b 
			: null

	// tail...
	a = L2.indexOf(L1[L1.length-1])
	b = L1.indexOf(L2[L2.length-1])
	res.right = a >= 0 ? -(L2.length - a - 1)
			: b >= 0 ? L1.length - b - 1
			: null

	return res
}


// NOTE: this expects that bot arrays cleanly intersect each other only 
// 		once...
function getCommonSubArray(L1, L2){
	var res = getCommonSubArrayOffsets(L1, L2)
	var left = res.left
	var right = res.right

	if(left == null && right == null){
		return []
	}

	//a = L1.slice(Math.max(0, left), L1.length - Math.max(right, 0))
	//b = L2.slice(Math.max(0, -left), L2.length - Math.max(-right, 0))
	return L1.slice(Math.max(0, left), L1.length - Math.max(right, 0))
}


function loadImagesAround(count, gid, ribbon, data){
	// default values...
	data = data == null ? DATA : data
	gid = gid == null ? getImageGID() : gid
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	ribbon = typeof(ribbon) != typeof(123) ? getRibbonIndex(ribbon) : ribbon
	count = count == null ? Math.round(LOAD_SCREENS * getScreenWidthInImages()) : count

	gid = data.ribbons[ribbon].indexOf(gid) < 0 ? getGIDBefore(gid, ribbon, null, data) : gid

	var ribbon_elem = getRibbon(ribbon)

	var old_ribbon = ribbon_elem
		.find('.image')
		.map(function(_, e){ return getImageGID(e) })
		.toArray()
	var new_ribbon = getGIDsAround(count, gid, ribbon, data)

	// get the common sub-ribbon...
	// NOTE: we are only interested in continuous sub-ribbons...
	var res = getCommonSubArrayOffsets(new_ribbon, old_ribbon)
	var left = res.left
	var right = res.right

	// special case: nothing to do...
	if(left == 0 && right == 0){
		return ribbon_elem.find('.image')
	}

	var size = getVisibleImageSize('max')

	/*
	// XXX this means something is REALLY wrong...
	// NOTE: if at least one of left or right is null then there might 
	// 		be an error loading the ribbons...
	if(left == null || right == null){
		// XXX this code is temporary...
		console.warn('Something is wrong with loaded ribbon #'+ribbon+', reloading...')
		left = null
		right = null
	}
	*/
	// XXX might be magic but now this appears to work!!!
	// XXX this still is quite buggy!!
	// no common sections, do a full reload...
	//if(left == null && right == null){
	if(left == null || right == null){
		console.warn('Ribbon #'+ribbon+', reloading...')

		var n = new_ribbon.indexOf(gid)
		var o = old_ribbon.indexOf(gid)
		o = o < 0 ? n : o

		var left = n - o
		var right = (new_ribbon.length - old_ribbon.length) - left

		console.log('>>>', left, right, 
				//'--- images:', ribbon_elem.find('.image').length,
				'new:', new_ribbon.length,
				'@', n,
				'old:', old_ribbon.length,
				'@', o)

		extendRibbon(left, right, ribbon_elem)

		ribbon_elem.find('.image')
			.each(function(i, e){
				updateImage(e, new_ribbon[i], size)
			})
		var updated = new_ribbon.length

	// partial reload...
	} else {
		console.warn('Ribbon #'+ribbon+', updating...')

		var res = extendRibbon(left, right, ribbon_elem)
		// XXX this will get all the current images, not the resulting ones...
		var images = ribbon_elem.find('.image')

		var updated = 0

		// update the images...
		res.left.each(function(i, e){
			updateImage(e, new_ribbon[i], size)
			updated++
		})
		var l = res.right.length
		res.right.each(function(i, e){
			updateImage(e, new_ribbon[new_ribbon.length-l+i], size)
			updated++
		})
	}

	if(updated > 0){
		$('.viewer').trigger('updatedRibbon', [ribbon_elem])
	}

	// XXX is this the right place for this?
	// XXX this might be too global, do only the images loaded...
	correctImageProportionsForRotation(images)
	return images
}


/*
// Load count images around a given image/gid into the given ribbon.
//
// NOTE: this will reload the current image elements...
// NOTE: this is similar to extendRibbon(...) but different in interface...
// NOTE: load only what is needed instead of reloading everything...
// NOTE: this will not change alignment if the current image is within 
// 		the target range...
//
// XXX for some magical (unknown) reason this returns BEFORE all the 
// 		elements this creates actually exist (async)...
function loadImages(ref_gid, count, ribbon){
	ribbon = $(ribbon)
	var images = ribbon.find('.image')
	var ribbon_i = getRibbonIndex(ribbon)
	var gid = getGIDBefore(ref_gid, ribbon_i)
	gid = gid == null ? DATA.ribbons[ribbon_i][0] : gid

	// start/end points...
	var l = DATA.ribbons[ribbon_i].length
	if(l <= count){
		var from_i = 0

	} else {
		var from_i = DATA.ribbons[ribbon_i].indexOf(gid) - Math.floor(count/2)
		// special case: head...
		from_i = from_i < 0 ? 0 : from_i
		// special case: tail...
		from_i = l - from_i < count ? l - count : from_i
	}
	var from_gid = DATA.ribbons[ribbon_i][from_i]

	var old_gids = getImageGIDs(getImageGID(images.first()), images.length, ribbon_i, true)
	var gids = getImageGIDs(from_gid, count, ribbon_i, true)

	// check if heads have a common gid and get the diff length...
	var i = gids.indexOf(old_gids[0])
	var j = old_gids.indexOf(gids[0])
	var head = i != -1 ? i 
		// check if we need to truncate...
		: j != -1 ? -j
		// XXX why is the default zero???
		: 0
	// check if tails have a common gid and get the diff length...
	i = gids.indexOf(old_gids[old_gids.length-1])
	j = old_gids.indexOf(gids[gids.length-1])
	var tail = i > 0 ? gids.length - i - 1
		// check if we need to truncate...
		: j > 0 ? -(old_gids.length - j - 1)
		// XXX why is the default zero???
		: 0

	var size = getVisibleImageSize('max')

	// XXX the next section might need some simplification -- feels bulky...
	// check if we have a common section at all / full reload...
	if(head == 0 && tail == 0){
		if(gids.indexOf(old_gids[0]) == -1){
			window.DEBUG && console.log('>>> (ribbon:', ribbon_i, ') FULL RELOAD --', gids.length)
			extendRibbon(0, gids.length - old_gids.length, ribbon)
			var images = ribbon
				.find('.image')
					.each(function(i, e){
						updateImage(e, gids[i], size)
					})
			$('.viewer').trigger('reloadedRibbon', [ribbon])

		// do nothing...
		// ...the requested section is the same as the one already loaded...
		} else {
			window.DEBUG && console.log('>>> (ribbon:', ribbon_i, ') NOTHING TO DO.')
			return images
		}

	// do a partial reload...
	} else {
		window.DEBUG && console.log('>>> (ribbon:', ribbon_i, ')', head, '+-('+ (old_gids.length) +')-+', tail)
		// NOTE: we do not need to do anything about alignment as 
		// 		extendRibbon will get the correct head and tail so as to
		// 		align everything by itself...
		var res = extendRibbon(head, tail, ribbon)
		
		// NOTE: if there was no extension (i.e. head/tail <= 0) then 
		// 		these will do nothing...
		res.left.each(function(i, e){
			updateImage(e, gids[i], size)
		})
		res.right.each(function(i, e){
			updateImage(e, gids[i + gids.length - tail], size)
		})
		$('.viewer').trigger('updatedRibbon', [ribbon])
		images = ribbon.find('.image')
	}

	// XXX is this the right place for this?
	// XXX this might be too global, do only the images loaded...
	correctImageProportionsForRotation(images)
	return images
}
*/


/*
// NOTE: this is here for testing...
function loadImagesAround(ref_gid, count, ribbon){
	var ribbon_i = getRibbonIndex(ribbon)
	var gid = getGIDBefore(ref_gid, ribbon_i)
	return loadImages(ref_gid, count, ribbon).filter('[gid="'+JSON.stringify(gid)+'"]').click()
}
*/


// Roll ribbon and load new images in the updated section.
//
// NOTE: this is signature-compatible with rollRibbon...
// NOTE: this will load data ONLY if it is available, otherwise this 
// 		will have no effect...
// NOTE: this can roll past the currently loaded images (n > images.length)
function rollImages(n, ribbon, extend, no_compensate_shift){
	if(n == 0){
		return $([])
	}
	ribbon = ribbon == null ? getRibbon() : $(ribbon)
	var images = ribbon.find('.image')

	var from = n > 0 ? getImageGID(ribbon.find('.image').last())
					: getImageGID(ribbon.find('.image').first())
	var gids = getImageGIDs(from, n)
	if(gids.length == 0){
		return $([])
	}
	// truncate the results to the length of images...
	if(n > images.length){
		gids.reverse().splice(images.length)
		gids.reverse()
	} else if(Math.abs(n) > images.length){
		gids.splice(images.length)
	}

	if(n < images.length){
		images = rollRibbon(gids.length * (n > 0 ? 1 : -1), ribbon, extend, no_compensate_shift)
	}

	var size = getVisibleImageSize('max')
	images.each(function(i, e){
		updateImage($(e), gids[i], size)
	})

	$('.viewer').trigger('updatedRibbon', [ribbon])

	// XXX is this the right place for this?
	correctImageProportionsForRotation(images)
	return images
}


// Reload the viewer using the current DATA and IMAGES objects
// XXX race condition...
function reloadViewer(images_per_screen){
	var ribbons_set = $('.ribbon-set')
	var current = DATA.current
	// if no width is given, use the current or default...
	var w = images_per_screen == null ? getScreenWidthInImages() : images_per_screen
	w = w > MAX_SCREEN_IMAGES ? DEFAULT_SCREEN_IMAGES : w

	// clear data...
	$('.ribbon').remove()

	// create ribbons...
	$.each(DATA.ribbons, function(i, e){
		createRibbon().appendTo(ribbons_set)
	})

	// create images...
	$('.ribbon').each(function(i, e){
		//loadImages(current, Math.min(w * LOAD_SCREENS, DATA.ribbons[i].length), $(this))
		loadImagesAround(Math.round(w * LOAD_SCREENS), current, i)
	})

	// XXX this may occur BEFORE the image is created...
	// 		...if the image is not loaded the focusingImage event handlers
	// 		will mess things up...
	// XXX need to call these when and only when current image is loaded...
	focusImage($('.image').filter('[gid="'+JSON.stringify(current)+'"]'))

	fitNImages(w)
	centerRibbons('css')
}


// Apply the current SETTINGS to current viewer
function loadSettings(){
	toggleTheme(SETTINGS['global-theme'])

	if(toggleSingleImageMode('?') == 'on'){
		var w = SETTINGS['single-image-mode-screen-images']
		if(window.PROPORTIONS_RATIO_THRESHOLD == null){
			var p = SETTINGS['single-image-mode-proportions']
			toggleImageProportions(p)
		}
	} else {
		var w = SETTINGS['ribbon-mode-screen-images']
		toggleImageInfo(SETTINGS['ribbon-mode-image-info'] == 'on' ? 'on' : 'off')
	}
	fitNImages(w)
}



/**********************************************************************
* Image caching...
*/

// TODO add global cache...
// 		- manage cache by number and preview size...
// 		- keep in biggish...


// NOTE: this will always overwrite the previous cache set for a ribbon...
// NOTE: it appears that sorting images by priority before loading them
// 		to cache has little or no effect on the order they are 
// 		loaded/rendered...
function preCacheRibbonImages(ribbon){
	var i = getRibbonIndex(ribbon)
	var size = getVisibleImageSize('max')
	var screen_size = getScreenWidthInImages(getVisibleImageSize())
	var cache_frame_size = (screen_size * LOAD_SCREENS) / 2
	var images = ribbon.find('.image')
	var first = getImageGID(images.first())
	var last = getImageGID(images.last())

	var gids = getImageGIDs(first, -cache_frame_size)
				.concat(getImageGIDs(last, cache_frame_size))

	var cache = []
	IMAGE_CACHE[i] = cache
	$.each(gids, function(i, e){
		var img = new Image()
		img.src = getBestPreview(e, size).url
		cache.push(img)
	})

	return cache
}


function preCacheAllRibbons(){
	$('.ribbon').each(function(){
		preCacheRibbonImages($(this))
	})
	return IMAGE_CACHE
}



/**********************************************************************
* URL history...
*/

function setupBaseURLHistory(){
	$('.viewer')
		.on('baseURLChanged', function(evt, old_url, new_url){
			BASE_URL_HISTORY.splice(0, 0, old_url)

			// truncate the history if needed...
			if(BASE_URL_HISTORY.length > BASE_URL_LIMIT){
				BASE_URL_HISTORY.splice(BASE_URL_LIMIT, BASE_URL_HISTORY.length)
			}
		})
}

// XXX...
function getNextLocation(){
}
function getPrevLocation(){
}



/**********************************************************************
* Actions...
*/

// Sort the ribbons by DATA.order and re-render...
//
// This is the main way to sort images:
// 	- sort DATA.order
// 	- call updateRibbonOrder() that will:
// 		- sort all the ribbons in DATA
// 		- trigger reloadViewer() to render the new state
//
// No direct sorting is required.
//
// NOTE: due to how the format is structured, to sort the images one 
// 		only needs to sort DATA.order and call this.
// NOTE: if no_reload_viewer is true, then no re-rendering is triggered.
function updateRibbonOrder(no_reload_viewer){
	for(var i=0; i < DATA.ribbons.length; i++){
		DATA.ribbons[i].sort(imageOrderCmp)
	}
	if(!no_reload_viewer){
		reloadViewer()
	}
}


// Action wrapper of alignDataToRibbon(...)
//
// Align ribbons to the current ribbon.
//
// XXX need to change the default to base ribbon for production...
function alignRibbons(ribbon){
	console.warn('alignRibbons(): not yet ready for production use!')
	// XXX remove this line for production....
	ribbon = ribbon == null ? getRibbonIndex() : ribbon

	DATA = alignDataToRibbon(ribbon)

	reloadViewer()
}



/******************************************************* Extension ***/

// Open image in an external editor/viewer
//
// NOTE: this will open the default editor/viewer.
function openImage(){
	if(window.runSystem == null){
		showErrorStatus('Can\'t run external programs.')
		return 
	}
	// XXX if path is not present try and open the biggest preview...
	return runSystem(normalizePath(IMAGES[getImageGID()].path, getBaseURL()))
}


// XXX
function openImageWith(prog){
	// XXX
}



/**********************************************************************
* Experimental & utility
*/

// The idea here is to add markers as first-class image-like elements...
//
// 	+ can be ordered
// 	- re-sorting via metadata will mess things up
//
// XXX this is not persistent...
function appendMarker(){
	return $('<div class="marker"/>').insertAfter(getImage())
}


// NOTE: if cmp is explicitly false then no sorting will be done.
function loadRibbonsFromPath(path, cmp, reverse, dir_name){
	path = path == null ? BASE_URL : path
	path = normalizePath(path)
	cmp = cmp == null ? imageDateCmp : cmp

	// NOTE: we explicitly sort later, this makes no difference 
	// 		speed-wise, but will make the code simpler...
	DATA.ribbons = ribbonsFromFavDirs(path, null, null, dir_name)

	// do the sort...
	if(cmp != false){
		sortImages(cmp, reverse)
	} else {
		reloadViewer()
	}

	return DATA
}


function readImageDate(gid, images){
	images = images == null ? IMAGES : images
	var img = images[gid]
	return getEXIFDate(normalizePath(img.path))
		.done(function(date){
			img.ctime = Date.fromTimeStamp(date).getTime()/1000
		})
}
function readImagesDates(images){
	images = images == null ? IMAGES : images

	return $.when.apply(null, $.map(images, function(_, gid){
		return readImageDate(gid, images)
			.done(function(){
				IMAGES_UPDATED.push(gid)
			})
	}))
}
function readImagesDatesQ(images){
	images = images == null ? IMAGES : images

	var queue = getWorkerQueue('date_reader')

	$.each(images, function(gid, img){
		queue.enqueue(readImageDate, gid, images)
			.always(function(){ 
				IMAGES_UPDATED.push(gid)
				queue.notify(gid, 'done') 
			})
	})

	return queue
}


// XXX deleting images is not sported, we need to explicitly re-save...
// XXX need to reload the viewer...
// XXX not tested...
function updateImageGID(gid, images, data){
	images = images == null ? IMAGES : images
	var img = images[gid]
	return getEXIFGID(normalizePath(img.path))
		.done(function(gid){
			img.id = gid
			// images...
			images[gid] = images[key]
			delete images[key]
			IMAGES_UPDATED.push(gid)

			// data...
			if(data != null){
				// replace current...
				if(data.current == key){
					data.current = gid
				}
				// replace in order...
				data.order[data.order.indexOf(key)] = gid
				// replace in ribbons...
				for(var i=0; i < data.ribbons; i++){
					var r = data.ribbons[i]
					var k = r.indexOf(key)
					if(k >= 0){
						r[k] = gid
					}
				}
			}
		})
}
function updateImagesGIDs(images, data){
	images = images == null ? IMAGES : images

	return $.when.apply(null, $.map(images, function(_, key){
		return updateImageGID(key, images, data)
	}))
}
function updateImagesGIDsQ(images, data){
	images = images == null ? IMAGES : images

	var queue = getWorkerQueue('gid_updater')

	$.each(images, function(_, key){
		queue.enqueue(updateImageGID, key, images, data)
			.always(function(){ queue.notify(key, 'done') })
	})

	return queue
}



/**********************************************************************
* vim:set ts=4 sw=4 spell :                                          */
