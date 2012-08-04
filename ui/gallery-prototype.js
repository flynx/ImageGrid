// XXX need a uniform way to address images (filename?)
/******************************************* Setup Data and Globals **/

// key configuration...
// XXX need to make this handle modifiers gracefully...
var keys = {
	toggleHelp: [72],
	toggleSingleImageMode: [70, 13],	// ???, Enter
	toggleSingleImageModeTransitions: [84],	// t
	toggleSingleImageModeWhiteBG: [87],	// w
	close: [27, 88, 67],

	// zooming...
	zoomIn: [187],
	zoomOut: [189],
	// zoom presets...
	fitOne: [49],
	fitThree: [51],
	// XXX is this relivant?
	zoomOriginal: [48],

	first: [36],
	last: [35],
	previous: [37, 80, 188, 8],
	next: [39, 78, 190, 32],
	// these work with ctrl and shift modifiers...
	down: [40],
	up: [38],
	// these work with ctrl modifier...
	promote: [45],
	demote: [46],

	// XXX should these be s-up, s-down, ... ??
	moveViewUp: [75],				//	k
	moveViewDown: [74],				//	j
	moveViewLeft: [72],				//	h
	moveViewRight: [76],			//	l

	// keys to be ignored...
	ignore: [16, 17, 18],

	helpShowOnUnknownKey: true
}


// this sets the zooming factor used in manual zooming...
var ZOOM_FACTOR = 2


// sets the amoun of move when a key is pressed...
var MOVE_DELTA = 50



/************************************************** Setup Functions **/
// XXX is this a correct place for these?

function setDefaultInitialState(){
	if($('.current.ribbon').length == 0){
		$('.ribbon').first().addClass('current')
	}
	if($('.current.image').length == 0){
		$('.current.ribbon').children('.image').first().addClass('current')
	}
}



function setupKeyboard(){
	$(document)
		.keydown(handleKeys)
}



function setupGestures(){
	$('.viewer')
		.swipe({
			swipeLeft: nextImage,
			swipeRight: prevImage,
			swipeUp: shiftImageUp,
			swipeDown: shiftImageDown
		})
}



function setupControlElements(){
	// images...
	$(".image").click(setCurrentImage)

	// buttons...
	$('.screen-button.next-image').click(nextImage)
	$('.screen-button.prev-image').click(prevImage)
	$('.screen-button.demote').click(shiftImageUp)
	$('.screen-button.promote').click(shiftImageDown)

	$('.screen-button.zoom-in').click(function(){scaleContainerBy(ZOOM_FACTOR)})
	$('.screen-button.zoom-out').click(function(){scaleContainerBy(1/ZOOM_FACTOR)})

	$('.screen-button.toggle-wide').click(toggleWideView)
	$('.screen-button.toggle-single').click(toggleSingleImageMode)

	$('.screen-button.fit-three').click(fitThreeImages)

	$('.screen-button.settings').click(function(){alert('not implemented yet...')})
}



function loadImages(json){
	var images = json.images
	var ribbon = $('.ribbon').last()

	$('.image').remove()

	for(var i = 0; i < images.length; i++){
		$('<div class="image"></div>')
			.css({ 'background-image': 'url('+images[i]+')' })
			// set a unique id for each image...
			.attr({'id': i})
			.click(setCurrentImage)
			.appendTo(ribbon)
	}
	ribbon.children().first().click()
}




/*************************************************** Event Handlers **/

function setCurrentImage(){
	// set classes...
	$('.current').removeClass('current')
	$(this)
		.addClass('current')
		.parents('.ribbon')
			.addClass('current')
	// position the field and ribbons...
	centerSquare()
	alignRibbons()
}



function clickAfterTransitionsDone(img){
	if(img == null){
		img = $('.current.image')
	}
	$('.viewer')
		.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
			img.click()
			return true
		})
}



// center other ribbons relative to current image...
// NOTE: only two ribbons are positioned at this point...
function alignRibbons(){
	// XXX might be good to move this to a more generic location...
	var id = $('.current.image').attr('id')
	var directions = ['prev', 'next']
	for(var i in directions){
		var ribbon = $('.current.ribbon')[directions[i]]('.ribbon')
		if(ribbon.length == 1){
			var img = getImageBefore(id, ribbon)
			if(img != null){
				alignRibbon(img, 'before')
			} else {
				// there are no images before...
				alignRibbon(ribbon.children('.image').first(), 'after')
			}
		}
	}
}



// XXX revise...
function handleKeys(event){
	var code = event.keyCode, fn = $.inArray;
	var _ = (fn(code, keys.close) >= 0) ? function(){}()
		: (fn(code, keys.first) >= 0) ? firstImage()
		: (fn(code, keys.next) >= 0) ? nextImage()
		: (fn(code, keys.previous) >= 0) ? prevImage()
		: (fn(code, keys.last) >= 0) ? lastImage()
		: (fn(code, keys.promote) >= 0) ? function(){
			if(event.ctrlKey){
				createRibbon('next')
			}
			shiftImageDown()
		}()
		: (fn(code, keys.demote) >= 0) ? function(){
			if(event.ctrlKey){
				createRibbon('prev')
			}
			shiftImageUp()
		}()
		: (fn(code, keys.down) >= 0) ? function(){
			if(event.shiftKey){
				if(event.ctrlKey){
					createRibbon('next')
				}
				shiftImageDown()
			} else {
				focusBelowRibbon()
			}
		}()
		: (fn(code, keys.up) >= 0) ? function(){
			if(event.shiftKey){
				if(event.ctrlKey){
					createRibbon('prev')
				}
				shiftImageUp()
			} else {
				focusAboveRibbon()
			}
		}()
		// zooming...
		: (fn(code, keys.zoomIn) >= 0) ? scaleContainerBy(ZOOM_FACTOR)
		: (fn(code, keys.zoomOut) >= 0) ? scaleContainerBy(1/ZOOM_FACTOR)
		// zoom presets...
		: (fn(code, keys.zoomOriginal) >= 0) ? setContainerScale(1)
		: (fn(code, keys.fitOne) >= 0) ? fitImage()
		: (fn(code, keys.fitThree) >= 0) ? fitThreeImages()

		// moving view...
		: (fn(code, keys.moveViewUp) >= 0) ? moveViewUp()
		: (fn(code, keys.moveViewDown) >= 0) ? moveViewDown()
		: (fn(code, keys.moveViewLeft) >= 0) ? moveViewLeft()
		: (fn(code, keys.moveViewRight) >= 0) ? moveViewRight()

		: (fn(code, keys.toggleSingleImageMode) >= 0) ? toggleSingleImageMode()
		: (fn(code, keys.toggleSingleImageModeTransitions) >= 0) ? toggleSingleImageModeTransitions()
		: (fn(code, keys.toggleSingleImageModeWhiteBG) >= 0) ? toggleSingleImageModeWhiteBG()
		: (fn(code, keys.ignore) >= 0) ? false
		// XXX
		: (keys.helpShowOnUnknownKey) ? function(){alert(code)}()
		: false;
	return false;
}




/************************************************************ Modes **/

// mode switchers...
function unsetViewerMode(mode){
	$('.' + mode)
		.removeClass(mode)
	clickAfterTransitionsDone()
}



function setViewerMode(mode){
	$('.viewer').not('.' + mode)
		.addClass(mode)
	clickAfterTransitionsDone()
}



// ribbon/single view modes...
// global: stores the scale before we went into single image mode...
// XXX HACK
var ORIGINAL_FIELD_SCALE = 1

function toggleSingleImageMode(){
	if($('.single-image-mode').length > 0){
		unsetViewerMode('single-image-mode')
		setContainerScale(ORIGINAL_FIELD_SCALE)
	} else {
		setViewerMode('single-image-mode')
		ORIGINAL_FIELD_SCALE = getElementScale($('.field'))
		fitImage()
	}
}



// wide view mode toggle...
function toggleWideView(){
	if($('.wide-view-mode').length > 0){
		setContainerScale(ORIGINAL_FIELD_SCALE)
		$('.viewer').removeClass('wide-view-mode')
	} else {
		ORIGINAL_FIELD_SCALE = getElementScale($('.field'))
		setContainerScale(0.1)
		$('.viewer').addClass('wide-view-mode')
	}
}




/********************************************************* Movement **/

// XXX for some odd reason these are not liner... something to do with origin?
// XXX virtually identical, see of can be merged...
function moveViewUp(){
	var t = parseInt($('.field').css('top'))
	$('.field').css({'top': t-(MOVE_DELTA)})
}
function moveViewDown(){
	var t = parseInt($('.field').css('top'))
	$('.field').css({'top': t+(MOVE_DELTA)})
}
function moveViewLeft(){
	var l = parseInt($('.field').css('left'))
	$('.field').css({'left': l-(MOVE_DELTA)})
}
function moveViewRight(){
	var l = parseInt($('.field').css('left'))
	$('.field').css({'left': l+(MOVE_DELTA)})
}




/******************************************************* Navigation **/

// basic navigation...
function firstImage(){
	$('.current.ribbon').children('.image').first().click()
}
function prevImage(){
	$('.current.image').prev('.image').click()
}
function nextImage(){
	$('.current.image').next('.image').click()
}
function lastImage(){
	$('.current.ribbon').children('.image').last().click()
}

// XXX add skip N images back and forth handlers...
// XXX


function focusRibbon(direction){
	var id = $('.current.image').attr('id')
	var prev = getImageBefore(id, $('.current.ribbon')[direction]('.ribbon'))
	if(prev){
		var next = prev.next()
		// NOTE: direction is accounted for to make the up/down shifts 
		// 		 symmetrical in the general case...
		if(next.length == 0 || direction == 'next'){
			prev.click()
		} else {
			next.click()
		}
	} else {
		$('.current.ribbon')[direction]('.ribbon').children('.image').first().click()
	}
}
function focusAboveRibbon(){
	focusRibbon('prev')
}
function focusBelowRibbon(){
	focusRibbon('next')
}




/********************************************************** Helpers **/

function doWithoutTransitions(obj, func){
	obj
		.addClass('unanimated')
		.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
			func()
			$('.viewer')
				.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
					obj.removeClass('unanimated')
				})
		})
}

// find an image object after which to position image ID...
// used for two main tasks:
// 	- positioning promoted/demoted images
// 	- centering ribbons
// returns:
// 	- null		- empty ribbon or no element greater id should be first
// 	- element
// XXX do we need to make ids numbers for this to work?
function getImageBefore_lin(id, ribbon){
	// walk the ribbon till we find two images one with an ID less and 
	// another greater that id...
	id = parseInt(id)
	var images = ribbon.children('.image')
	var prev = null
	for(var i=0; i < images.length; i++){
		if(parseInt($(images[i]).attr('id')) > id){
			return prev
		}
		prev = $(images[i])
	}
	return prev
}


// generic binery search for element just before the id...
// NOTE: if id is in lst, this will return the element just before it.
// NOTE: lst must be sorted.
function binarySearch(id, lst, get){
	if(get == null){
		get = function(o){return o}
	}
	
	// empty list...
	if(lst.length == 0){
		return null
	}
	
	// current section length
	var l = Math.round((lst.length-1)/2)
	// current position...
	var i = l

	while(true){
		var i_id = get(lst[i])
		// beginning of the array...
		if(i == 0){
			if(id > i_id){
				return i
			}
			return null
		}
		// we got a hit...
		if(i_id == id){
			return i-1
		}
		// we are at the end...
		if(i == lst.length-1 && id > i_id){
			return i
		}
		var ii_id = get(lst[i+1])
		// test if id is between i and i+1...
		if( i_id < id && id < ii_id ){
			return i
		}
		// prepare for next iteration...
		// NOTE: we saturate the values so we will never get out of bounds.
		l = Math.round(l/2)
		if(id < i_id){
			// lower half...
			i = Math.max(0, i-l)
		} else {
			// upper half...
			i = Math.min(i+l, lst.length-1)
		}
	}
}

// wrapper around binarySearch.
// this is here to make binarySearch simpler to test and debug...
function getImageBefore_bin(id, ribbon){
	var images = ribbon.children('.image') 
	var i = binarySearch(
					parseInt(id), 
					images, 
					function(o){return parseInt($(o).attr('id'))})
	if(i == null){
		return null
	}
	return $(images[i])
}

// set the default search...
var getImageBefore = getImageBefore_bin



/********************************************************** Actions **/
// basic actions...
// NOTE: below 'direction' argument is meant in the html sence, 
//       i.e. next/prev...

// create ribbon above/below helpers...
// XXX adding a ribbon above the current is still jumpy, need to devise 
// 		a cleaner way to do this...
function createRibbon(direction){
	if(direction == 'next'){
		var insert = 'insertAfter'
	} else if(direction == 'prev') {
		var insert = 'insertBefore'
	} else {
		return false
	}

	// adding a new ribbon above the current effectively pushes the 
	// whole view down, so we need to compensate for this.
	// NOTE: the problem is partly caused by clicks fiering BEFORE the 
	// 		 animation is done...
	$('.field').addClass('unanimated')	
	
	if(direction == 'prev'){
		$('.field').css({
			'margin-top': parseInt($('.field').css('margin-top')) - $('.ribbon').outerHeight()
		})
	}
	// the actual insert...
	var res = $('<div class="ribbon"></div>')[insert]('.current.ribbon')
	
	// restore the animated state...
	$('.field').removeClass('unanimated')	

	return res
}



// merge current and direction ribbon...
// NOTE: this will take all the elements from direction ribbon and add
//       them to current
// XXX this uses jquery animation...
// XXX one way to optimise this is to add the lesser ribbon to the 
//     greater disregarding their actual order...
function mergeRibbons(direction){
	var current_ribbon = $('.current.ribbon')
	var images = $('.current.ribbon')[direction]('.ribbon').children()
	for(var i=0; i < images.length; i++){
		var image = $(images[i])
		// get previous element after which we need to put the current...
		var prev_elem = getImageBefore(image.attr('id'), current_ribbon)
		// check if we need to be before the first element...
		if(prev_elem == null){
			image
				.detach()
				.insertBefore(current_ribbon.children('.image').first())
		} else {
			image
				.detach()
				.insertAfter(prev_elem)
		}
	}

	// animate...
	$('.current.ribbon')[direction]('.ribbon')
			.slideUp(function(){
				$(this).remove()
				$('.current.image').click()
			})
}



function toggleSingleImageModeTransitions(){
	if( $('.no-single-image-transitions').length > 0 ){

		$('.no-single-image-transitions').removeClass('no-single-image-transitions')
	} else {
		$('.viewer').addClass('no-single-image-transitions')
	}
}



function toggleSingleImageModeWhiteBG(){
	if( $('.single-image-white-bg').length > 0 ){

		$('.single-image-white-bg').removeClass('single-image-white-bg')
	} else {
		$('.viewer').addClass('single-image-white-bg')
	}
}




/*************************************************** Editor Actions **/

// now the actual modifiers...
function shiftImage(direction){
	if($('.current.ribbon')[direction]('.ribbon').length == 0){
		createRibbon(direction)
	}

	// get previous element after which we need to put the current...
	var prev_elem = getImageBefore(
					$('.current.image').attr('id'), 
					$('.current.ribbon')[direction]('.ribbon'))

	// last image in ribbon, merge...
	if($('.current.ribbon').children('.image').length == 1){
		mergeRibbons(direction)
	} else {
		img = $('.current.image')
		if(img.next('.image').length == 0){
			prevImage()
		} else {
			nextImage()
		}
		// do the actual move...
		if(prev_elem){
			// insert element after current...
			img
				.detach()
				.insertAfter(prev_elem)
		} else {
			// empty ribbon or fisrt element...
			img
				.detach()
				.prependTo($('.current.ribbon')[direction]('.ribbon'))
		}

	}
	$('.current.image').click()
}



function shiftImageDown(){
	return shiftImage('next')
}
function shiftImageUp(){
	return shiftImage('prev')
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
