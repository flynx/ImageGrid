/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true
//
var IMAGE_CACHE = []



/*********************************************************************/

// TODO add global cache...
// 		- manage cache by number and preview size...
// 		- keep in biggish...


// NOTE: this will always overwrite the previous cache set for a ribbon...
// NOTE: it appears that sorting images by priority before loading them
// 		to cache has little or no effect on the order they are 
// 		loaded/rendered...
// NOTE: this is not meant to be a real cache, rather a que for the OS and
// 		backend/webkit on what's next...
//
// XXX this appears to actually make things slow and laggy...
function preCacheRibbonImages(ribbon){
	var deferred = $.Deferred()
	setTimeout(function(){
		var i = getRibbonIndex(ribbon)
		var size = getVisibleImageSize('max')
		var screen_size = getScreenWidthInImages(getVisibleImageSize())
		// XXX needs tuning...
		var cache_frame_size = (screen_size * LOAD_SCREENS)
		var images = ribbon.find('.image')
		var first = getImageGID(images.first())
		var last = getImageGID(images.last())

		var gids = getGIDsAfter(-cache_frame_size, first, i)
					.concat(getGIDsAfter(cache_frame_size, last, i))

		var cache = []
		IMAGE_CACHE[i] = cache
		$.each(gids, function(i, e){
			var img = new Image()
			img.src = getBestPreview(e, size).url
			cache.push(img)
		})

		deferred.resolve(cache)
	}, 0)
	return deferred
}


function preCacheAllRibbons(){
	$('.ribbon').each(function(){
		preCacheRibbonImages($(this))
	})
	return IMAGE_CACHE
}



/*********************************************************************/

function setupImageCache(viewer){
	console.log('Image cache: setup...')

	return viewer
		.on('reloadedRibbon updatedRibbon', function(evt, ribbon){

			window.DEBUG 
				&& console.log('>>> (ribbon:', getRibbonIndex(ribbon), ') Updating cache...')

			preCacheRibbonImages(ribbon)
		})
}
SETUP_BINDINGS.push(setupImageCache)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
