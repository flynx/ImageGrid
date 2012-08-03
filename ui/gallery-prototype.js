// XXX need a uniform way to address images (filename?)


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
		// XXX this is flaky and breaks some of my code...
		.swipe({
			swipeLeft: nextImage,
			swipeRight: prevImage,
			swipeUp: shiftImageUp,
			swipeDown: shiftImageDown,
		})
}



function setupControlElements(){
	// images...
	$(".image").click(setCurrentImage)

	// buttons...
	$('.next-image').click(nextImage)
	$('.prev-image').click(prevImage)
	$('.demote').click(shiftImageUp)
	$('.promote').click(shiftImageDown)
	$('.toggle-wide').click(toggleWideView)
	$('.toggle-single').click(toggleRibbonView)
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

// center other ribbons relative to current image...
// XXX only two ribbons are positioned at this point...
function alignRibbons(){
	// XXX might be goot to move this to a more generic location...
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



// this sets the zooming factor used in manual zooming...
var ZOOM_FACTOR = 2

// key configuration...
// XXX need to make this handle modifiers gracefully...
var keys = {
	toggleHelp: [72],
	toggleRibbonView: [70],
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
		: (fn(code, keys.zoomIn) >= 0) ? zoomContainerBy(ZOOM_FACTOR)
		: (fn(code, keys.zoomOut) >= 0) ? zoomContainerBy(1/ZOOM_FACTOR)
		// zoom presets...
		: (fn(code, keys.zoomOriginal) >= 0) ? setContainerZoom(1)
		: (fn(code, keys.fitOne) >= 0) ? fitImage()
		: (fn(code, keys.fitThree) >= 0) ? fitThreeImages()

		// moving view...
		: (fn(code, keys.moveViewUp) >= 0) ? moveViewUp()
		: (fn(code, keys.moveViewDown) >= 0) ? moveViewDown()
		: (fn(code, keys.moveViewLeft) >= 0) ? moveViewLeft()
		: (fn(code, keys.moveViewRight) >= 0) ? moveViewRight()

		: (fn(code, keys.toggleRibbonView) >= 0) ? toggleRibbonView()
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
			// animation...
			.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
				$('.current.image').click()
				return true
			});
}
function setViewerMode(mode){
	$('.viewer').not('.' + mode)
		.addClass(mode)
			// animation...
			.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
				$('.current.image').click()
				return true
			});
}



// ribbon/single view modes...
// XXX CSS broken...
function toggleRibbonView(){
	if($('.single-image-mode').length > 0){
		unsetViewerMode('single-image-mode')
	} else {
		setViewerMode('single-image-mode')
	}
}



// wide view mode toggle...
function toggleWideView(){
	if($('.wide-view-mode').length > 0){
		setContainerZoom(1)
		$('.viewer').removeClass('wide-view-mode')
	} else {
		setContainerZoom(0.1)
		$('.viewer').addClass('wide-view-mode')
	}
}




/********************************************************* Movement **/

var MOVE_DELTA = 50

// XXX for some odd reason these are not liner... something to do with origin?
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


// XXX for the above two functions to be stable we will need to jump up 
// 		to the next and down to the prev element...
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

// find an image object after which to position image ID...
// used for two main tasks:
// 	- positioning promoted/demoted images
// 	- centering ribbons
// returns:
// 	- null		- empty ribbon or no element greater id should be first
// 	- element
// XXX do we need to make ids numbers for this to work?
// XXX might be better to make this binary search in very large sets of data
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


// binery search for element just before the id...
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


// center a ribbon horizontally...
// if id exists in ribbon make it the center, else center between the 
// two images that id came from.
function centerRibbonHorizontally(id, ribbon){
	// XXX
}

// center the ribbon in the middle of the container vertically...
function centerRibbonVertically(ribbon){
	// XXX
}



/********************************************************** Actions **/
// basic actions...
// NOTE: below 'direction' is meant in the html sence, i.e. next/prev...

// create ribbon above/below helpers...
// XXX
function createRibbon(direction){
	if(direction == 'next'){
		var insert = 'insertAfter'
	} else if(direction == 'prev') {
		var insert = 'insertBefore'
	} else {
		return false
	}

	var res = $('<div class="new-ribbon"></div>')[insert]('.current.ribbon')
		// HACK: without this, the class change below will not animate...
		.show()
		.addClass('ribbon')
		.removeClass('new-ribbon')
	// XXX need to account for increased top when creating a ribbon above...
	// 		i.e. shift the content upward...
	/*
	if(direction == 'prev'){
		$('.field').css({
			top: $('.field').position().top - $('.current.ribbon').outerHeight()
		})
	}*/
	return res
}



// XXX sort elements correctly...
function mergeRibbons(direction){
	$('.current.ribbon')[direction]('.ribbon')
			.children()
				.detach()
				.insertAfter('.current.image')
	// animate...
	$('.current.ribbon')[direction]('.ribbon')
			.slideUp(function(){
				$(this).remove()
				$('.current.image').click()
			})
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
	// XXX this has to know aout animations...
	$('.current.image').click()
}



function shiftImageDown(){
	return shiftImage('next')
}
// XXX this has problems, when creating a new ribbon this does not settle 
//	   into a correct spot...
function shiftImageUp(){
	return shiftImage('prev')
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
