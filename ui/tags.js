/**********************************************************************
* 
*
*
**********************************************************************/

// NOTE: if this is set to null the feature will be disabled...
var UNSORTED_TAG = 'unsorted'

// Tag index
//
// This can be constructed from tags in IMAGES with buildTagsFromImages(..)
//
// format:
// 	{
// 		tag: [ gid, ... ],
// 		...
// 	}
//
var TAGS = {}


var TAGS_FILE_DEFAULT = 'tags.json'
var TAGS_FILE_PATTERN = /^[0-9]*-tags.json$/



/*********************************************************************/

function buildTagsFromImages(tagset, images){
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	var order = DATA.order

	for(var gid in images){
		var tags = images[gid].tags
		// no tags in this image...
		if(tags == null || tags.length == 0){
			continue
		}
		tags.forEach(function(tag){
			// first time we see this tag...
			if(tagset[tag] == null){
				tagset[tag] = []
			}
			// only update if not tagged...
			if(tagset[tag].indexOf(gid) < 0){
				// NOTE: this is cheating, but it's ~5x faster than 
				// 		insertGIDToPosition(..) but still 10^2 slower 
				// 		than .push(..) (unsorted tags)
				tagset[tag][order.indexOf(gid)] = gid
			}
		})
	}

	// cleanup...
	for(var tag in tagset){
		tagset[tag] = tagset[tag].filter(function(e){ return e != null })
	}

	tagsUpdated()

	return tagset
}


// XXX think I need to do something a-la fickr-style normalization here...
// XXX also need to remember the original notation...
function normalizeTag(tag){
	return tag.trim()
}



/**********************************************************************
* Actions...
*/

function getTags(gid){
	// XXX should we do any more checking here?
	return IMAGES[gid].tags
}


function addTag(tags, gid, tagset, images){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	gid = gid == null ? getImageGID() : gid
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	if(tags.length == 0){
		return
	}

	var updated = false
	var img = images[gid]
	img_tags = img.tags == null ? [] : img.tags

	// add tags to tagset...
	tags.map(function(tag){
		// skip empty tags...
		if(normalizeTag(tag) == ''){
			return
		}
		updated = true
		var set = tagset[tag]
		if(set == null){
			set = []
			tagset[tag] = set
		}
		if(set.indexOf(gid) < 0){
			insertGIDToPosition(gid, set)
		}

		if(img_tags.indexOf(tag) < 0){
			img_tags.push(tag)
		}
	})

	if(updated){
		img.tags = img_tags
		imageUpdated(gid)
		tagsUpdated()
	}
}


function removeTag(tags, gid, tagset, images){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	gid = gid == null ? getImageGID() : gid
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	if(tags.length == 0){
		return
	}

	var updated = false
	var img = images[gid]

	// remove tags to tagset...
	tags.map(function(tag){
		var set = tagset[tag]
		if(set != null && set.indexOf(tag) >= 0){
			set.splice(set.indexOf(tag), 1)
		}
		if(img.tags != null && img.tags.indexOf(tag) >= 0){
			updated = true
			img.tags.splice(img.tags.indexOf(tag), 1)
		}
	})

	// clear the tags...
	if(updated && img.tags.length == 0){
		delete img.tags
	}

	if(updated){
		imageUpdated(gid)
		tagsUpdated()
	}
}


// Update the tags of an image to the given list of tags...
//
// The resulting tag set of the image will exactly match the given list.
//
// NOTE: this will potentially both add and remove tags...
function updateTags(tags, gid, tagset, images){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	gid = gid == null ? getImageGID() : gid
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	var img = images[gid]

	// remove...
	if(img.tags != null){
		var rtags = []
		img.tags.map(function(tag){
			if(tags.indexOf(tag) < 0){
				rtags.push(tag)
			}
		})
		removeTag(rtags, gid, tagset, images)
	}

	// add...
	addTag(tags, gid, tagset, images)
}


/**********************************************************************
* Selectors...
*/

// Select gids tagged by ALL given tags...
//
function tagSelectAND(tags, from, no_sort, tagset){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	tagset = tagset == null ? TAGS : tagset
	from = from == null ? getLoadedGIDs() : from

	// special case: a single tag...
	// NOTE: this is significantly faster.
	if(tags.length == 1){
		var res = tagset[tags[0]]
		return res == null 
			? [] 
			: res.filter(function(gid){
				// skip unloaded...
				return from.indexOf(gid) >= 0
			})
	}

	var res = []
	var subtagset = []

	// populate the subtagset...
	tags.map(function(tag){
		if(tagset[tag] == null){
			subtagset = false
			return false
		}
		subtagset.push(tagset[tag])
	})
	// if at least one tag is invalid, we'll find nothing...
	if(subtagset == false){
		return []
	}
	// sort index by length...
	subtagset.sort(function(a, b){ 
		return b.length - a.length 
	})

	// start with the shortest subset...
	var cur = subtagset.pop().slice()

	// filter out the result...
	cur.map(function(gid){
		for(var i=0; i < subtagset.length; i++){
			if(subtagset[i].indexOf(gid) < 0){
				gid = null
				break
			}
		}
		// populate res...
		if(gid != null && from.indexOf(gid) >= 0){
			//no_sort == true ? res.push(gid) : insertGIDToPosition(gid, res)
			res.push(gid)
		}
	})

	if(!no_sort){
		fastSortGIDsByOrder(res)
	}

	return res
}


// select gids untagged by ALL of the given tags...
//
function tagSelectNOT(tags, from, tagset){
	var remove = tagSelectAND(tags, from, false, tagset)
	// keep the elements that DO NOT exist in remove...
	return from.filter(function(e){
		return remove.indexOf(e) < 0
	})
}


// Select gids tagged by ANY of the given tags...
//
function tagSelectOR(tags, from, no_sort, tagset){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	tagset = tagset == null ? TAGS : tagset
	from = from == null ? getLoadedGIDs() : from

	var all = []

	tags.forEach(function(tag){
		tag = tagset[tag]
		tag = tag == null ? [] : tag
		all = all.concat(tag)
	})

	return from.filter(function(e){
		return all.indexOf(e) >= 0
	})
}



/**********************************************************************
* List oriented tag operations...
*/

function tagList(list, tags){
	list.forEach(function(gid){
		addTag(tags, gid)
	})
	return list
}
function untagList(list, tags){
	list.forEach(function(gid){
		removeTag(tags, gid)
	})
	return list
}
// same as tagList(..), but will also remove the tags form gids no in 
// list...
function tagOnlyList(list, tags, no_sort){
	no_sort = no_sort == null ? true : false
	tagSelectAND(tags, null, no_sort)
		.forEach(function(gid){
			if(list.indexOf(gid) < 0){
				removeTag(tags, gid)
			}
		})
	return tagList(list, tags)
}


// tag manipulation of ribbon images...
function tagRibbon(tags){ return tagList(getRibbonGIDs(), tags) }
function untagRibbon(tags){ return untagList(getRibbonGIDs(), tags) }
function tagOnlyRibbon(tags){ return tagOnlyList(getRibbonGIDs(), tags) }

// tag manipulation of marked images...
function tagMarked(tags){ return tagList(MARKED, tags) }
function untagMarked(tags){ return untagList(MARKED, tags) }
function tagOnlyMarked(tags){ return tagOnlyList(MARKED, tags) }

// tag manipulation of bookmarked images...
function tagBookmarked(tags){ return tagList(BOOKMARKED, tags) }
function untagBookmarked(tags){ return untagList(BOOKMARKED, tags) }
function tagOnlyBookmarked(tags){ return tagOnlyList(BOOKMARKED, tags) }



/*********************************************************************/

// marking of tagged images...

function markTagged(tags){
	MARKED = tagSelectAND(tags)
	updateImages()
	marksUpdated()
	return MARKED
}
function unmarkTagged(tags){
	var set = tagSelectAND(tags, null, false)
	set.forEach(function(gid){
		var i = MARKED.indexOf(gid)
		if(i > -1){
			MARKED.splice(i, 1)
		}
	})
	updateImages()
	marksUpdated()
	return set
}


/*********************************************************************/

// Tag image that are not neighbored by an image tagged with the same 
// tags from at least one side.
//
// Essentially this will list tag block borders.
//
// NOTE: this will consider each gids's ribbon context rather than the 
// 		straight order context...
// XXX this is slow...
function listTagsAtGapsFrom(tags, gids){
	gids = gids == null ? getLoadedGIDs() : gids
	var list = tagSelectAND(tags, gids)
	var res = []

	list.forEach(function(gid){
		var ribbon = DATA.ribbons[getGIDRibbonIndex(gid)]
		var i = ribbon.indexOf(gid)

		// add the current gid to the result iff one or both gids 
		// adjacent to it are not in the list...
		if(list.indexOf(ribbon[i-1]) < 0 
				|| list.indexOf(ribbon[i+1]) < 0){
			res.push(gid)
		}
	})

	return res
}


function getGapEdge(direction, tag, gids){
	var get = direction == 'next' ? getGIDAfter : getGIDBefore

	gids = gids == null ? getRibbonGIDs() : gids
	var tagged = TAGS[tag].filter(function(e){ return gids.indexOf(e) >= 0 })
	var cur = getImageGID()
	var step = direction == 'next' ? 1 : -1

	// get the next element...
	cur = gids[gids.indexOf(cur) + step]

	// current is tagged -- skip till first untagged (not inclusive)...
	if(getTags(cur) != null && getTags(cur).indexOf(tag) >= 0){
		// skip the current...
		var i = gids.indexOf(cur)
		// get last in tag block...
		while(i >= 0 && i < gids.length 
				// lookahead -- we...
				&& tagged.indexOf(gids[i+step]) >= 0){ 
			i += step
		}
		var res = gids[i]

	// current is not tagged -- get closest tagged (inclusive)...
	} else {
		var res = get(cur, tagged)
	}

	if(res == null){
		flashIndicator(direction == 'next' ? 'end' : 'start')
		return getImage()
	}
	return showImage(res)
}
function nextGapEdge(tag, gids){
	return getGapEdge('next', tag, gids)
}
function prevGapEdge(tag, gids){
	return getGapEdge('prev', tag, gids)
}
function nextUnsortedSection(gids){
	return getGapEdge('next', 'unsorted', gids)
}
function prevUnsortedSection(gids){
	return getGapEdge('prev', 'unsorted', gids)
}



/*********************************************************************/

// cropping of tagged images...

function cropTagged(tags, keep_ribbons, keep_unloaded_gids){
	var set = tagSelectAND(tags)

	cropDataTo(set, keep_ribbons, keep_unloaded_gids)

	return DATA
}



/**********************************************************************
* Files...
*/

var loadFileTags = makeFileLoader(
		'Tags', 
		TAGS_FILE_DEFAULT, 
		TAGS_FILE_PATTERN, 
		false,
		function(data){ 
			// no tags loaded -- rebuild...
			if(data === false){
				var t0 = Date.now()
				buildTagsFromImages()
				var t1 = Date.now()

				console.warn('Tags: build tags.json: done ('+( t1 - t0 )+'ms) -- re-save the data.')

			// load the tags...
			} else {
				TAGS = data
			}
		})


// Save image marks to file
var saveFileTags = makeFileSaver(
		'Tags',
		TAGS_FILE_DEFAULT, 
		function(){ 
			return TAGS 
		})


function tagsUpdated(){
	fileUpdated('Tags')
	$('.viewer').trigger('tagsUpdated')
}



/**********************************************************************
* Setup...
*/

function setupTags(viewer){
	console.log('Tags: setup...')

	return viewer
		.on('imagesLoaded', function(){
			// XXX need to detect if tags have been loaded...
			TAGS = {}

			showStatusQ('Tags: Index: building...')

			// XXX should this be sync???
			var t0 = Date.now()
			buildTagsFromImages()
			var t1 = Date.now()

			showStatusQ('Tags: Index: done ('+( t1 - t0 )+'ms).')
		})
}
//SETUP_BINDINGS.push(setupTags)


// Setup the unsorted image state managers...
//
// Unsorted tags are removed by shifting or by aligning, but only in 
// uncropped mode...
function setupUnsortedTagHandler(viewer){
	console.log('Tags: "'+UNSORTED_TAG+'" tag handling: setup...')

	return viewer
		// unsorted tag handling...
		.on('shiftedImage', function(evt, img){
			if(UNSORTED_TAG != null && !isViewCropped()){
				removeTag(UNSORTED_TAG, getImageGID(img))
			}
		})
		.on('shiftedImages', function(evt, gids){
			if(UNSORTED_TAG != null && !isViewCropped()){
				untagList(gids, UNSORTED_TAG)
			}
		})
		.on('aligningRibbonsSection', function(evt, base, gids){
			if(UNSORTED_TAG != null && !isViewCropped()){
				untagList(gids, UNSORTED_TAG)
			}
		})
}
SETUP_BINDINGS.push(setupUnsortedTagHandler)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
