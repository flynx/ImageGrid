/**********************************************************************
* 
* Data API and Data DOM connections...
*
* TODO move DATA to a more logical context avoiding the global vars...
*
**********************************************************************/


var CONFIG = {
	// Application name...
	app_name: 'ImageGrid.Viewer',

	// Loader configuration...
	//
	//		load_screens	
	// 	|<---------------------->|
	// 	ooooooooooooXooooooooooooo
	// 					 |<----->|<------------>|
	// 						^	   roll_frame			  
	// 		load_threshold -+
	//
	// number of screens to keep loaded...
	//
	// NOTE: a "screen" is the number of images that can fit one screen
	// 		width, as returned by getScreenWidthInImages(..)
	load_screens: 6,
	// size of the frame to load relative to LOAD_SCREENS
	roll_frame: 1/3,
	// the threshold size relative to LOAD_SCREENS
	load_threshold: 1/4,

	// A threshold after which the image block ratio will be changed form 
	// 1x1 to 'fit-viewer' in single image mode...
	//
	// NOTE: if null this feature will be disabled.
	proportions_ratio_threshold: 1.5,

	// ribbon scaling limits and defaults...
	max_screen_images: 12,
	default_screen_images: 4,
	zoom_step_scale: 1.2,

	// localStorage prefix...
	data_attr: 'DATA',

	// file cache settings...
	cache_dir: '.ImageGrid',
	cache_dir_var: '${CACHE_DIR}',


	// If true updateImages(..) will sort the images before updating, so as
	// to make the visible images update first...
	//
	// XXX appears to have little effect...
	update_sort_enabled: false,

	// If set then the actual updating will be done in parallel. This is to 
	// make actions that lead to an update have less latency...
	//
	// XXX for some reason the sync version appears to work faster...
	update_sync: false,

	// If this is true image previews will be loaded synchronously...
	load_img_sync: false,

}

// User interface state...
// NOTE: these are named: <mode>-<feature>
var UI_STATE = {
	'global-theme': null,
	'ribbon-mode-screen-images': null,
	'single-image-mode-screen-images': null,
	'single-image-mode-proportions': null,
	'ribbon-mode-image-info': 'off',
}



/**********************************************************************
* Global state... 
*/

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
	//
	// NOTE: this may contain more gids than are currently loaded to 
	// 		the ribbons...
	order: [],

	// This can be used to store the filename/path of the file containing 
	// image data...
	//
	// This is optional.
	image_file: null
}

// A stub image, also here for documentation...
var STUB_IMAGE_DATA = {
	// Entity GID...
	id: 'STUB-GID',

	// Entity type
	//
	// can be:
	// 	- 'image'
	// 	- 'group'
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
	orientation: 0,

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
	flipped: null,

	// Image comment (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- string
	comment: null,

	// List of image tags (optional)
	//
	// can be:
	// 	- null/undefined
	// 	- array
	tags: null,
}

// The images object, this is indexed by image GID and contains all 
// the needed data...
//
// format:
// 	{
// 		<gid>: <image>,
// 		...
// 	}
//
// NOTE: see STUB_IMAGE_DATA for image format description...
var IMAGES = {}
// list of image GIDs that have been updated...
var IMAGES_UPDATED = []

var BASE_URL = '.'

// List of function that update image state...
//
// these are called by updateImage(..) after the image is created.
//
// each function must be of the form:
// 	updateImage(gid, image) -> image
//
var IMAGE_UPDATERS = []



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
/* XXX do we actually need to patch Array???
Array.prototype.binSearch = function(target, cmp, get){
	return binSearch(target, this, cmp, true, get)
}
*/


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
	console.warn('Base ribbon API is still a stub...')

	return 0
}
function setBaseRibbonIndex(n){
	n = n == null ? 0 : n

	// XXX
	console.warn('Base ribbon API is still a stub...')

	return n
}


// like getRibbonIndex but get the index only via DATA...
//
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


// get a list of gids in ribbon...
//
function getRibbonGIDs(a, data){
	data = data == null ? DATA : data
	if(typeof(a) == typeof(123)){
		return data.ribbons[a].slice()
	}
	return data.ribbons[getGIDRibbonIndex(a, data)].slice()
}


// like getImageOrder(..) but use DATA...
//
function getGIDOrder(gid){
	gid = gid == null ? getImageGID() : gid
	gid = typeof(gid) == typeof('str') ? gid : getImageGID(gid)
	return DATA.order.indexOf(gid)
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
	ribbon = typeof(ribbon) == typeof(123) ? data.ribbons[ribbon] : ribbon
	// get the current ribbon if gid is not in any of the loaded 
	// ribbons (crop mode)...
	ribbon = ribbon == null ? data.ribbons[getGIDRibbonIndex(null, data)] : ribbon
	//search = search == null ? match2(linSearch, binSearch) : search
	search = search == null ? binSearch : search
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


// Construct a function similar to getGIDBefore(..) that will get the 
// closest gid from a list...
//
// for exact protocol see: getGIDBefore(..)
//
// NOTE: this will consider only loaded images...
// NOTE: this needs the list sorted in the same order as the ribbons 
// 		i.e. via DATA.order...
// NOTE: passing a ribbon number or setting restrict_to_ribbon to true 
// 		will restrict the search to a specific ribbon only...
function makeGIDBeforeGetterFromList(get_list, restrict_to_ribbon){
	return function(gid, ribbon){
		ribbon = ribbon == null && restrict_to_ribbon == true 
			? getGIDRibbonIndex(gid) 
			: ribbon
		var list = get_list()
		if(list.length == 0){
			return null
		}
		console.log('>>>>', ribbon)
		gid = gid == null ? getImageGID(null, ribbon) : gid
		var prev

		// need to account for cropping here...
		// skip until we find a match from the list...
		do {
			prev = getGIDBefore(gid, list)
			gid = getGIDBefore(prev, ribbon)
		} while(prev != gid && prev != null)

		// nothing found before current image...
		if(prev == null){
			return prev
		}

		return prev
	}
}


// Get "count" of GIDs starting with a given gid ("from")
//
// count can be either negative or positive, this will indicate load 
// direction:
// 	count > 0	- load to left to right
// 	count < 0	- load to right to left
//
// from GID will not get included in the resulting list unless inclusive
// is set to true.
//
// NOTE: if no ribbon is given this will use the ribbon number where the
// 		from image is located.
// NOTE: if an image can be in more than one ribbon, one MUST suply the
// 		correct ribbon number...
//
// XXX do we need more checking???
// XXX Race condition: when this is called while DATA is not yet fully 
// 		loaded (old data), the from gid will not be present in 
// 		DATA.ribbons...
function getGIDsAfter(count, gid, ribbon, inclusive, data){
	if(count == 0){
		return []
	}
	// default values...
	gid = gid == null ? getImageGID() : gid
	data = data == null ? DATA : data
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	count = count == null ? Math.round(CONFIG.load_screens * getScreenWidthInImages()) : count
	ribbon = ribbon == null ? getGIDRibbonIndex(gid, data) : ribbon

	// get a local gid...
	gid = data.ribbons[ribbon].indexOf(gid) < 0 ? getGIDBefore(gid, ribbon) : gid
	ribbon = data.ribbons[ribbon]

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
		var start = ribbon.indexOf(gid) + c
		return ribbon.slice(start, start + count)
	} else {
		var c = inclusive == null ? 0 : 1
		var end = ribbon.indexOf(gid)
		return ribbon.slice((Math.abs(count) >= end ? 0 : end + count + c), end + c)
	}
}


// Get a sub-ribbon of count elements around a given gid
//
//	+- ribbon	   count
//	v			|<------>|
// 	...oooooooooooooXooooooooooooo...	->	ooooXoooo
// 					^
// 				   gid
//
// If gid does not exist in the requested ribbon then getGIDBefore() is
// used to get an appropriate alternative gid.
//
// If gid is less than count/2 to ribbon head/tail, then less than count
// gids will be returned
//
//	   count
//  |<------>|
// 	   oXooooooooooooo...	->	___oXoooo
// 		^
// 	   gid
//
//
// Setting force_count will make this always return count images, even 
// at the start and end of the ribbon.
//
//		  count
//	   |<------>|
// 	   oXooooooooooooo...	->	oXooooooo
// 		^
// 	   gid
//
// Otherwise this will return less.
//
// NOTE: skipping gid and ribbon while passing data may not work correctly...
// NOTE: count represents section diameter...
function getGIDsAround(count, gid, ribbon, data, force_count){
	if(count == 0){
		return []
	}
	// default values...
	data = data == null ? DATA : data
	gid = gid == null ? getImageGID() : gid
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	// XXX is this out of context here???
	count = count == null ? Math.round(CONFIG.load_screens * getScreenWidthInImages()) : count

	var ribbon_data = data.ribbons[ribbon]
	// get a gid that's in the current ribbon...
	gid = ribbon_data.indexOf(gid) < 0 ? getGIDBefore(gid, ribbon, null, data) : gid

	// calculate the bounds...
	var i = ribbon_data.indexOf(gid)

	var start = i - Math.floor(count/2)
	start = start < 0 ? 0 : start

	var end = i + Math.ceil(count/2)
	end = end > ribbon_data.length ? ribbon_data.length : end

	// force count by extending the ribbon at the opposite end...
	if(force_count && ribbon_data.length > count){
		var d = count - (end - start)

		start = end >= ribbon_data.length ? start - d  : start
		start = start < 0 ? 0 : start

		end = start <= 0 ? end + d : end
		end = end > ribbon_data.length ? ribbon_data.length : end
	}

	// get the actual data...
	return ribbon_data.slice(start, end)
}


// NOTE: this expects that both arrays cleanly intersect each other only 
// 		once...
// XXX this sometimes returns a null + value, which should be impossible...
// 		...this does not affect anything, but still need to investigate...
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
// 		see getCommonSubArrayOffsets(..) for more info...
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
	res = res.replace(CONFIG.cache_dir_var, CONFIG.cache_dir)

	// XXX legacy support...
	res = res.replace('.ImageGridCache', CONFIG.cache_dir)

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
	orientation = orientation == null ? 0 : orientation
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


// mark an image as updated...
//
function imageUpdated(gid){
	gid = gid == null ? getImageGID(): gid
	if(IMAGES_UPDATED.indexOf(gid) == -1){
		IMAGES_UPDATED.push(gid)
	}
}


// Make a next/prev image action
//
// Arguments:
// 	get_closest		: get the closest gid loaded, like getGIDBefore(..)
// 	get_list		: gid list getter, like getRibbonGIDs(..)
//
// NOTE: makeNextFromListAction(getGIDBefore, getRibbonGIDs) will generate 
// 		an action (almost) identical to nextImage()...
// 		Key differences:
// 			- nextImage(..) uses DOM to get the next image which is simpler
// 			- nextImage(..) accepts an offset argument
// NOTE: passing a ribbon number or setting restrict_to_ribbon to true 
// 		will restrict the search to a specific ribbon only...
//
// XXX not sure if we need the offset argument here... 
// 		a-la nextImage(n) / prevImage(n)
// XXX Q: is it cheaper to make a cached list that will contain only 
// 		loaded gids? 
// 		(i.e. filter it first and then get the needed gid rather 
// 		iterating...)
function makeNextFromListAction(get_closest, get_list, restrict_to_ribbon){
	get_closest = get_closest == null ? getGIDBefore : get_closest
	get_list = get_list == null ? getRibbonGIDs : get_list

	return function(ribbon){
		var list = get_list()
		if(list.length == 0){
			flashIndicator('end')
			return getImage()
		}
		var cur = getImageGID()
		ribbon = ribbon == null && restrict_to_ribbon == true 
			? getGIDRibbonIndex(cur) 
			: ribbon
		var o = getGIDOrder(cur)
		var next = get_closest(cur, ribbon)
		var i = list.indexOf(next)+1

		// we are before the first loaded bookmark, find the first...
		while((next == cur 
					|| next == null 
					|| getGIDOrder(next) < o) 
				&& i < list.length){
			next = list[i]
			next = get_closest(next, ribbon)
			i++
		}

		// did not find any loaded bookmarks after...
		if(i >= list.length 
				&& (next == null 
					|| next == cur 
					|| getGIDOrder(next) < o)){
			flashIndicator('end')
			return getImage(cur)
		}

		return showImage(next)
	}
}


// see makeNextFromListAction(..) above for documentation...
function makePrevFromListAction(get_closest, get_list, restrict_to_ribbon){
	get_closest = get_closest == null ? getGIDBefore : get_closest
	get_list = get_list == null ? getRibbonGIDs : get_list

	return function(ribbon){
		var list = get_list()
		if(list.length == 0){
			flashIndicator('start')
			return getImage(cur)
		}
		var cur = getImageGID()
		ribbon = ribbon == null && restrict_to_ribbon == true 
			? getGIDRibbonIndex(cur) 
			: ribbon
		var prev = get_closest(cur, ribbon)

		// nothing bookmarked before us...
		if(prev == null){
			flashIndicator('start')
			return getImage(cur)
		}

		// current image is bookmarked, get the bookmark before it...
		if(prev == cur){
			prev = list[list.indexOf(prev)-1]
			prev = prev != null ? get_closest(prev, ribbon) : prev
			// no loaded (crop mode?) bookmark before us...
			if(prev == null){
				flashIndicator('start')
				return getImage(cur)
			}
		}

		return showImage(prev)
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


// Construct a DATA object from a dict of images
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
* Loaders
*/

// Run all the image update functions registered in IMAGE_UPDATERS, on 
// an image...
//
function updateImageIndicators(gid, image){
	gid = gid == null ? getImageGID() : gid
	image = image == null ? getImage() : $(image)

	IMAGE_UPDATERS.forEach(function(update){
		update(gid, image)
	})

	return image
}


// helper...
function _loadImagePreviewURL(image, url){
	// pre-cache and load image...
	// NOTE: this will make images load without a blackout...
	var img = new Image()
	img.onload = function(){
		image.css({
				'background-image': 'url("'+ url +'")',
			})
	}
	img.src = url
	return img
}


// Update an image element
//
// NOTE: care must be taken to reset ALL attributes an image can have,
// 		a common bug if this is not done correctly, is that some settings
// 		may leak to newly loaded images...
function updateImage(image, gid, size, sync){
	image = image == null ? getImage() : $(image)
	sync = sync == null ? CONFIG.load_img_sync : sync
	var oldgid = getImageGID(image)

	if(oldgid == gid || gid == null){
		gid = oldgid

	} else {
		// remove old marks...
		if(typeof(oldgid) == typeof('str')){
			getImageMarks(oldgid).remove()
		}
		// reset gid...
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

	/* XXX does not seem to be needing this...
	// set the current class...
	if(gid == DATA.current){
		image.addClass('current')
	} else {
		image.removeClass('current')
	}
	*/

	// preview...
	var p_url = getBestPreview(gid, size).url

	// sync load...
	if(sync){
		_loadImagePreviewURL(image, p_url)

	// async load...
	} else {
		// NOTE: storing the url in .data() makes the image load the 
		// 		last requested preview and in a case when we manage to 
		// 		call updateImage(...) on the same element multiple times 
		// 		before the previews get loaded...
		// 		...setting the data().loading is sync while loading an 
		// 		image is not, and if several loads are done in sequence
		// 		there is no guarantee that they will happen in the same
		// 		order as requested...
		image.data().loading = p_url
		setTimeout(function(){ 
			_loadImagePreviewURL(image, image.data().loading)
		}, 0)
	}

	// main attrs...
	image
		.attr({
			order: DATA.order.indexOf(gid),
			orientation: img_data.orientation == null ? 0 : img_data.orientation,
		})

	// flip...
	setImageFlipState(image, img_data.flipped == null ? [] : img_data.flipped)

	// NOTE: this only has effect on non-square image blocks...
	correctImageProportionsForRotation(image)

	// marks and other indicators...
	updateImageIndicators(gid, image)

	return image
}


// Same as updateImage(...) but will update all loaded images.
//
// NOTE: this will prioritize images by distance from current image...
//
// XXX need to run this in the background...
function updateImages(size, cmp){
	var deferred = $.Deferred()

	function _worker(){
		size = size == null ? getVisibleImageSize('max') : size

		// sorted run...
		if(CONFIG.update_sort_enabled && cmp != false){
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

	if(CONFIG.update_sync){
		_worker()
	} else {
		setTimeout(_worker, 0)
	}

	return deferred
}


// Load count images around a given image/gid into the given ribbon.
//
// This is similar to getGIDsAround(..) but will load images into the 
// viewer...
function loadImagesAround(count, gid, ribbon, data, force_count){
	// default values...
	data = data == null ? DATA : data
	ribbon = ribbon == null ? getRibbonIndex() : ribbon
	ribbon = typeof(ribbon) != typeof(123) ? getRibbonIndex(ribbon) : ribbon
	count = count == null ? Math.round(CONFIG.load_screens * getScreenWidthInImages()) : count
	// get a gid that exists in the current ribbon...
	gid = getGIDBefore(gid, ribbon, null, data)

	var ribbon_elem = getRibbon(ribbon)

	var old_ribbon = ribbon_elem
		.find('.image')
		.map(function(_, e){ return getImageGID(e) })
		.toArray()
	var new_ribbon = getGIDsAround(count, gid, ribbon, data, force_count)

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

	// no common sections, do a full reload...
	// XXX NOTE: we use || instead of && here to compensate for an oddity
	// 		in getCommonSubArrayOffsets(...), see it for further details... 
	if(left == null || right == null){
		var n = new_ribbon.indexOf(gid)
		var o = old_ribbon.indexOf(gid)
		o = o < 0 ? n : o

		// calculate offsets...
		var left = n - o
		var right = (new_ribbon.length - old_ribbon.length) - left

		extendRibbon(left, right, ribbon_elem)

		// update the images...
		ribbon_elem.find('.image')
			.each(function(i, e){
				updateImage(e, new_ribbon[i], size)
			})
		var updated = new_ribbon.length

	// partial reload...
	} else {
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

	return images
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
	var r = typeof(ribbon) == typeof(123) ? ribbon : null
	ribbon = ribbon == null ? getRibbon() 
		: r != null ? getRibbon(ribbon)
		: $(ribbon)
	var r = r == null ? getRibbonIndex(ribbon) : r
	var images = ribbon.find('.image')

	var from = n > 0 ? getImageGID(ribbon.find('.image').last())
					: getImageGID(ribbon.find('.image').first())
	var gids = getGIDsAfter(n, from, r)
	if(gids.length == 0){
		return $([])
	}
	var l = gids.length
	// truncate the results to the length of images...
	if(n > 0 && l > images.length){
		gids.reverse().splice(images.length)
		gids.reverse()
	} else if(l > images.length){
		gids.splice(images.length)
	}
	l = gids.length

	if(l < images.length){
		images = rollRibbon(l * (n > 0 ? 1 : -1), ribbon, extend, no_compensate_shift)
	}

	var size = getVisibleImageSize('max')
	images.each(function(i, e){
		updateImage($(e), gids[i], size)
	})

	$('.viewer').trigger('updatedRibbon', [ribbon])

	return images
}


// Reload the viewer using the current DATA and IMAGES objects
function reloadViewer(images_per_screen){
	var ribbons_set = $('.ribbon-set')
	var current = DATA.current
	// if no width is given, use the current or default...
	var w = images_per_screen == null ? getScreenWidthInImages() : images_per_screen
	w = w > CONFIG.max_screen_images ? CONFIG.default_screen_images : w

	// clear data...
	$('.ribbon').remove()

	// create ribbons...
	$.each(DATA.ribbons, function(i, e){
		createRibbon().appendTo(ribbons_set)
	})

	// create images...
	$('.ribbon').each(function(i, e){
		loadImagesAround(Math.round(w * CONFIG.load_screens), current, i)
	})

	focusImage(getImage(current))

	fitNImages(w)
	centerRibbons('css')
}


// Apply the current UI_STATE to current viewer
function loadSettings(){
	toggleTheme(UI_STATE['global-theme'])

	if(toggleSingleImageMode('?') == 'on'){
		var w = UI_STATE['single-image-mode-screen-images']
		if(CONFIG.proportions_ratio_threshold == null){
			var p = UI_STATE['single-image-mode-proportions']
			toggleImageProportions(p)
		}
	} else {
		var w = UI_STATE['ribbon-mode-screen-images']
		toggleImageInfo(UI_STATE['ribbon-mode-image-info'] == 'on' ? 'on' : 'off')
	}
	fitNImages(w)
}



/**********************************************************************
* Actions...
*/

function showImage(gid){
	var img = getImage(gid)

	// target image not loaded...
	if(img.length == 0){
		DATA.current = gid
		reloadViewer()
		img = getImage(gid)

	// target is already loaded...
	} else {
		// XXX this does not load images correctly at times...
		centerView(focusImage(img))
		centerRibbons()
	}
	return img
}


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


// Focus next/prev image in order...
//
// This differs form nextImage/prevImage in that these are not 
// restricted to the current ribbon, and will hop up and down as 
// needed...
//
// NOTE: we need getGIDBefore here to account for possible cropped 
// 		ribbons...
var nextImageInOrder = makeNextFromListAction(
		getGIDBefore, 
		function(){ 
			return DATA.order
		})
var prevImageInOrder = makePrevFromListAction(
		getGIDBefore, 
		function(){ 
			return DATA.order
		})


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



/**********************************************************************
* Setup...
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
function setupData(viewer){
	console.log('Data: setup...')

	return viewer
		// NOTE: we do not need to worry about explicit centering the ribbon 
		//		here, just ball-park-load the correct batch...
		// NOTE: if we decide to hide ribbons, uncomment the visibility 
		// 		test down in the code...
		.on('preCenteringRibbon', function(evt, ribbon, image){
			var r = getRibbonIndex(ribbon)

			// skip all but the curent ribbon in single image view...
			if(toggleSingleImageMode('?') == 'on' && r != getRibbonIndex()){
				return 
			}

			// prepare for loading...
			var gid = getImageGID(image)
			var gr = DATA.ribbons[r]

			// NOTE: this can return null in certain cases (see docs)
			var gid_before = getGIDBefore(gid, r)
			// we'll set the image to the first if the align target is 
			// before it (i.e. gid_before is null)...
			var img_before = gid_before == null 
				? ribbon.find('.image').first() 
				: getImageBefore(image, ribbon)
			gid_before = gid_before == null ? gr[0] : gid_before

			var screen_size = getScreenWidthInImages()
			screen_size = screen_size < 1 ? 1 : screen_size
			var load_frame_size = Math.round(screen_size * CONFIG.load_screens)

			// target image is loaded...
			if(gid_before == getImageGID(img_before)){
				var roll_frame_size = Math.ceil(load_frame_size * CONFIG.roll_frame)
				var threshold = Math.floor(load_frame_size * CONFIG.load_threshold) 
				threshold = threshold < 1 ? 1 : threshold

				var head = img_before.prevAll('.image').length
				var tail = img_before.nextAll('.image').length
				var l = ribbon.find('.image').length
				var index = gr.indexOf(gid_before)
				var at_start = index < threshold
				var at_end = (gr.length-1 - index) < threshold

				// less images than expected - extend ribbon...
				if(l < load_frame_size){
					// NOTE: we are forcing the count of images...
					loadImagesAround(load_frame_size, gid, ribbon, null, true)

				// tail at threshold - roll ->
				} else if(!at_end && tail < threshold){
					var rolled = rollImages(roll_frame_size, ribbon)

				// head at threshold - roll <-
				} else if(!at_start && head < threshold){
					var rolled = rollImages(-roll_frame_size, ribbon)

				//} else {
				//	console.log('>>> skipping:', r)
				}

			// we jumped, load new set...
			} else {
				// NOTE: we are forcing the count of images...
				loadImagesAround(load_frame_size, gid, ribbon, null, true)
			}
		})

		.on('shiftedImage', function(evt, image, from, to){
			from = getRibbonIndex(from)
			//var ribbon = to
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
			//console.log('!!!! fittingImages')
			// load correct amount of images in each ribbon!!!
			var screen_size = getScreenWidthInImages()
			var gid = getImageGID()

			/* XXX used to skip ribbons that are not visible... (see bellow)
			var viewer = $('.viewer')
			var H = viewer.height()
			var h = getImage().height()
			*/

			// update and align ribbons...
			$('.ribbon').each(function(){
				var r = $(this)
				/* XXX skip ribbons that are not visible...
				 * 		causes misaligns and misloads on zoom-in...
				// NOTE: we factor in the scale difference to predict 
				// 		ribbon position in the new view...
				var t = getRelativeVisualPosition(viewer, r).top * (n/screen_size)
				if( t+h <= 0 || t >= H ){
					console.log('#### skipping align of ribbon:', getRibbonIndex(r))
					return
				}
				*/
				loadImagesAround(Math.round(screen_size * CONFIG.load_screens), gid, r, null, true)
			})

			centerView(null, 'css')

			// update settings...
			if(toggleSingleImageMode('?') == 'on'){
				UI_STATE['single-image-mode-screen-images'] = n
			} else {
				UI_STATE['ribbon-mode-screen-images'] = n
			}

			// update proportions...
			if(CONFIG.proportions_ratio_threshold != null 
					&& toggleSingleImageMode('?') == 'on'){

				var h = getVisibleImageSize('height')
				var w = getVisibleImageSize('width')
				var H = $('.viewer').innerHeight()
				var W = $('.viewer').innerWidth()

				var m = Math.min(W/w, H/h)

				if(m < CONFIG.proportions_ratio_threshold){
					toggleImageProportions('fit-viewer')
				} else {
					toggleImageProportions('none')
				}
			}

			// update size classes...
			// XXX make thresholds global...
			if(n <= 2.5){
				$('.viewer')
					.removeClass('small')
					.addClass('large')
			} else if (n >= 6) {
				$('.viewer')
					.addClass('small')
					.removeClass('large')
			} else {
				$('.viewer')
					.removeClass('small')
					.removeClass('large')
			}

			// update previews...
			updateImages()
		})

		.on('focusingImage', function(evt, image){
			image = $(image)
			DATA.current = getImageGID(image)

			// XXX should this be here???
			if(window.setWindowTitle != null){
				// XXX do we need to hide the extension...
				setWindowTitle(getImageFileName())
					//.split(/\.(jpg|jpeg|png|gif)$/)[0])
			}
		})

		// basic image manipulation...
		.on('rotatingLeft rotatingRight', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 
				var orientation = img.attr('orientation')

				// change the image orientation status and add to 
				// updated list...
				IMAGES[gid].orientation = orientation
				imageUpdated(gid)
			})
		})
		.on('flippingVertical flippingHorizontal', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 
				var flip = getImageFlipState(img)

				IMAGES[gid].flipped = flip
				imageUpdated(gid)
			})
		})
		.on('resetToOriginalImage', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 

				IMAGES[gid].flipped = null
				IMAGES[gid].orientation = 0

				imageUpdated(gid)
			})
		})

		.on('baseURLChanged', function(evt, url){
			saveLocalStorageBaseURL()
			saveLocalStorageBaseURLHistory()
		})
}
SETUP_BINDINGS.push(setupData)



/**********************************************************************
* vim:set ts=4 sw=4 spell :                                          */
