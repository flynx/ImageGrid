/**********************************************************************
* 
*
* TODO move DATA to a more logical context avoiding the global vars...
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var LOAD_SCREENS = 6
//var LOAD_THRESHOLD = 2

var DEFAULT_SCREEN_IMAGES = 4
var MAX_SCREEN_IMAGES = 12

// if set to true each image will have basic info written to its html 
// title attr.
var IMAGE_INFO = true

var CACHE_DIR = '.ImageGridCache'

// A stub image, also here for documentation...
var STUB_IMAGE_DATA = {
	id: 'SIZE',
	// entity type, can be 'image', 'group'
	type: 'image',
	// entity state, can be 'single', 'grouped', 'hidden', ...
	state: 'single',
	ctime: 0,
	path: './images/sizes/900px/SIZE.jpg',
	preview: {
		'150px': './images/sizes/150px/SIZE.jpg',
		'350px': './images/sizes/350px/SIZE.jpg',
		'900px': './images/sizes/900px/SIZE.jpg',
	},
	classes: '',
	orientation: 0,
}

// Data format...
var DATA = {
	version: '2.0',
	current: 0,
	// the ribbon cache...
	// in the simplest form this is a list of lists of GIDs
	ribbons: [
		$(new Array(100)).map(function(i){return i}).toArray()
	],
	// flat ordered list of images in current context...
	// in the simplest form this is a list of GIDs.
	order: $(new Array(100)).map(function(i){return i}).toArray(),

	// this can be used to store the filename/path of the file containing 
	// image data...
	image_file: null
}

// the images object, this is indexed by image GID and contains all 
// the needed data...
var IMAGES = {}
var IMAGES_UPDATED = []

var DATA_ATTR = 'DATA'

var MARKED = []

var IMAGE_CACHE = []

var SETTINGS = {
	'theme': null,
	'screen-images-ribbon-mode': null,
	'screen-images-single-image-mode': null,
	'single-image-mode-proportions': null,
}

var BASE_URL = '.'



/**********************************************************************
* Helpers
*/

// NOTE: this expects gids...
function imageDateCmp(a, b, data){
	data = data == null ? IMAGES : data
	return data[b].ctime - data[a].ctime
}


// NOTE: this expects gids...
function imageNameCmp(a, b, data){
	data = data == null ? IMAGES : data
	a = data[b].path.split('/').pop()
	b = data[a].path.split('/').pop()
	if(a == b){
		return 0
	} else if(a < b){
		return -1
	} else {
		return +1
	}
}

function imageOrderCmp(a, b, data){
	data = data == null ? DATA : data
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
function cmp(a, i, lst){
	var b = lst[i]
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
// NOTE: this is here mostly to make debuging easy...
function isBetween(a, i, lst){
	var b = lst[i]

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


// Basic liner search...
//
// NOTE: this is here for testing reasons only...
function linSearch(target, lst, check, return_position){
	check = check == null ? cmp : check

	for(var i=0; i < lst.length; i++){
		if(check(target, i, lst) == 0){
			return return_position ? i : lst[i]
		}
	}

	// no hit...
	return return_position ? -1 : null
}
Array.prototype.linSearch = function(target, cmp){
	return linSearch(target, this, cmp, true)
}


// Basic binary search implementation...
//
// NOTE: this will return the object by default, to return position set
// 		return_position to true.
// NOTE: by default this will use cmp as a predicate.
function binSearch(target, lst, check, return_position){
	check = check == null ? cmp : check
	var h = 0
	var t = lst.length - 1
	var m, res

	while(h <= t){
		m = Math.floor((h + t)/2)
		res = check(target, m, lst)
		
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
Array.prototype.binSearch = function(target, cmp){
	return binSearch(target, this, cmp, true)
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


// Same as getImageBefore, but uses gids and searches in DATA...
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


// Get a "count" of GIDs starting with a given gid ("from")
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



/**********************************************************************
* Constructors
*/

// NOTE: this depends on that the base dir contains ALL the images...
function imagesFromUrls(lst){
	var res = {}

	$.each(lst, function(i, e){

		// this is ugly but I'm bored so this is pretty...
		var ii = i < 10			? '0000000' + i 
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

function updateImage(image, gid, size){
	image = $(image)
	var title = ''
	if(gid == null){
		gid = getImageGID(image)
	} else {
		image.attr('gid', JSON.stringify(gid))
	}
	size = size == null ? getVisibleImageSize('max') : size

	// get the image data...
	var img_data = IMAGES[gid]
	if(img_data == null){
		img_data = STUB_IMAGE_DATA
	}
	var name = img_data.path.split('/').pop()

	// preview...
	var preview = getBestPreview(gid, size)
	image
		.css({
			'background-image': 'url("'+ preview.url +'")',
		})
		.attr({
			order: DATA.order.indexOf(gid),
			orientation: img_data.orientation == null ? 0 : img_data.orientation,
		})

	// image info...
	if(IMAGE_INFO){
		var info = image.find('.info')
		if(info.length == 0){
			info = $('<div/>')
				.addClass('info')
				.appendTo(image)
		}
		info.html(
			'Image: ' + name +
			'<br>Order: ' + DATA.order.indexOf(gid) +
			'<br>GID: '+ gid +
			(window.DEBUG ? '<br>Preview size:'+ preview.size : '') +
			''
		)
	} else {
		image.find('.info').remove()
	}

	// marks...
	if(MARKED.indexOf(gid) != -1){
		image.addClass('marked')
	} else {
		image.removeClass('marked')
	}

	return image
}


// Same as updateImage(...) but will update all images.
function updateImages(size){
	size = size == null ? getVisibleImageSize('max') : size
	return $('.image').each(function(){
		updateImage($(this), null, size)
	})
}


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


// NOTE: this is here for testing...
function loadImagesAround(ref_gid, count, ribbon){
	var ribbon_i = getRibbonIndex(ribbon)
	var gid = getGIDBefore(ref_gid, ribbon_i)
	return loadImages(ref_gid, count, ribbon).filter('[gid="'+JSON.stringify(gid)+'"]').click()
}


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


function loadData(images_per_screen){
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


function loadSettings(){
	toggleTheme(SETTINGS['theme'])

	if(toggleSingleImageMode('?') == 'on'){
		var w = SETTINGS['screen-images-single-image-mode']
		var p = SETTINGS['single-image-mode-proportions']
		toggleImageProportions(p)
	} else {
		var w = SETTINGS['screen-images-ribbon-mode']
	}
	fitNImages(w)
}



/**********************************************************************
* Image caching...
*/

// NOTE: this will always overwrite the previous cache set for a ribbon...
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
	return loadData()
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
	return loadData()
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

// load the target-specific handlers...
// CEF
if(window.CEF_dumpJSON != null){
	var dumpJSON = CEF_dumpJSON
	var listDir = CEF_listDir
	var removeFile = CEF_removeFile
	var runSystem = CEF_runSystem

// PhoneGap
} else if(false) {
	// XXX
	var dumpJSON = null 
	var listDir = null 
	var removeFile = null
	var runSystem = null
}


// Load images from file
//
// This will also merge all diff files.
function loadFileImages(path, no_load_diffs, callback){
	no_load_diffs = window.listDir == null ? true : no_load_diffs 

	// default locations...
	if(path == null){
		var base = normalizePath(CACHE_DIR)
		// find the latest images file...
		var path = $.map(listDir(base), function(e){ 
			return /.*-images.json$/.test(e) ? e : null
		}).sort().reverse()[0]
		path = path == null ? 'images.json' : path

		console.log('Loading:', path)

		path = base +'/'+ path
	
	// explicit path...
	// XXX need to account for paths without a CACHE_DIR
	} else {
		path = normalizePath(path)
		var base = path.split(CACHE_DIR)[0]
		base += '/'+ CACHE_DIR
	}

	var diff_data = {}
	var diff = true

	// collect and merge image diffs...
	// XXX no error handling if one of the diff loads fail...
	if(!no_load_diffs){
		var diff_data = [diff_data]
		var diffs_names = $.map(listDir(base), function(e){ 
			return /.*-images-diff.json$/.test(e) ? e : null
		}).sort()
		diff = $.when.apply(null, $.map(diffs_names, function(e, i){
					return $.getJSON(normalizePath(base +'/'+ e))
						// XXX this is ugly, had to do it this way as .then(...)
						// 		handlers get different argument sets depending on 
						// 		whether we have one or more deffereds here...
						.done(function(data){
							diff_data[i+1] = data
							console.log('Loaded:', e)
						})
				}))
			.then(function(){
				$.extend.apply(null, diff_data)
				diff_data = diff_data[0]
			})
	} 

	// load the main image file and merge the diff with it...
	return $.when(diff, $.getJSON(path))
		.done(function(_, json){
			json = json[0]
			$.extend(json, diff_data)
			IMAGES = json

			console.log('Loaded IMAGES...')

			callback != null && callback()
		})
		.fail(function(){
			console.error('ERROR LOADING:', path)
		})
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
		console.error('Can\'t save to file.')
		return
	}

	// remove the diffs...
	if(remove_diffs){
		$.each($.map(listDir(normalizePath(CACHE_DIR)), function(e){ 
				return /.*-images-diff.json$/.test(e) ? e : null
			}), function(i, e){
				console.log('removeing:', e)
				removeFile(normalizePath(CACHE_DIR +'/'+ e))
			})
		IMAGES_UPDATED = []
	}

	dumpJSON(name + '-images.json', IMAGES)
	//DATA.image_file = normalizePath(name + '-images.json', null, 'relative')
}


function loadFileState(data_path, callback){
	var base = data_path.split(CACHE_DIR)[0]
	base = base == data_path ? '.' : base
	var res = $.Deferred()

	$.getJSON(data_path)
		.done(function(json){
			BASE_URL = base

			// legacy format...
			if(json.version == null){
				json = convertDataGen1(json)
				DATA = json.data
				IMAGES = json.images
				MARKED = []
				loadData()

			// version 2.0
			} else if(json.version == '2.0') {
				DATA = json
				loadFileImages(DATA.image_file == null ?
							normalizePath(DATA.image_file, base) 
							: null)
					.done(function(){
						loadData()
						callback != null && callback()
						res.resolve()
					})

			// unknown format...
			} else {
				console.error('unknown format.')
				return
			}
		})
		.fail(function(){
			console.error('ERROR LOADING:', data_path)
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
	dumpJSON(name + '-marked.json', MARKED)

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


// Load a path
//
// This will try and to this in the following order:
// 	1) find a data file in the given path
// 	2) find a cache directory and a data file there
// 	3) list the images and load them as-is
//
// XXX make sure that save works...
function loadDir(path, raw_load){
	path = normalizePath(path)
	var orig_path = path
	var data

	var files = listDir(path)

	if(files == null){
		console.error('Path error:', path)
		return
	}

	if(!raw_load){
		data = $.map(files, function(e){ 
			return /.*-data.json$/.test(e) ? e : null
		}).sort().reverse()[0]
		data = (data == null && files.indexOf('data.json') >= 0) ? 'data.json' : data

		// look in the cache dir...
		if(data == null){
			path += '/' + CACHE_DIR

			files = listDir(path)
			if(files != null){
				data = $.map(listDir(path), function(e){ 
					return /.*-data.json$/.test(e) ? e : null
				}).sort().reverse()[0]
				data = (data == null && files.indexOf('data.json') >= 0) ? 'data.json' : data
			}
		}
	}

	// load the found data file...
	if(data != null){
		console.log('Loading:', data)

		data = path + '/' + data

		return loadFileState(data)

	// load the dir as-is...
	} else {
		files = listDir(orig_path)
		var image_paths = $.map(files, function(e){
			return /.*\.(jpg|jpeg|png|gif)$/i.test(e) ? e : null
		})

		if(image_paths.length == 0){
			console.error('No images in:', orig_path)
			return 
		}

		IMAGES = imagesFromUrls(image_paths)
		DATA = dataFromImages(IMAGES)
		BASE_URL = orig_path
		DATA.ribbons = ribbonsFromFavDirs()
		MARKED = []

		loadData()
	}
}


function updateRibbonsFromFavDirs(){
	DATA.ribbons = ribbonsFromFavDirs(null, null, imageOrderCmp)
	loadData()
}


// Open image in an external editor/viewer
//
// NOTE: this will open the default editor/viewer.
function openImage(){
	if(window.runSystem == null){
		console.error('Can\'t run external programs.')
		return 
	}
	// XXX if path is not present try and open the biggest preview...
	return runSystem(normalizePath(IMAGES[getImageGID()].path, BASE_URL))
}



/**********************************************************************
* Setup
*/

// Setup event handlers for data bindings...
//
// This does two jobs:
// 	- maintain DATA state
// 		- editor actions
// 		- focus
// 		- marking
// 	- maintain view consistency
// 		- centering/moving (roll)
// 		- shifting (expand/contract)
// 		- zooming (expand/contract)
//
function setupDataBindings(viewer){
	viewer = viewer == null ? $('.viewer') : viewer
	viewer
		// XXX need to maintain the correct number of images per ribbon
		// 		per zoom setting -- things get really odd when a ribbon 
		// 		is smaller than it should be...
		// XXX this does not get called on marking...
		.on('preCenteringRibbon', function(evt, ribbon, image){
			// NOTE: we do not need to worry about centering the ribbon 
			//		here, just ball-park-load the correct batch...

			var gid = getImageGID(image)
			var r = getRibbonIndex(ribbon)
			var gr = DATA.ribbons[r]
			var img_before = getImageBefore(image, ribbon)
			var gid_before = getGIDBefore(gid, r)
			var screen_size = getScreenWidthInImages()
			screen_size = screen_size < 1 ? 1 : screen_size
			var l = ribbon.find('.image').length

			// load images if we do a long jump -- start, end or some mark 
			// outside of currently loaded section...
			if(gid_before == null 
					|| gid_before != getImageGID(img_before) 
					// also load if we run out of images in the current ribbon,
					// likely due to shifting...
					|| ( gr.length > l 
						&& l < screen_size * LOAD_SCREENS)){
				loadImages(gid, Math.round(screen_size * LOAD_SCREENS), ribbon)
			} 

			// roll the ribbon while we are advancing...
			var head = img_before.prevAll('.image')
			var tail = img_before.nextAll('.image')

			// NOTE: if this is greater than the number of images currently 
			//		loaded, it might lead to odd effects...
			var frame_size = Math.ceil((screen_size * LOAD_SCREENS) / 2)
			//var threshold = Math.ceil(screen_size * LOAD_THRESHOLD)
			var threshold = Math.floor(frame_size / 2) 
			threshold = threshold < 1 ? 1 : threshold

			// do the loading...
			// XXX need to expand/contract the ribbon depending on speed...
			// 		...might also be a good idea to load smaller images 
			// 		while scrolling really fast...
			// XXX use extendRibbon, to both roll and expand/contract...
			// XXX BUG: when rolling a ribbon, this will sometimes 
			// 		misalign an image...
			// 		...where exactly this happens in the ribbon depends on 
			// 		its size and LOAD_SCREENS...
			// 		NOTE: calling centerView() will fix this.
			// 		...the problem is in centerRibbon
			if(tail.length < threshold){
				var rolled = rollImages(frame_size, ribbon)
			}
			if(head.length < threshold){
				var rolled = rollImages(-frame_size, ribbon)
			}
		})


		.on('shiftedImage', function(evt, image, from, to){
			from = getRibbonIndex(from)
			var ribbon = to
			to = getRibbonIndex(to)

			var gid = getImageGID(image)
			var after = getGIDBefore(gid, to)

			// remove the elem from the from ribbon...
			var index = DATA.ribbons[from].indexOf(gid)
			var img = DATA.ribbons[from].splice(index, 1)

			// put the elem in the to ribbon...
			index = after == null ? 0 : DATA.ribbons[to].indexOf(after) + 1
			DATA.ribbons[to].splice(index, 0, gid)

			// indicators...
			flashIndicator(from < to ? 'next' : 'prev')
		})


		.on('createdRibbon', function(evt, index){
			index = getRibbonIndex(index)
			DATA.ribbons.splice(index, 0, [])
		})
		.on('removedRibbon', function(evt, index){
			DATA.ribbons.splice(index, 1)
		})


		.on('requestedFirstImage', function(evt, ribbon){
			var r = getRibbonIndex(ribbon)
			var gr = DATA.ribbons[r]
			rollImages(-gr.length, ribbon)
		})
		.on('requestedLastImage', function(evt, ribbon){
			var r = getRibbonIndex(ribbon)
			var gr = DATA.ribbons[r]
			rollImages(gr.length, ribbon)
		})


		.on('fittingImages', function(evt, n){
			// load correct amount of images in each ribbon!!!
			var screen_size = getScreenWidthInImages()
			var gid = getImageGID()
			$('.ribbon').each(function(){
				var r = $(this)
				loadImages(gid, Math.round(screen_size * LOAD_SCREENS), r)
			})
			centerView(null, 'css')

			// update settings...
			if(toggleSingleImageMode('?') == 'on'){
				SETTINGS['screen-images-single-image-mode'] = n
			} else {
				SETTINGS['screen-images-ribbon-mode'] = n
			}

			// update previews...
			// XXX make this update only what needs updating...
			updateImages()
		})


		.on('focusingImage', function(evt, image){
			DATA.current = getImageGID($(image))
		})


		// basic image manipulation...
		// XXX after this we need to save the images...
		.on('rotatingLeft rotatingRight', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 
				var orientation = img.attr('orientation')

				IMAGES[gid].orientation = orientation
				if(IMAGES_UPDATED.indexOf(gid) == -1){
					IMAGES_UPDATED.push(gid)
				}
			})
		})


		// marks...
		// XXX toggle marking a block is not yet supported...
		.on('togglingMark', function(evt, img, action){
			var gid = getImageGID(img) 

			// add marked image to list...
			if(action == 'on'){
				MARKED.push(gid)

			// remove marked image from list...
			} else {
				MARKED.splice(MARKED.indexOf(gid), 1)
			}
		})
		.on('removeingRibbonMarks', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i != -1){
					MARKED.splice(i, 1)
				}
			})
		})
		.on('removeingAllMarks', function(evt){
			MARKED.splice(0, MARKED.length)
		})
		.on('markingRibbon', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i == -1){
					MARKED.push(e)
				}
			})
		})
		.on('markingAll', function(evt){
			MARKED.splice(0, MARKED.length)
			MARKED.concat(DATA.order)
		})
		.on('invertingMarks', function(evt, ribbon){
			$.each(DATA.ribbons[getRibbonIndex(ribbon)], function(_, e){
				var i = MARKED.indexOf(e)
				if(i == -1){
					MARKED.push(e)
				} else {
					MARKED.splice(i, 1)
				}
			})
		})


		// caching...
		.on('reloadedRibbon updatedRibbon', function(evt, ribbon){

			window.DEBUG && console.log('>>> (ribbon:', getRibbonIndex(ribbon), ') Updating cache...')

			preCacheRibbonImages(ribbon)
		})
}




/**********************************************************************
* vim:set ts=4 sw=4 spell :                                                */
