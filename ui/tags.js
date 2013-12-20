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



/*********************************************************************/

function buildTagsFromImages(tagset, images){
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

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
				tagset[tag].push(gid)
			}
		})
	}
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
			set.push(gid)
			set.sort()
		}

		if(img_tags.indexOf(tag) < 0){
			img_tags.push(tag)
		}
	})

	if(updated){
		img.tags = img_tags
		imageUpdated(gid)
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


// this implements the AND selector...
//
// NOTE: do not like this algorithm as it can get O(n^2)-ish
// NOTE: unless no_sort is set, this will sort the resulted gids in the
// 		same order as DATA.order...
function selectByTags(tags, no_sort, tagset){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	tagset = tagset == null ? TAGS : tagset

	var subtagset = []
	var res = []

	// populate the subtagset...
	tags.map(function(tag){
		if(tagset[tag] == null){
			return
		}
		subtagset.push(tagset[tag])
	})
	// sort by length...
	subtagset.sort(function(a, b){ 
		return b.length - a.length 
	})

	// set the res to the shortest subset...
	var cur = subtagset.pop().slice()

	// filter out the result...
	cur.map(function(gid){
		for(var i=0; i<subtagset.length; i++){
			if(subtagset[i].indexOf(gid) < 0){
				gid = null
				break
			}
		}
		if(gid != null){
			no_sort ? res.push(gid) : insertGIDToPosition(gid, res)
		}
	})

	return res
}


/*
// XXX don't remember the semantics...
function getRelatedTags(){
}
*/



/*********************************************************************/

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
	selectByTags(tags, no_sort).forEach(function(gid){
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
	MARKED = selectByTags(tags)
	updateImages()
	return MARKED
}
function unmarkTagged(tags){
	var set = selectByTags(tags, false)
	set.forEach(function(gid){
		var i = MARKED.indexOf(gid)
		if(i > -1){
			MARKED.splice(i, 1)
		}
	})
	updateImages()
	return set
}


/*********************************************************************/

// cropping of tagged images...

function cropTagged(tags, keep_ribbons, keep_unloaded_gids){
	var set = selectByTags(tags)

	cropDataTo(set, keep_ribbons, keep_unloaded_gids)

	return DATA
}



/**********************************************************************
* Setup...
*/

function setupTags(viewer){
	console.log('Tags: setup...')

	return viewer
		.on('imagesLoaded', function(){
			TAGS = {}

			showStatusQ('Tags: Index: building...')

			// XXX should this be sync???
			var t0 = Date.now()
			buildTagsFromImages()
			var t1 = Date.now()

			showStatusQ('Tags: Index: done ('+( t1 - t0 )+'ms).')
		})

}
SETUP_BINDINGS.push(setupTags)


// Setup the unsorted image state managers...
//
function setupUnsortedTagHandler(viewer){
	console.log('Tags: "'+UNSORTED_TAG+'" tag handling: setup...')

	return viewer
		// unsorted tag handling...
		.on('shiftedImage', function(evt, img){
			if(UNSORTED_TAG != null){
				removeTag(UNSORTED_TAG, getImageGID(img))
			}
		})
		.on('shiftedImages', function(evt, gids){
			if(UNSORTED_TAG != null){
				untagList(gids, UNSORTED_TAG)
			}
		})
		.on('aligningRibbonsSection', function(evt, base, gids){
			if(UNSORTED_TAG != null){
				untagList(gids, UNSORTED_TAG)
			}
		})
}
SETUP_BINDINGS.push(setupUnsortedTagHandler)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
