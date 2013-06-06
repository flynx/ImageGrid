/**********************************************************************
* 
*
* TODO move DATA to a more logical context avoiding the global vars...
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var DATA_ATTR = 'DATA'

var LOAD_SCREENS = 6

var DEFAULT_SCREEN_IMAGES = 4
var MAX_SCREEN_IMAGES = 12

var CACHE_DIR = '.ImageGridCache'

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

var MARKED = []

var SETTINGS = {
	'theme': null,
	'screen-images-ribbon-mode': null,
	'screen-images-single-image-mode': null,
	'single-image-mode-proportions': null,
	'image-info-ribbon-mode': 'off',
}

var BASE_URL = '.'

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


/*
var UI_IMAGE_CACHE = []
$.each([
	'images/loding.gif',
	'images/loding-90deg.gif',
	'images/loding-180deg.gif',
	'images/loding-270deg.gif'
], function(i, e){ 
	var img = new Image()
	img.src = e
	UI_IMAGE_CACHE.push(img)
})
*/

var UPDATE_SORT_ENABLED = false
// XXX for some reason the sync version appears to work faster...
var UPDATE_SYNC = false



/**********************************************************************
* Helpers
*/

function makeDistanceCmp(start, get){
	if(get == null){
		return function(a, b){
			return Math.abs(start - a) - Math.abs(start - b)
		}
	} else {
		start = get(start)
		return function(a, b){
			return Math.abs(start - get(a)) - Math.abs(start - get(b))
		}
	}
}


// Make a cmp function to compare two gids by distance from gid.
function makeImageGIDDistanceCmp(gid, get, order){
	order = order == null ? DATA.order : order
	return makeDistanceCmp(gid, get == null ? 
			function(a){
				return order.indexOf(a) 
			}
			: function(a){
				return order.indexOf(get(a))
			})
}


// NOTE: essentially this is a 2D distance compatison from gid...
//
// XXX make this faster...
// XXX this is fun, but do we actually need this?
function makeImageRibbonDistanceCmp(gid, get, data, images){
	data = data == null ? DATA : data
	images = images == null ? IMAGES : images

	// make a cmp index...
	var ribbons = $.map(DATA.ribbons, function(r, i){ 
		// sort each ribbon by distance from closest gid...
		//return [r.slice().sort(makeImageGIDDistanceCmp(getGIDBefore(gid, i)))] 
		return [r.slice().sort(makeImageGIDDistanceCmp(gid))] 
	})
	var gids = $.map(ribbons, function(e){ return [e[0]] })
	var ri = gids.indexOf(gid)

	function _getRibbon(gid){
		for(var i=0; i < ribbons.length; i++){
			if(ribbons[i].indexOf(gid) >= 0){
				return ribbons[i]
			}
		}
	}

	function _getDistance(a){
		var r = _getRibbon(a)
		var x = r.indexOf(a)
		var y = Math.abs(gids.indexOf(r[0]) - ri)

		// NOTE: this is cheating...
		//return x + y
		// calculate real distance...
		return Math.sqrt(x*x + y*y)
	}

	if(get == null){
		return function(a, b){
			return _getDistance(a) - _getDistance(b)
		}
	} else {
		return function(a, b){
			return _getDistance(get(a)) - _getDistance(get(b))
		}
	}
}


function cmp(a, b, get){
	if(get == null){
		return a - b
	}
	return get(a) - get(b)
}


// NOTE: this expects gids...
function imageDateCmp(a, b, get, data){
	data = data == null ? IMAGES : data
	if(get == null){
		return data[b].ctime - data[a].ctime
	} else {
		return data[get(b)].ctime - data[get(a)].ctime
	}
}


// NOTE: this expects gids...
function imageNameCmp(a, b, get, data){
	data = data == null ? IMAGES : data
	if(get == null){
		a = data[a].path.split('/').pop()
		b = data[b].path.split('/').pop()
	} else {
		a = data[get(a)].path.split('/').pop()
		b = data[get(b)].path.split('/').pop()
	}
	if(a == b){
		return 0
	} else if(a < b){
		return -1
	} else {
		return +1
	}
}


// NOTE: this expects gids...
function imageOrderCmp(a, b, get, data){
	data = data == null ? DATA : data
	if(get == null){
		return data.order.indexOf(a) - data.order.indexOf(b)
	} else {
		return data.order.indexOf(get(a)) - data.order.indexOf(get(b))
	}
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
function normalizePath(url, base, mode){
	mode = mode == null ? 'absolute' : mode
	base = base == null ? BASE_URL : base

	// windows path...
	//	- replace all '\\' with '/'...
	url = url.replace(/\\/g, '/')
	//	- replace 'X:/...' with 'file:///X:/...' 
	if(/^[A-Z]:\//.test(url)){
		url = 'file:///' + url
	}

	// we got absolute path...
	if(/^(file|http|https):\/\/.*$/.test(url)){
		// check if we start with base, and remove it if so...
		if(mode == 'relative' && url.substring(0, base.length) == base){
			url = url.substring(base.length - 1)
			return url[0] == '/' ? url.substring(1) : url

		// if it's a different path, return as-is
		} else if(mode == 'absolute'){
			return url
		}

	// make an absolute path...
	} else if(mode == 'absolute') {
		// if base ends and url starts with '.' avoid making it a '..'
		if(base[base.length-1] == '.' && url[0] == '.'){
			return base + url.substring(1)
		// avoid creating '//'...
		} else if(base[base.length-1] != '/' && url[0] != '/'){
			return base + '/' + url
		} else {
			return base + url
		}
	}
}


// Same as getImageBefore(...), but uses gids and searches in DATA...
//
// NOTE: this uses it's own predicate...
function getGIDBefore(gid, ribbon, search){
	gid = gid == null ? getImageGID() : gid
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	search = search == null ? binSearch : search
	//search = search == null ? match2(linSearch, binSearch) : search
	ribbon = DATA.ribbons[ribbon]
	var order = DATA.order

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
function getImageGIDs(from, count, ribbon, inclusive){
	if(count == 0){
		return []
	}
	// ribbon default value...
	if(ribbon == null){
		$(DATA.ribbons).each(function(i, e){ 
			if(e.indexOf(from) >= 0){ 
				ribbon = i
				return false 
			} 
		})
	}
	// XXX check if this is empty...
	ribbon = DATA.ribbons[ribbon]

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


// Resort the ribbons by DATA.order and re-render...
//
// NOTE: due to how the format is structured, to sort the images one 
// 		only needs to sort DATA.order and call this.
function updateRibbonOrder(no_reload_viewer){
	for(var i=0; i < DATA.ribbons.length; i++){
		DATA.ribbons[i].sort(imageOrderCmp)
	}
	if(!no_reload_viewer){
		reloadViewer()
	}
}



/**********************************************************************
* Constructors
*/

// Construct an IMAGES object from list of urls.
//
// NOTE: this depends on that the base dir contains ALL the images...
function imagesFromUrls(lst){
	var res = {}

	$.each(lst, function(i, e){

		// this is ugly but I'm bored so this is pretty...
		var ii =  i < 10		? '0000000' + i 
				: i < 100		? '000000' + i
				: i < 1000		? '00000' + i
				: i < 10000		? '0000' + i
				: i < 100000	? '000' + i
				: i < 1000000	? '00' + i
				: i < 10000000	? '0' + i
				: i
		var gid = 'image-' + ii
		res[gid] = {
			id: gid,
			type: 'image',
			state: 'single',
			path: e,
			ctime: Date.now(),
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


// Construct a ribbons hierarchy from the fav dirs structure
//
// NOTE: this depends on listDir(...)
// NOTE: this assumes that images contain ALL the images...
function ribbonsFromFavDirs(path, images, cmp){
	path = path == null ? BASE_URL : path
	images = images == null ? IMAGES : images

	// build a reverse name-gid index for fast access...
	var index = {}
	var name
	for(var gid in images){
		name = images[gid].path.split('/').pop()
		// XXX we assume that names are unique...
		index[name] = gid
	}

	var ribbons = []
	// add the base row...
	var base = Object.keys(images)
	ribbons.push(base)

	var files = listDir(path)	
	var cur_path = path
	while(files.indexOf('fav') >= 0){
		cur_path += '/fav'
		files = listDir(cur_path)
		ribbon = []
		// collect the images...
		$.each(files, function(i, e){
			var _gid = index[e]
			// filter out non-image files...
			if(/.*\.(jpg|jpeg)$/i.test(e)){
				ribbon.push(_gid)
			} 
			// remove the found item from each of the below ribbons...
			$.each(ribbons, function(i ,e){
				if(e.indexOf(_gid) != -1){
					e.splice(e.indexOf(_gid), 1)
				}
			})
		})
		ribbons.push(ribbon)
	}

	// remove empty ribbons and sort the rest...
	ribbons = $.map(ribbons, function(e){ 
		return e.length > 0 ? [cmp == null ? e : e.sort(cmp)] : null 
	})

	return ribbons.reverse()
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
				return imageDateCmp(a, b, res.images) 
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
function updateImage(image, gid, size){
	image = $(image)
	var oldgid = getImageGID(image)

	if(oldgid == gid || gid == null){
		gid = getImageGID(image)

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
	//var name = img_data.path.split('/').pop()

	// preview...
	var preview = getBestPreview(gid, size)

	// pre-cache and load image...
	// NOTE: make images load without a blackout..
	var img = new Image()
	img.onload = function(){
		image.css({
				'background-image': 'url("'+ preview.url +'")',
			})
	}
	img.src = preview.url

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
					makeImageGIDDistanceCmp(getImageGID(), getImageGID) 
					// XXX this is more correct but is slow...
					//makeImageRibbonDistanceCmp(getImageGID(), getImageGID) 
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


// Load count images around a given image/gid into the given ribbon.
//
// NOTE: this will reload the current image elements...
// NOTE: this is similar to extendRibbon(...) but different in interface...
// NOTE: load only what is needed instead of reloading everything...
// NOTE: this will not change alignment if the current image is within 
// 		the target range...
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
		: 0
	// check if tails have a common gid and get the diff length...
	i = gids.indexOf(old_gids[old_gids.length-1])
	j = old_gids.indexOf(gids[gids.length-1])
	var tail = i > 0 ? gids.length - i - 1
		// check if we need to truncate...
		: j > 0 ? -(old_gids.length - j - 1)
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
		loadImages(current, Math.min(w * LOAD_SCREENS, DATA.ribbons[i].length), $(this))
	})

	focusImage($('.image').filter('[gid="'+JSON.stringify(current)+'"]'))

	fitNImages(w)
	centerRibbons('css')
}


// Apply the current SETTINGS to current viewer
function loadSettings(){
	toggleTheme(SETTINGS['theme'])

	if(toggleSingleImageMode('?') == 'on'){
		var w = SETTINGS['screen-images-single-image-mode']
		var p = SETTINGS['single-image-mode-proportions']
		toggleImageProportions(p)
	} else {
		var w = SETTINGS['screen-images-ribbon-mode']
		toggleImageInfo(SETTINGS['image-info-ribbon-mode'] == 'on' ? 'on' : 'off')
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
// 		to cache has little or no affect on the order they are 
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
* localStorage
*
* XXX should we use jStorage here?
*/

function loadLocalStorageData(attr){
	attr = attr == null ? DATA_ATTR : attr
	var data = localStorage[attr]
	if(data == null){
		data = '{}'
	}
	var base = localStorage[attr + '_BASE_URL']
	base = base == null ? '.' : base
	return {
		data: JSON.parse(data),
		base_url: base,
	}
}
function saveLocalStorageData(attr){
	attr = attr == null ? DATA_ATTR : attr
	localStorage[attr] = JSON.stringify(DATA)
	localStorage[attr + '_BASE_URL'] = BASE_URL
}


function loadLocalStorageImages(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_IMAGES'
	var images = localStorage[attr]
	if(images == null){
		images = '{}'
	}
	return JSON.parse(images)
}
function saveLocalStorageImages(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_IMAGES'
	localStorage[attr] = JSON.stringify(IMAGES)
}


function loadLocalStorageMarks(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_MARKED'
	var marked = localStorage[attr]
	if(marked == null){
		marked = '[]'
	}
	MARKED = JSON.parse(marked)
	return reloadViewer()
}
function saveLocalStorageMarks(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_MARKED'
	localStorage[attr] = JSON.stringify(MARKED)
}


function loadLocalStorageSettings(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_SETTINGS'
	SETTINGS = JSON.parse(localStorage[attr])

	loadSettings()
}
function saveLocalStorageSettings(attr){
	attr = attr == null ? DATA_ATTR : attr
	attr += '_SETTINGS'
	localStorage[attr] = JSON.stringify(SETTINGS)
}


// generic save/load...
function loadLocalStorage(attr){
	attr = attr == null ? DATA_ATTR : attr
	var d = loadLocalStorageData(attr)
	BASE_URL = d.base_url
	DATA = d.data
	IMAGES = loadLocalStorageImages(attr)
	return reloadViewer()
}
function saveLocalStorage(attr){
	attr = attr == null ? DATA_ATTR : attr
	saveLocalStorageData(attr)
	saveLocalStorageImages(attr)
}



/**********************************************************************
* File storage (Extension API -- CEF/PhoneGap/...)
*
* XXX need to cleanup this section...
*/

function loadLatestFile(path, dfl, pattern, diff_pattern){
	dfl = dfl == null ? path.split(/[\/\\]/).pop() : dfl
	path = path == dfl ? '.' : path

	var res = $.Deferred()
	
	// can't find diffs if can't list dirs...
	if(window.listDir == null && (pattern != null || diff_pattern != null)){
		res.notify('unsupported', 'directory listing.')
		return res.reject('listDir unsupported.')
	}

	// find the latest...
	if(pattern != null){
		pattern = RegExp(pattern)
		var file = $.map(listDir(path), function(e){ 
			return pattern.test(e) ? e : null
		}).sort().reverse()[0]
	}
	var file = file == null ? dfl : file
	
	var diff_data = {}
	var diff = true

	// collect and merge diffs...
	if(diff_pattern != null){
		diff_pattern = RegExp(diff_pattern)
		var diff_data = [diff_data]
		var diffs_names = $.map(listDir(path), function(e){ 
			return diff_pattern.test(e) ? e : null
		}).sort()
		diff = $.when.apply(null, $.map(diffs_names, function(e, i){
					return $.getJSON(path +'/'+ e)
						.done(function(data){
							diff_data[i+1] = data
							res.notify('loaded', e)
						})
						.fail(function(){
							res.notify('load_error', e)
						})
				}))
			// NOTE: .then(...) handlers get different signature args 
			// 		depending on the number of arguments to .when(...)...
			.then(function(){
				$.extend.apply(null, diff_data)
				diff_data = diff_data[0]
			})
	} 

	// load the main file and merge the diff with it...
	$.when(diff, $.getJSON(path +'/'+ file))
		.done(function(_, json){
			json = json[0]

			res.notify('loaded', file)

			// merge diffs...
			if(Object.keys(diff_data).length != 0){
				$.extend(json, diff_data)
				res.notify('merged')
			}

			res.resolve(json)
		})
		.fail(function(){
			res.notify('load_error', file)

			return res.reject(file)
		})

	return res
}


function statusNotify(prefix, loader){
	return loader
		.progress(function(a, b, c){
			if(c != null){
				prefix = prefix +' '+ a
				var action = b
				var data = c
			} else {
				var action = a
				var data = b
			}

			({
				load: function(data){ 
					showStatus(prefix, 'Loading:', data) 
				},
				loaded: function(data){ 
					showStatus(prefix, 'Loaded:', data) 
				},
				merged: function(data){ 
					showStatus(prefix, 'Merging:', 'Done.') 
				},
				load_error: function(data){ 
					showErrorStatus(prefix, 'Loading:', data) 
				},
				unsupported: function(data){ 
					showErrorStatus(prefix, 'Unsupported:', data) 
				},
			})[action](data)
		})
		.done(function(){
			showStatus(prefix, 'Done.')
		})
}


// load the target-specific handlers...
// CEF
if(window.CEF_dumpJSON != null){
	var dumpJSON = CEF_dumpJSON
	var listDir = CEF_listDir
	var removeFile = CEF_removeFile
	var runSystem = CEF_runSystem
}


// Load images from file
//
// This will also merge all diff files.
function loadFileImages(path, no_load_diffs, callback){
	no_load_diffs = window.listDir == null ? true : no_load_diffs 

	var res = $.Deferred()

	// default locations...
	if(path == null){
		var base = normalizePath(CACHE_DIR) 
		var loader = loadLatestFile(base, 
				IMAGES_FILE_DEFAULT, 
				IMAGES_FILE_PATTERN, 
				IMAGES_DIFF_FILE_PATTERN)
	
	// explicit path...
	// XXX need to account for paths without a CACHE_DIR
	} else {
		path = normalizePath(path)
		var base = path.split(CACHE_DIR)[0]
		base += '/'+ CACHE_DIR

		// XXX is this correct???
		var loader = loadLatestFile(base, 
				path.split(base)[0], 
				RegExp(path.split(base)[0]))
	}

	loader
		// XXX find a good way to propagate...
		.progress(function(action, data){ 
			res.notify('Images:', action, data) 
		})
		.done(function(data){
			res.resolve(data)
		})

	res.done(function(images){
		IMAGES = images
		callback != null ? callback() : null
	})

	return res
}


// Save current images list...
//
// NOTE: this will save the merged images and remove the diff files...
// NOTE: if an explicit name is given then this will not remove anything.
// NOTE: if not explicit name is given this will save to the current 
// 		cache dir.
function saveFileImages(name){
	var remove_diffs = (name == null)
	name = name == null ? normalizePath(CACHE_DIR +'/'+ Date.timeStamp()) : name

	if(window.dumpJSON == null){
		showErrorStatus('Can\'t save to file.')
		return
	}

	// remove the diffs...
	if(remove_diffs){
		$.each($.map(listDir(normalizePath(CACHE_DIR)), function(e){ 
				return IMAGES_DIFF_FILE_PATTERN.test(e) ? e : null
			}), function(i, e){
				showStatus('removeing:', e)
				removeFile(normalizePath(CACHE_DIR +'/'+ e))
			})
		IMAGES_UPDATED = []
	}

	// XXX use the pattern...
	dumpJSON(name + '-images.json', IMAGES)
	//DATA.image_file = normalizePath(name + '-images.json', null, 'relative')
}


function loadFileMarks(path, callback){
	// default locations...
	if(path == null){
		var base = normalizePath(CACHE_DIR)
		var res = statusNotify('Marks:',
			loadLatestFile(base, 
				MARKED_FILE_DEFAULT, 
				MARKED_FILE_PATTERN))
	
	// explicit path...
	// XXX need to account for paths without a CACHE_DIR
	} else {
		path = normalizePath(path)
		var base = path.split(CACHE_DIR)[0]
		base += '/'+ CACHE_DIR

		// XXX is this correct???
		var res = statusNotify('Marks:',
			loadLatestFile(base, 
				path.split(base)[0], 
				RegExp(path.split(base)[0])))
	}

	res.done(function(images){
		MARKED = images
		callback != null ? callback() : null
	})

	return res
}
function saveFileMarks(name){
	name = name == null ? normalizePath(CACHE_DIR +'/'+ Date.timeStamp()) : name

	dumpJSON(name + '-marked.json', MARKED)
}


// XXX add support for explicit filenames...
function loadFileState(path){
	// XXX explicit data file path...
	if(/\.json$/i.test(path)){
		// XXX at this 
		var base = path.split(CACHE_DIR)[0]
		base = base == path ? '.' : base
	} else {
		var base = path.split(CACHE_DIR)[0]
		base = base == path ? '.' : base
	}

	var res = $.Deferred()

	statusNotify('Data:', 
			loadLatestFile(path, 
				DATA_FILE_DEFAULT, 
				DATA_FILE_PATTERN))
		.done(function(json){
			BASE_URL = base

			// legacy format...
			if(json.version == null){
				json = convertDataGen1(json)
				DATA = json.data
				IMAGES = json.images
				MARKED = []
				reloadViewer()
				res.resolve()

			// version 2.0
			} else if(json.version == '2.0') {
				DATA = json
				$.when(
						// XXX load config...
						// load images...
						loadFileImages(DATA.image_file == null ?
								normalizePath(DATA.image_file, base) 
								: null),
						// load marks if available...
						loadFileMarks())
					.done(function(){
						reloadViewer()
						res.resolve()
					})

			// unknown format...
			} else {
				res.reject('unknown format.')
			}

		})
		.fail(function(){
			res.reject('load_error', path)
		})

	return res
}
function saveFileState(name, no_normalize_path){
	name = name == null ? Date.timeStamp() : name

	if(!no_normalize_path){
		name = normalizePath(CACHE_DIR +'/'+ name)

	// write .image_file only if saving data to a non-cache dir...
	// XXX check if this is correct...
	} else {
		if(DATA.image_file == null){
			DATA.image_file = name + '-images.json'
		}
	}

	dumpJSON(name + '-data.json', DATA)
	// XXX do we need to do this???
	saveFileMarks(name)

	// save the updated images...
	if(IMAGES_UPDATED.length > 0){
		var updated = {}
		$.each(IMAGES_UPDATED, function(i, e){
			updated[e] = IMAGES[e]
		})
		dumpJSON(name + '-images-diff.json', updated)
		IMAGES_UPDATED = []
	}
}



// XXX check if we need to pass down sorting settings to the generators...
function loadRawDir(path){
	var files = listDir(path)

	var res = $.Deferred()

	var image_paths = $.map(files, function(e){
		return IMAGE_PATTERN.test(e) ? e : null
	})

	if(image_paths.length == 0){
		//showErrorStatus('No images in:', path)
		res.notify('load_error', path)
		return res.reject()
	}

	BASE_URL = path

	IMAGES = imagesFromUrls(image_paths)
	res.notify('loaded', 'images.')

	DATA = dataFromImages(IMAGES)
	res.notify('loaded', 'data.')

	DATA.ribbons = ribbonsFromFavDirs()
	res.notify('loaded', 'fav dirs.')

	MARKED = []

	sortImagesByDate()

	reloadViewer()

	return res.resolve()
}


// Load a path
//
// This will try and to this in the following order:
// 	1) find a data file in the given path
// 	2) find a cache directory and a data file there
// 		- load newest [.*-]images.json
// 		- load all [.*-]images-diff.json and merge with images
// 		- load newest [.*-]data.json
// 		- load newest [.*-]marked.json
// 	3) list the images and load them as-is
//
// XXX this will not load the marks file...
// XXX make sure that save works...
function loadDir(path){
	path = normalizePath(path)
	var orig_path = path
	var data

	var res = $.Deferred()

	showStatus('Loading:', path)
	res.notify('load', path)

	var files = listDir(path)

	if(files == null){
		//showErrorStatus('No files in path: ' + path)
		res.notify('load_error', path)
		return res.reject()
	}

	if(files.indexOf(CACHE_DIR) >= 0){
		path = path +'/'+ CACHE_DIR
	}

	statusNotify('Dir:', loadFileState(path))
		//.progress(function(action, data){
		//	res.notify(action, data)
		//})
		.done(function(){
			res.resolve()
		})
		.fail(function(){
			statusNotify('Raw dir:', loadRawDir(orig_path))
				.done(function(){
					res.resolve()
				})
				.fail(function(){
					res.reject()
				})
				
		})

	return res
}


// XXX loads duplicate images....
function updateRibbonsFromFavDirs(){
	DATA.ribbons = ribbonsFromFavDirs(null, null, imageOrderCmp)
	reloadViewer()
}



/**********************************************************************
* Actions...
*/

/******************************************************** Extension **/

// Open image in an external editor/viewer
//
// NOTE: this will open the default editor/viewer.
function openImage(){
	if(window.runSystem == null){
		showErrorStatus('Can\'t run external programs.')
		return 
	}
	// XXX if path is not present try and open the biggest preview...
	return runSystem(normalizePath(IMAGES[getImageGID()].path, BASE_URL))
}



/********************************************************** Sorting **/

function reverseImageOrder(){
	DATA.order.reverse()
	updateRibbonOrder()
}


// NOTE: using imageOrderCmp as a cmp function here will yield odd 
// 		results -- in-place sorting a list based on relative element 
// 		positions within itself is fun ;)
function sortImages(cmp, reverse){
	cmp = cmp == null ? imageDateCmp : cmp
	DATA.order.sort(cmp)
	if(reverse){
		DATA.order.reverse()
	}
	updateRibbonOrder()
}


// shorthands...
function sortImagesByDate(reverse){
	return sortImages(reverse)
}
function sortImagesByName(reverse){
	return sortImages(imageNameCmp, reverse)
}



/*************************************************** Manual sorting **/

// Ordering images...
// NOTE: this a bit more complicated than simply shifting an image 
// 		left/right the DATA.order, we have to put it before or after
// 		the prev/next image...
function horizontalShiftImage(image, direction){
	image = image == null ? getImage() : $(image)
	var gid = getImageGID(image)
	var r = getRibbonIndex(image)
	var ri = DATA.ribbons[r].indexOf(gid)

	// the image we are going to move relative to...
	var target = DATA.ribbons[r][ri + (direction == 'next' ? 1 : -1)]

	// we can hit the end or start of the ribbon...
	if(target == null){
		return image
	}

	// update the order...
	// NOTE: this is a critical section and must be done as fast as possible,
	// 		this is why we are using the memory to first do the work and 
	// 		then push it in...
	// NOTE: in a race condition this may still overwrite the order someone
	// 		else is working on, the data will be consistent...
	var order = DATA.order.slice()
	order.splice(order.indexOf(gid), 1)
	order.splice(order.indexOf(target) + (direction == 'next'? 1 : 0), 0, gid)
	// do the dirty work...
	DATA.order.splice.apply(DATA.order, [0, DATA.order.length].concat(order))

	// just update the ribbons, no reloading needed...
	updateRibbonOrder(true)

	// shift the images...
	getImage(target)[direction == 'prev' ? 'before' : 'after'](image)

	// update stuff that changed, mainly order...
	updateImages()

	return image
}
function shiftImageLeft(image){
	return horizontalShiftImage(image, 'prev')
}
function shiftImageRight(image){
	return horizontalShiftImage(image, 'next')
}




/**********************************************************************
* vim:set ts=4 sw=4 spell :                                          */
