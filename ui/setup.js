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
			'single-ribbon-mode', 
			'Single ribbon mode (F3)')
		.css('cursor', 'hand')
		.click(function(){ toggleSingleRibbonMode() })
	showGlobalIndicator(
			'marks-visible', 
			'Marks visible (F2)')
		.css('cursor', 'hand')
		.click(function(){ toggleMarkesView() })
	showGlobalIndicator(
			'marked-only-visible', 
			'Marked only images visible (shift-F2)')
		.css('cursor', 'hand')
		.click(function(){ toggleMarkedOnlyView() })

	showContextIndicator(
			'current-image-marked', 
			'Image is marked (Ins)')
		.css('cursor', 'hand')
		.click(function(){ toggleImageMark() })
}


function updateContextIndicators(image){
	image = image == null ? getImage() : $(image)
	
	// marked...
	var indicator = $('.context-mode-indicators .current-image-marked')
	if(image.hasClass('marked')){
		indicator.addClass('shown')
	} else {
		indicator.removeClass('shown')
	}
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
		.click(function(){
			if($('.ribbon').length == 0){
				loadDirectoryDialog()
			}
		})

		.on([
				'focusingImage',
				'fittingImages'
			].join(' '), 
			function(){
				updateCurrentMarker()
			})

		// NOTE: we do not need to worry about explicit centering the ribbon 
		//		here, just ball-park-load the correct batch...
		// XXX this does not get called on marking...
		.on('preCenteringRibbon', function(evt, ribbon, image){
			var r = getRibbonIndex(ribbon)

			// skip all but the curent ribbon in single image view...
			if(toggleSingleImageMode('?') == 'on' && r != getRibbonIndex()){
				return 
			}

			// skip the whole thing if the ribbon is not visible -- outside
			// of viewer are...
			var viewer = $('.viewer')
			var H = viewer.height()
			var h = getImage().height()
			var t = getRelativeVisualPosition(viewer, ribbon).top 
			// XXX also check for visibility...
			if( t+h <= 0 || t >= H ){
				return
			}

			// prepare for loading...
			var gid = getImageGID(image)
			var gr = DATA.ribbons[r]
			var img_before = getImageBefore(image, ribbon)
			var gid_before = getGIDBefore(gid, r)

			var screen_size = getScreenWidthInImages()
			screen_size = screen_size < 1 ? 1 : screen_size
			var load_frame_size = Math.round(screen_size * LOAD_SCREENS)

			// current image IS loaded...
			if(gid_before == getImageGID(img_before)){
				var head = img_before.prevAll('.image').length
				var tail = img_before.nextAll('.image').length
				var l = ribbon.find('.image').length
				var index = gr.indexOf(gid)
				var at_start = index < threshold
				var at_end = (gr.length-1 - index) < threshold

				var roll_frame_size = Math.ceil(load_frame_size / 3)
				var threshold = Math.floor(load_frame_size / 4) 
				threshold = threshold < 1 ? 1 : threshold

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
			console.log('!!!! fittingImages')
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
				loadImagesAround(Math.round(screen_size * LOAD_SCREENS), gid, r, null, true)
			})

			centerView(null, 'css')

			// update settings...
			if(toggleSingleImageMode('?') == 'on'){
				SETTINGS['single-image-mode-screen-images'] = n
			} else {
				SETTINGS['ribbon-mode-screen-images'] = n
			}

			// update proportions...
			// XXX for some magical reason this is stable for un-rotated 
			// 		images and does mad things for rotate 90/270 images...
			//		...the only thing that is 	
			if(window.PROPORTIONS_RATIO_THRESHOLD != null 
					&& toggleSingleImageMode('?') == 'on'){

				var h = getVisibleImageSize('height')
				var w = getVisibleImageSize('width')
				var H = $('.viewer').innerHeight()
				var W = $('.viewer').innerWidth()

				var m = Math.min(W/w, H/h)

				if(m < PROPORTIONS_RATIO_THRESHOLD){
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
				 MARKED.indexOf(gid) == -1 && MARKED.push(gid)

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
		.on('focusingImage',
			function(){
				showRibbonIndicator()
			})
		.on([
				'focusedNextRibbon',
				'focusedPrevRibbon'
			].join(' '),
			function(){
				if(toggleSingleImageMode('?') == 'on'){
					flashRibbonIndicator()
				}
			})
		.on([
				'focusingImage',
				'togglingMark'
			].join(' '),
			function(evt, image){
				image = $(image)
				updateGlobalImageInfo(image)
				updateContextIndicators(image)
			})
		.on([
				'rotatingLeft',
				'rotateingRight',
				'flippingVertical',
				'flippingHorizontal'
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
				updateContextIndicators()
			})


		.on('baseURLChanged', function(evt, url){
			saveLocalStorageBaseURL()
			saveLocalStorageBaseURLHistory()
		})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
