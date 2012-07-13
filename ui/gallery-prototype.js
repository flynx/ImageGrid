// XXX need a uniform way to address images (filename?)

// XXX move this into the actual html...
$(document).ready(setup);





/************************************************************ Setup **/

function setup(){
	// XXX load state...
	// initial state (default)...
	setDefaultInitialState()

	// setup event handlers...
	setupKeyboard()
	setupGestures()
	setupControlElements()

	// load images...
	// XXX not allowed...
	//$.getJSON('images.js', loadImages})
	// XXX STUB
	loadImages(image_list)

	// set the default position and init...
	$('.current-image').click()
}



function setDefaultInitialState(){
	if($('.current-ribbon').length == 0){
		$('.ribbon').first().addClass('current-ribbon')
	}
	if($('.current-image').length == 0){
		$('.current-ribbon').children('.image').first().addClass('current-image')
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
		/* XXX jquery.mobile handlers... (with this I'm getting way too much bling)
		.bind('swipeleft', function(e){
			nextImage()
			e.preventDefault()
			return false
		})
		.bind('swiperight', function(e){
			prevImage()
			e.preventDefault()
			return false
		})
		*/
}



function setupControlElements(){
	// images...
	$(".image").click(handleImageClick)

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
			.click(handleImageClick)
			.appendTo(ribbon)
	}
	ribbon.children().first().click()
}




/*************************************************** Event Handlers **/

function handleImageClick(e) {
	var cur = $(this)

	// switch classes...
	cur.parents().siblings().children(".image").removeClass("current-image")
	cur.siblings(".image").removeClass("current-image")

	cur.siblings().children(".image").removeClass("current-image")
	cur.parents().siblings(".ribbon").removeClass("current-ribbon")

	cur.addClass("current-image")
	cur.parents(".ribbon").addClass("current-ribbon")


	var container = cur.parents('.container')
	var field = cur.parents(".field")

	var image_offset = cur.offset()
	var field_offset = field.offset()

	// center the current image...
	field.css({
		left: field_offset.left - image_offset.left + (container.innerWidth() - cur.innerWidth())/2, 
		top: field_offset.top - image_offset.top + (container.innerHeight() - cur.innerHeight())/2 
	})


	// XXX do I need this???
	e.preventDefault();
}



// key configuration...
// XXX need to make this handle modifiers gracefully...
var keys = {
	toggleHelpKeys: [72],
	toggleRibbonView: [70],
	closeKeys: [27, 88, 67],

	firstKeys: [36],
	lastKeys: [35],
	previousKeys: [37, 80, 188, 8],
	nextKeys: [39, 78, 190, 32],
	// these work with ctrl and shift modifiers...
	downKeys: [40],
	upKeys: [38],
	// these work with ctrl modifier...
	promoteKeys: [45],
	demoteKeys: [46],

	ignoreKeys: [16, 17, 18],

	helpShowOnUnknownKey: true
}

// XXX revise...
function handleKeys(event){
	var code = event.keyCode, fn = $.inArray;
	var _ = (fn(code, keys.closeKeys) >= 0) ? function(){}()
		: (fn(code, keys.firstKeys) >= 0) ? firstImage()
		: (fn(code, keys.nextKeys) >= 0) ? nextImage()
		: (fn(code, keys.previousKeys) >= 0) ? prevImage()
		: (fn(code, keys.lastKeys) >= 0) ? lastImage()
		: (fn(code, keys.promoteKeys) >= 0) ? function(){
			if(event.ctrlKey){
				createRibbon('next')
			}
			shiftImageDown()
		}()
		: (fn(code, keys.demoteKeys) >= 0) ? function(){
			if(event.ctrlKey){
				createRibbon('prev')
			}
			shiftImageUp()
		}()
		: (fn(code, keys.downKeys) >= 0) ? function(){
			if(event.shiftKey){
				if(event.ctrlKey){
					createRibbon('next')
				}
				shiftImageDown()
			} else {
				focusBelowRibbon()
			}
		}()
		: (fn(code, keys.upKeys) >= 0) ? function(){
			if(event.shiftKey){
				if(event.ctrlKey){
					createRibbon('prev')
				}
				shiftImageUp()
			} else {
				focusAboveRibbon()
			}
		}()
		: (fn(code, keys.toggleRibbonView) >= 0) ? toggleRibbonView()
		: (fn(code, keys.ignoreKeys) >= 0) ? false
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
				$('.current-image').click()
				return true
			});
}
function setViewerMode(mode){
	$('.viewer').not('.' + mode)
		.addClass(mode)
			// animation...
			.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
				$('.current-image').click()
				return true
			});
}



// ribbon/single view modes...
function toggleRibbonView(){
	if($('.single-image-mode').length > 0){
		unsetViewerMode('single-image-mode')
	} else {
		setViewerMode('single-image-mode')
	}
}



// wide view mode toggle...
// XXX replace this with adequate zooming...
// XXX need to reposition the whole thing correctly...
function toggleWideView(){
	if($('.wide-view-mode').length > 0){
		unsetViewerMode('wide-view-mode')
	} else {
		unsetViewerMode('single-image-mode')
		setViewerMode('wide-view-mode')
	}
}




/******************************************************* Navigation **/

// basic navigation...
function firstImage(){
	$('.current-ribbon').children('.image').first().click()
}
function prevImage(){
	$('.current-image').prev('.image').click()
}
function nextImage(){
	$('.current-image').next('.image').click()
}
function lastImage(){
	$('.current-ribbon').children('.image').last().click()
}

// XXX for the above two functions to be stable we will need to jump up 
// 		to the next and down to the prev element...
function focusRibbon(direction){
	var id = $('.current-image').attr('id')
	var prev = getImageBefore(id, $('.current-ribbon')[direction]('.ribbon'))
	if(prev){
		var next = prev.next()
		if(next.length == 0){
			prev.click()
		} else {
			next.click()
		}
	} else {
		$('.current-ribbon')[direction]('.ribbon').children('.image').first().click()
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
// 	- positioning pormoted/demoted images
// 	- centering ribbons
// returns:
// 	- null		- empty ribbon or no element greater id should be first
// 	- element
// XXX do we need to make ids numbers for this to work?
// XXX might be better to make this a binary search for very large sets of data
function getImageBefore(id, ribbon){
	// walk the ribbon till we find two images one with an ID less and 
	// another greater that id...
	id = parseInt(id)
	var images = ribbon.children('.image')
	var prev
	for(var i=0; i < images.length; i++){
		if(parseInt($(images[i]).attr('id')) > id){
			return prev
		}
		prev = $(images[i])
	}
	return prev
}



/********************************************************** Actions **/
// basic actions...
// NOTE: below 'direction' is meant in the html sence, i.e. next/prev...

// create ribbon above/below helpers...
function createRibbon(direction){
	if(direction == 'next'){
		var insert = 'insertAfter'
	} else if(direction == 'prev') {
		var insert = 'insertBefore'
	} else {
		return false
	}

	var res = $('<div class="new-ribbon"></div>')[insert]('.current-ribbon')
		// HACK: without this, the class change below will not animate...
		.show()
		.addClass('ribbon')
		.removeClass('new-ribbon')
	// XXX need to account for increased top when creating a ribbon above...
	// 		i.e. shift the content upward...
	/*
	if(direction == 'prev'){
		$('.field').css({
			top: $('.field').position().top - $('.current-ribbon').outerHeight()
		})
	}*/
	return res
}



// XXX sort elements correctly...
function mergeRibbons(direction){
	$('.current-ribbon')[direction]('.ribbon')
			.children()
				.detach()
				.insertAfter('.current-image')
	// animate...
	$('.current-ribbon')[direction]('.ribbon')
			.slideUp(function(){
				$(this).remove()
				$('.current-image').click()
			})
}



/*************************************************** Editor Actions **/

// now the actual modifiers...
function shiftImage(direction){
	if($('.current-ribbon')[direction]('.ribbon').length == 0){
		createRibbon(direction)
	}

	// get previous element after which we need to put the current...
	var prev_elem = getImageBefore(
					$('.current-image').attr('id'), 
					$('.current-ribbon')[direction]('.ribbon'))

	// last image in ribbon, merge...
	if($('.current-ribbon').children('.image').length == 1){
		mergeRibbons(direction)
	} else {
		img = $('.current-image')
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
				.prependTo($('.current-ribbon')[direction]('.ribbon'))
		}

	}
	// XXX this has to know aout animations...
	$('.current-image').click()
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
