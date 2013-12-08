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
TAGS = {

}



/*********************************************************************/

function buildTagsFromImages(images){
}


/*********************************************************************/

function addTag(tags, gid, tagset, images){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	gid = gid == null ? getImageGID() : gid
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

	var img = images[gid]
	if(img.tags == null){
		img.tags = []
	}

	// add tags to tagset...
	tags.map(function(tag){
		var set = tagset[tag]
		if(set == null){
			set = []
			tagset[tag] = set
		}
		if(set.indexOf(tag) < 0){
			set.push(tag)
			set.sort()
		}

		if(img.tags.indexOf(tag) < 0){
			img.tags.push(tag)
		}
	})

	// XXX hardcoded and not customizable...
	IMAGES_UPDATED.push(gid)
}


function removeTag(tags, gid, tagset, images){
	tags = typeof(tags) == typeof('str') ? [ tags ] : tags
	gid = gid == null ? getImageGID() : gid
	tagset = tagset == null ? TAGS : tagset
	images = images == null ? IMAGES : images

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

			// clear the tags...
			if(img.tags.length == 0){
				delete img.tags
			}
		}
	})

	if(updated){
		// XXX hardcoded and not customizable...
		IMAGES_UPDATED.push(gid)
	}
}


// this implements the AND selector...
// NOTE: do not like this algorithm as it can get O(n^2)-ish
function selectByTags(tags, tagset){
	var subtagset = []
	var res = []

	// populate the subtagset...
	tags.map(function(tag){
		subtagset.push(tagset[tag])
	})
	subtagset.sort(function(a, b){ 
		return a.length - b.length 
	})

	// set the res to the shortest subset...
	var cur = subtagset.pop().splice()

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


function getTags(gid){
}


// XXX don't remember the semantics...
function getRelatedTags(){
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
