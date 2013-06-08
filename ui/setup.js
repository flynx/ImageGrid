/**********************************************************************
* 
*
**********************************************************************/

// A threshold after which the image block ratio will be changed to 
// 'fit-viewer' in single image mode...
//
// NOTE: if null this feature will be disabled.
var PROPORTIONS_RATIO_THRESHOLD = 1.5



/**********************************************************************
* Setup
*/

function setupIndicators(){
	showGlobalIndicator(
			'marks-visible', 
			'Marks visible (F2)')
		.css('cursor', 'hand')
		.click(function(){ toggleMarkesView() })
	showGlobalIndicator(
			'marked-only-visible', 
			'Marked only images visible (F3)')
		.css('cursor', 'hand')
		.click(function(){ toggleMarkedOnlyView() })

	showContextIndicator(
			'current-image-marked', 
			'Image is marked (Ins)')
		.css('cursor', 'hand')
		.click(function(){ toggleImageMark() })
}


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

			// update proportions...
			if(window.PROPORTIONS_RATIO_THRESHOLD != null 
					&& toggleSingleImageMode('?') == 'on'){
				var viewer = $('.viewer')
				//var w = getVisibleImageSize('width')
				var h = getVisibleImageSize('height')
				//var W = viewer.innerWidth()
				var H = viewer.innerHeight()

				//var m = Math.min(W/w, H/h)
				var m = H/h

				if(m < PROPORTIONS_RATIO_THRESHOLD){
					toggleImageProportions('fit-viewer')
				} else {
					toggleImageProportions('none')
				}
			}

			// update previews...
			updateImages()
		})


		.on('focusingImage', function(evt, image){
			image = $(image)
			DATA.current = getImageGID(image)
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
				if(IMAGES_UPDATED.indexOf(gid) == -1){
					IMAGES_UPDATED.push(gid)
				}
			})
		})
		.on('flippingVertical flippingHorizontal', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 
				var flip = getImageFlipState(img)

				IMAGES[gid].flipped = flip
				if(IMAGES_UPDATED.indexOf(gid) == -1){
					IMAGES_UPDATED.push(gid)
				}
			})
		})
		.on('resetToOriginalImage', function(evt, image){
			$(image).each(function(i, e){
				var img = $(this)
				var gid = getImageGID(img) 

				IMAGES[gid].flipped = null
				IMAGES[gid].orientation = 0

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

		// info...
		.on([
				'focusingImage',
				'rotatingLeft',
				'rotateingRight',
				'flippingVertical',
				'flippingHorizontal',
				'togglingMark'
			].join(' '), 
			function(evt, image){
				updateGlobalImageInfo($(image))
			})
		.on([
				'removeingAllMarks',
				'removeingRibbonMarks',
				'markingAll',
				'markingRibbon',
				'invertingMarks'
			].join(' '), 
			function(){
				updateGlobalImageInfo()
			})

		// mark indicator...
		// XXX make this generic and handle any of the available marks...
		.on('focusingImage togglingMark', function(evt, image){
			image = image.length == 0 ? getImage() : image
			var indicator = $('.context-mode-indicators .current-image-marked')
			if(image.hasClass('marked')){
				indicator.addClass('shown')
			} else {
				indicator.removeClass('shown')
			}
		})

		.on('baseURLChanged', function(evt, url){
			saveLocalStorageBaseURL()
			saveLocalStorageBaseURLHistory()
		})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
