/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var CURSOR_SHOW_THRESHOLD = 20
var CURSOR_HIDE_TIMEOUT = 1000

var STATUS_QUEUE = []
var STATUS_QUEUE_TIME = 200




/*********************************************************************/

// XXX revise...
// NOTE: to catch the click event correctly while the cursor is hidden
//		this must be the first to get the event...
function autoHideCursor(elem){
	elem = $(elem)
	elem
		.on('mousemove', function(evt){
			var cursor = elem.css('cursor')

			_cursor_pos = window._cursor_pos == null || cursor != 'none' ?
						[evt.clientX, evt.clientY] 
					: _cursor_pos

			// cursor visible -- extend visibility...
			if(cursor != 'none'){

				if(window._cursor_timeout != null){
					clearTimeout(_cursor_timeout)
				}
				_cursor_timeout = setTimeout(function(){
						if(Math.abs(evt.clientX - _cursor_pos[0]) < CURSOR_SHOW_THRESHOLD 
								|| Math.abs(evt.clientY - _cursor_pos[1]) < CURSOR_SHOW_THRESHOLD){

							elem.css('cursor', 'none')
						}
					}, CURSOR_HIDE_TIMEOUT)


			// cursor hidden -- if outside the threshold, show...
			} else if(Math.abs(evt.clientX - _cursor_pos[0]) > CURSOR_SHOW_THRESHOLD 
				|| Math.abs(evt.clientY - _cursor_pos[1]) > CURSOR_SHOW_THRESHOLD){

				elem.css('cursor', '')
			}
		})
		.click(function(evt){
			if(elem.css('cursor') == 'none'){
				//event.stopImmediatePropagation()
				//event.preventDefault()

				if(window._cursor_timeout != null){
					clearTimeout(_cursor_timeout)
					_cursor_timeout = null
				}

				elem.css('cursor', '')
				//return false
			}
		})
	return elem
}


function flashIndicator(direction){
	var cls = {
		// shift up/down...
		prev: '.up-indicator',
		next: '.down-indicator',
		// hit start/end/top/bottom of view...
		start: '.start-indicator',
		end: '.end-indicator',
		top: '.top-indicator',
		bottom: '.bottom-indicator',
	}[direction]

	var indicator = $(cls)

	if(indicator.length == 0){
		indicator = $('<div>')
			.addClass(cls.replace('.', ''))
			.appendTo($('.viewer'))
	}

	return indicator
		// NOTE: this needs to be visible in all cases and key press 
		// 		rhythms... 
		.show()
		.delay(100)
		.fadeOut(300)
}


// Update an info element
//
// align can be:
// 	- top
// 	- bottom
//
// If target is an existing info container (class: overlay-info) then 
// just fill that.
function updateInfo(elem, data, target){
	var viewer = $('.viewer')
	target = target == null ? viewer : $(target)
	elem = elem == null ? $('.overlay-info') : $(elem)

	if(elem.length == 0){
		elem = $('<div/>')
	}

	elem
		.addClass('overlay-info')
		.html('')
		.off()

	if(typeof(data) == typeof('abc')){
		elem.html(data)
	} else {
		elem.append(data)
	}

	return elem 
		.appendTo(target)
}


function showInfo(elem, data, target){
	elem = elem == null ? $('.overlay-info') : elem
	elem = data == null ? elem : updateInfo(elem, data, traget)
	return elem.fadeIn()
}


function hideInfo(elem){
	elem = elem == null ? $('.overlay-info') : elem
	return elem.fadeOut()
}


// Update status message
//
// NOTE: this will update message content and return it as-is, things 
// 		like showing the message are to be done manually...
// 		see: showStatus(...) and showErrorStatus(...) for a higher level
// 		API...
// NOTE: in addition to showing user status, this will also log the 
// 		satus to browser console...
// NOTE: the message will be logged to console via either console.log(...)
// 		or console.error(...), if the message starts with "Error".
// NOTE: if message is null, then just return the status element...
//
// XXX add abbility to append and clear status...
function updateStatus(message){

	var elem = $('.global-status')
	if(elem.length == 0){
		elem = $('<div class="global-status"/>')
	}
	if(message == null){
		return elem
	}

	if(typeof(message) == typeof('s') && /^error.*/i.test(message)){
		console.error.apply(console, arguments)
	} else {
		console.log.apply(console, arguments)
	}

	if(arguments.length > 1){
		message = Array.apply(Array, arguments).join(' ')
	}

	return updateInfo(elem, message)
}


// Same as updateInfo(...) but will aslo show and animate-close the message
//
// XXX the next call will not reset the animation of the previous, rather 
// 		it will pause it and rezume...
// 		...not sure if this is correct.
function showStatus(message){
	return updateStatus.apply(null, arguments)
		//.stop()
		.stop(true, false)
		//.finish()
		.show()
		.delay(500)
		.fadeOut(800)
}


// Same as showStatus(...) but queue the message so as to display it for
// a meaningful amount of time...
//
//	- This will print the first message right away.
//	- Each consecutive message if STATUS_QUEUE_TIME has not passed yet 
//		will get queued.
//	- Once the STATUS_QUEUE_TIME has passed the next message is reported 
// 		and so on until the queue is empty.
//
// NOTE: for very a fast and large sequence of messages the reporting 
// 		may (will) take longer (significantly) than the actual "job"...
// NOTE: this will delay the logging also...
function showStatusQ(message){
	if(STATUS_QUEUE.length == 0){

		// end marker...
		STATUS_QUEUE.push(0)

		showStatus.apply(null, arguments)

		function _printer(){
			// if queue is empty we have nothing to do...
			if(STATUS_QUEUE.length == 1){
				STATUS_QUEUE.pop()
				return
			}
			// if not empty show a status and repeat...
			showStatus.apply(null, STATUS_QUEUE.pop())
			setTimeout(_printer, STATUS_QUEUE_TIME)
		}

		setTimeout(_printer, STATUS_QUEUE_TIME)

	// queue not empty...
	} else {
		STATUS_QUEUE.splice(1, 0, Array.apply(Array, arguments))
	}
}


// Same as showStatus(...) but will always add 'Error: ' to the start 
// of the message
//
// NOTE: this will show the message but will not hide it.
function showErrorStatus(message){
	message = Array.apply(Array, arguments)
	message.splice(0, 0, 'Error:')
	return updateStatus.apply(null, message)
		.one('click', function(){ $(this).fadeOut() })
		//.stop()
		.stop(true, false)
		//.finish()
		.show()
}


// shorthand methods...
function hideStatus(){
	// yes, this indeed looks funny -- to hide a status you need to show
	// it without any arguments... ;)
	return showStatus()
}
function getStatus(){
	return updateStatus()
}


// XXX move to ui.js?
function makeIndicator(text){
	return $('<span class="indicator expanding-text">'+
				'<span class="hidden">'+ text +'</span>'+
				'<span class="shown">'+ text[0] +'</span>'+
			'</span>')
}

function showGlobalIndicator(cls, text){
	var c = $('.global-mode-indicators')
	if(c.length == 0){
		c = $('<div>')
			.addClass('global-mode-indicators')
			.append('<span class="mode-tip">Global status</span>')
			.appendTo($('.viewer'))
	}
	return makeIndicator(text)
			.addClass(cls)
			.appendTo(c)
}
function showContextIndicator(cls, text){
	var c = $('.context-mode-indicators')
	if(c.length == 0){
		c = $('<div>')
			.addClass('context-mode-indicators')
			.append('<span class="mode-tip">Context status</span>')
			.appendTo($('.viewer'))
	}
	return makeIndicator(text)
			.addClass(cls)
			.appendTo(c)
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
