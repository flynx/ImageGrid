/**********************************************************************
* 
*
*
**********************************************************************/

// format:
// 	{
// 		tag: [ gid, ... ],
// 		...
// 	}
//
var TAGS = {}



/*********************************************************************/

function buildTagsFromImages(images, tagset){
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	for(gid in images){
		var tags = images[gid].tags
		if(tags == null){
			continue
		}
		tags.map(function(tag){
			if(tagset[tag] == null){
				tagset[tag] = []
			}
			tagset[tag].push(gid)
		})
	}
}


// XXX
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
function selectByTags(tags, tagset){
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
			res.push(gid)
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
function tagOnlyList(list, tags){
	selectByTags(tags).forEach(function(gid){
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
	var set = selectByTags(tags)
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

function cropTagged(tags, cmp, keep_ribbons, keep_unloaded_gids){
	cmp = cmp == null ? imageOrderCmp : cmp
	var set = selectByTags(tags).sort(cmp)

	cropDataTo(set, keep_ribbons, keep_unloaded_gids)

	return DATA
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
