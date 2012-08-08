// XXX need a uniform way to address images (filename?)
/******************************************* Setup Data and Globals **/

// the list of style modes...
// these are swithched through in order by toggleBackgroundModes()
var BACKGROUND_MODES = [
	'dark',
	'black'
]


// this sets the zooming factor used in manual zooming...
var ZOOM_FACTOR = 2


// sets the amoun of move when a key is pressed...
var MOVE_DELTA = 50




/********************************************************** Helpers **/


// this will create a function that will add/remove a css_class to elem 
// calling the callbacks before and/or after.
// NOTE: of only one callback is given then it will be called after the 
// 		 class change...
// 		 a way around this is to pass an empty function as callback_b
function createCSSClassToggler(elem, css_class, callback_a, callback_b){
	// prepare the pre/post callbacks...
	if(callback_b == null){
		var callback_pre = null
		var callback_post = callback_a
	} else {
		var callback_pre = callback_a
		var callback_post = callback_b
	}
	// build the acual toggler function...
	return function(action){
		if(action == null){
			action = 'on'
			// get current state...
			if( $(elem).hasClass(css_class) ){
				action = 'off'
			}
		}
		if(callback_pre != null){
			callback_pre(action)
		}
		// play with the class...
		if(action == 'on'){
			$(elem).addClass(css_class)
		} else {
			$(elem).removeClass(css_class)
		}
		if(callback_post != null){
			callback_post(action)
		}
	}
}


// disable transitions on obj, call func then enable transitions back...
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


function setupEvents(){
	// resize...
	$(window).resize(function() {
		// XXX HACK
		$('.current.image').click()
	})
	// keyboard...
	$(document)
		.keydown(makeKeyboardHandler(keybindings, function(k){alert(k)}))
		//.keydown(handleKeys)
	// swipe...
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
	// XXX rename classes to "shift-image-up" and "shift-image-down"...
	$('.screen-button.demote').click(shiftImageUp)
	$('.screen-button.promote').click(shiftImageDown)

	$('.screen-button.zoom-in').click(function(){scaleContainerBy(ZOOM_FACTOR)})
	$('.screen-button.zoom-out').click(function(){scaleContainerBy(1/ZOOM_FACTOR)})

	$('.screen-button.toggle-wide').click(toggleWideView)
	$('.screen-button.toggle-single').click(toggleSingleImageMode)

	$('.screen-button.fit-three').click(fitThreeImages)

	$('.screen-button.show-controls').click(showControls)

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



// XXX we essentially need three things:
// 		- keycodes, including modifier keys
// 		- function
// 		- meta information...
/*
 * Basic key format:
 * 		<key-code> : <callback>,
 * 		<key-code> : {
 * 			default: [<callback>, <doc>],
 *			// a modifier can be any single modifier, like shift or a 
 *			// combination of modifers like 'ctrl+shift', given in order 
 *			// of priority.
 *			// supported modifiers are (in order of priority):
 *			//	- ctrl
 *			//	- alt
 *			//	- shift
 * 			<modifer>: [...]
 * 		},
 *		// alias...
 * 		<key-code-a> : <key-code-b>,
 */

function makeKeyboardHandler(keybindings, unhandled){
	if(unhandled == null){
		unhandled = function(){return false}
	}
	console.log(keybindings)
	return function(evt){
		var key = evt.keyCode
		// XXX ugly...
		var modifers = evt.ctrlKey ? 'ctrl' : ''
		modifers += evt.altKey ? (modifers != '' ? '+alt' : 'alt') : ''
		modifers += evt.shiftKey ? (modifers != '' ? '+shift' : 'shift') : ''

		var handler = keybindings[key]

		// alias...
		while (typeof(handler) == typeof(123)) {
			handler = keybindings[handler]
		}
		// no handler...
		if(handler == null){
			return unhandled(key)
		}
		// complex handler...
		if(typeof(handler) == typeof({})){
			var callback = handler[modifers]
			if(callback == null){
				callback = handler['default']
			}
			if(callback != null){
				callback()
				return false
			}
		} else {
			// callback...
			handler() 
			return false
		}
		return unhandled(key)
	}
}




/************************************************************ Modes **/

// ribbon/single view modes...
// global: stores the scale before we went into single image mode...
// XXX HACK
var ORIGINAL_FIELD_SCALE = 1


// remember the default backgrounds for modes...
// ...this effectively makes the modes independant...
// NOTE: null represent the default value...
// XXX HACK
var NORMAL_MODE_BG = null 
var SINGLE_IMAGE_MODE_BG = BACKGROUND_MODES[BACKGROUND_MODES.length-1]


var toggleSingleImageMode = createCSSClassToggler('.viewer', 'single-image-mode', 
		// pre...
		function(action){
			if(action == 'on'){
				NORMAL_MODE_BG = getBackgroundMode()
				ORIGINAL_FIELD_SCALE = getElementScale($('.field'))
			} else {
				SINGLE_IMAGE_MODE_BG = getBackgroundMode()
			}
		},
		// post...
		function(action){
			if(action == 'on'){
				fitImage()
				setBackgroundMode(SINGLE_IMAGE_MODE_BG)
			} else {
				setContainerScale(ORIGINAL_FIELD_SCALE)
				setBackgroundMode(NORMAL_MODE_BG)
			}
			clickAfterTransitionsDone()
})


// wide view mode toggle...
var toggleWideView = createCSSClassToggler('.viewer', 'wide-view-mode', function(action){
	if(action == 'on'){
		ORIGINAL_FIELD_SCALE = getElementScale($('.field'))
		setContainerScale(0.1)
	} else {
		setContainerScale(ORIGINAL_FIELD_SCALE)
	}
}, function(){})



function getBackgroundMode(){
	var mode = null
	// find a mode to set...
	for(var i = 0; i < BACKGROUND_MODES.length; i++){
		// we found our mode...
		if( $('.' + BACKGROUND_MODES[i]).length > 0 ){
			return BACKGROUND_MODES[i]
		}
	}
	return mode
}



// set the background mode
// NOTE: passing null will set the default.
function setBackgroundMode(mode){
	var cur = BACKGROUND_MODES.indexOf(mode)

	// invalid mode...
	if( cur == -1 && mode != null ){
		return null
	}
	// set the mode...
	if(mode != null){
		$('.viewer').addClass(mode)
	}
	// remove all others...
	for(var i = 0; i < BACKGROUND_MODES.length; i++){
		if( i == cur ){
			continue
		}
		mode = BACKGROUND_MODES[i]
		$('.' + mode).removeClass(mode)
	}
}



// this will toggle through background theems: none -> dark -> black
function toggleBackgroundModes(){
	var mode = getBackgroundMode()
	// default -> first
	if(mode == null){
		setBackgroundMode(BACKGROUND_MODES[0])
	// last -> default...
	} else if(mode == BACKGROUND_MODES[BACKGROUND_MODES.length-1]){
		setBackgroundMode()
	// next...
	} else {
		setBackgroundMode(BACKGROUND_MODES[BACKGROUND_MODES.indexOf(mode)+1])
	}
}



var toggleSingleImageModeTransitions = createCSSClassToggler('.viewer', 'no-single-image-transitions')


var toggleControls = createCSSClassToggler('.viewer', 'hidden-controls')
var showControls = function(){toggleControls('on')}
var hideControls = function(){toggleControls('off')}


var toggleTransitions = createCSSClassToggler('.viewer', 'transitions-enabled')
var enableTransitions = function(){toggleTransitions('on')}
var disableTransitions = function(){toggleTransitions('off')}



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



function flipRibbons(){
	var ribbons = $('.ribbon')
	// index of current ribbon, needed to adjust placement of everything...
	var cur = ribbon.index($('.current.ribbon'))

	// XXX would have been nice if we could do detach reverse attach or just reverse...

	
}




/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
