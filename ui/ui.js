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
// NOTE: this uses element.data to store the timer and cursor position...
function autoHideCursor(elem){
	elem = $(elem)
	var data = elem.data()
	elem
		.on('mousemove', function(evt){
			var cursor = elem.css('cursor')

			data._cursor_pos = data._cursor_pos == null || cursor != 'none' ?
						[evt.clientX, evt.clientY] 
					: data._cursor_pos

			// cursor visible -- extend visibility...
			if(cursor != 'none'){

				if(data._cursor_timeout != null){
					clearTimeout(data._cursor_timeout)
				}
				data._cursor_timeout = setTimeout(function(){
						if(Math.abs(evt.clientX - data._cursor_pos[0]) < CURSOR_SHOW_THRESHOLD 
								|| Math.abs(evt.clientY - data._cursor_pos[1]) < CURSOR_SHOW_THRESHOLD){

							elem.css('cursor', 'none')
						}
					}, CURSOR_HIDE_TIMEOUT)


			// cursor hidden -- if outside the threshold, show...
			} else if(Math.abs(evt.clientX - data._cursor_pos[0]) > CURSOR_SHOW_THRESHOLD 
				|| Math.abs(evt.clientY - data._cursor_pos[1]) > CURSOR_SHOW_THRESHOLD){

				elem.css('cursor', '')
			}
		})
		.click(function(evt){
			if(elem.css('cursor') == 'none'){
				//event.stopImmediatePropagation()
				//event.preventDefault()

				if(data._cursor_timeout != null){
					clearTimeout(data._cursor_timeout)
					data._cursor_timeout = null
				}

				elem.css('cursor', '')
				//return false
			}
		})
	return elem
}


/*
// XXX does not work...
// 		...does not show the cursor without moving it...
function showCursor(elem){
	elem = $(elem)
	var data = elem.data()
	if(data._cursor_timeout != null){
		clearTimeout(data._cursor_timeout)
	}
	elem.css('cursor', '')
}
*/


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



/**********************************************************************
* Modal dialogs...
*/

function getOverlay(root){
	root = $(root)
	var overlay = root.find('.overlay-block')
	if(overlay.length == 0){
		return $('<div class="overlay-block">'+
					'<div class="background"/>'+
					'<div class="content"/>'+
				'</div>').appendTo(root)
	}
	return overlay
}


function showInOverlay(root, data){
	root = $(root)

	var overlay = getOverlay(root)
	

	if(data != null){
		var container = $('<table width="100%" height="100%"><tr><td align="center" valign="center">'+
								'<div class="dialog"/>'+
							'</td></tr></table>')
		var dialog = container.find('.dialog')

		//overlay.find('.background')
		//	.click(function(){ hideOverlay(root) })

		dialog
			.append(data)
			.on('click', function(){ 
				event.stopPropagation() 
			})
		overlay.find('.content')
			.on('click', function(){ 
				overlay.trigger('close')
				hideOverlay(root) 
			})
			.on('close accept', function(){
				//hideOverlay(root) 
			})
			.append(container)
	}

	root.addClass('overlay')

	return overlay
}


function hideOverlay(root){
	root.removeClass('overlay')
	root.find('.overlay-block')
		.trigger('close')
		.remove()
}


var FIELD_TYPES = {
	text: {
		type: 'text',
		text: null,
		default: '',
		html: '<div class="field string">'+
				'<span class="text"></span>'+
				'<input type="text" class="value">'+
			'</div>',
		test: function(val){
			return typeof(val) == typeof('abc')
		},
		set: function(field, value){
			$(field).find('.value').attr('value', value) 
		},
		get: function(field){ 
			return $(field).find('.value').attr('value') 
		},
	},	
	bool: {
		type: 'bool',
		text: null,
		default: false,
		html: '<div class="field checkbox">'+
				'<input type="checkbox" class="value">'+
				'<span class="text"></span>'+
			'</div>',
		test: function(val){
			return val === true || val === false
		},
		set: function(field, value){
			if(value){
				$(field).find('.value').attr('checked', '') 
			} else {
				$(field).find('.value').removeAttr('checked') 
			}
		},
		get: function(field){ 
			return $(field).find('.value').attr('checked') == 'checked'
		},
	},

	// NOTE: this will not work without node-webkit...
	dir: {
		type: 'dir',
		text: null,
		default: false,
		html: '<div class="field checkbox">'+
				'<span class="text"></span>'+
				'<input type="file" class="value" nwdirectory />'+
			'</div>',
		// format: {dir: <default-path>}
		test: function(val){
			return typeof(val) == typeof({}) && 'dir' in val
		},
		set: function(field, value){
			field.find('.value').attr('nwworkingdir', value.dir)
		},
		get: function(field){ 
			var f = $(field).find('.value')[0].files
			if(f.length == 0){
				return ''
			}
			return f[0].path
		},
	},
	// NOTE: this will not work without node-webkit...
	ndir: {
		type: 'ndir',
		text: null,
		default: false,
		html: '<div class="field dir">'+
				'<span class="text"></span>'+
				'<input type="text" class="path"/>'+
				'<button class="browse">Browse</button>'+
			'</div>',
		// format: {dir: <default-path>}
		test: function(val){
			return typeof(val) == typeof({}) && 'ndir' in val
		},
		set: function(field, value){
			var that = this

			// NOTE: we are attaching the file browser to body to avoid 
			// 		click events on it closing the dialog...
			// 		...for some reason stopPropagation(...) does not do 
			// 		the job...
			var file = $('<input type="file" class="value" nwdirectory/>')
				.attr('nwworkingdir', value.ndir)
				.change(function(){
					var p = file[0].files
					if(p.length != 0){
						field.find('.path').val(p[0].path)
					}
					file.detach()
				})
				.hide()
			field.find('.path').val(value.ndir)

			field.find('.browse').click(function(){
				file
					// load user input path...
					.attr('nwworkingdir', field.find('.path').val())
					.appendTo($('body'))
					.click()
			})

		},
		get: function(field){ 
			return field.find('.path').val()
		},
	},
}

// Show a complex form dialog
//
// This will build a form and collect it's data on "accept" specified by
// the config object...
//
// config format:
//	{
//		// simple field...
//		<field-description>: <default-value>,
//
//		...
//	}	
//
// field's default value determines it's type:
// 	bool		- checkbox
// 	string		- textarea
//
// see FIELD_TYPES for supported field types.
//
// NOTE: if btn is set to false explicitly then no button will be 
// 		rendered in the form dialog.
//
// XXX add form testing...
// XXX add undefined field handling/reporting...
// XXX revise...
function formDialog(root, message, config, btn, cls){
	cls = cls == null ? '' : cls
	btn = btn == null ? 'OK' : btn
	root = root == null ? $('.viewer') : root

	var form = $('<div class="form"/>')
	var data = {}
	var res = $.Deferred()

	// handle message and btn...
	form.append($('<div class="text">'+message+'</div>'))

	// build the form...
	for(var t in config){
		var did_handling = false
		for(var f in FIELD_TYPES){
			if(FIELD_TYPES[f].test(config[t])){
				var field = FIELD_TYPES[f]
				var html = $(field.html)

				html.find('.text').text(t)
				field.set(html, config[t])

				// NOTE: this is here to isolate t and field.get values...
				// 		...is there a better way???
				var _ = (function(title, getter){
					html.on('resolve', function(evt, e){
						data[title] = getter(e)
					})
				})(t, field.get)

				form.append(html)

				did_handling = true
				break
			}
		}

		// handle unresolved fields...
		if(!did_handling){
			console.warn('formDialog: not all fields understood.')
			// XXX skipping field...
			// XXX
		}
	}

	// add button...
	if(btn !== false){
		var button = $('<button class="accept">'+btn+'</button>')
		form.append(button)
	}

	var overlay = showInOverlay(root, form)
		.addClass('dialog ' + cls)
		.on('accept', function(){
			form.find('.field').each(function(_, e){
				$(e).trigger('resolve', [$(e)])
			})

			// XXX test if all required stuff is filled...
			res.resolve(data)

			hideOverlay(root)
		})
		.on('close', function(){
			res.reject()

		})

	button.click(function(){
		overlay.trigger('accept')
	})

	setTimeout(function(){ 
		form.find('.field input').first()
			.focus()
			.select()
	}, 100)

	return res
}



/************************************************ Standard dialogs ***/

var _alert = alert
function alert(){
	var message = Array.apply(null, arguments).join(' ')
	//return formDialog(null, String(message), {}, 'OK', 'alert')
	return formDialog(null, String(message), {}, false, 'alert')
}


var _prompt = prompt
function prompt(message, dfl, btn){
	btn = btn == null ? 'OK' : btn
	var res = $.Deferred()
	formDialog(null, message, {'': ''+(dfl == null ? '' : dfl)}, btn, 'prompt')
		.done(function(data){ res.resolve(data['']) })
		.fail(function(){ res.reject() })
	return res
}


/*
function confirm(){
}
*/


// NOTE: this will not work without node-webkit...
function getDir(message, dfl, btn){
	btn = btn == null ? 'OK' : btn
	dfl = dfl == null ? '' : dfl
	var res = $.Deferred()

	formDialog(null, message, {'': {ndir: dfl}}, btn, 'getDir')
		.done(function(data){ res.resolve(data['']) })
		.fail(function(){ res.reject() })

	return res
}


// XXX do reporting...
function exportPreviews(dfl){
	dfl = dfl == null ? BASE_URL : dfl
	var res = $.Deferred()

	formDialog(null, 'Export previews', {
		'Image name pattern': '%f',
		'Fav directory name': 'fav',
		'Destination': {ndir: dfl},
	}, 'OK', 'exportPreviews')
		.done(function(data){
			exportTo(
				data['Destination'], 
				data['Image name pattern'], 
				data['Fav directory name'])

			res.resolve(data[''])
		})
		.fail(function(){ res.reject() })

	return res
}



/************************************************ Specific dialogs ***/

function showImageInfo(){
	var gid = getImageGID(getImage())
	var r = getRibbonIndex(getRibbon())
	var data = IMAGES[gid]
	var orientation = data.orientation
	orientation = orientation == null ? 0 : orientation
	var flipped = data.flipped
	flipped = flipped == null ? '' : ', flipped '+flipped+'ly'
	var order = DATA.order.indexOf(gid)
	var name = data.path.split('/').pop()

	alert('<div>'+
			'<h2>"'+ name +'"</h2>'+

			'<table>'+
				'<tr><td>GID: </td><td>'+ gid +'</td></tr>'+
				'<tr><td>Path: </td><td>"'+ data.path +'"</td></tr>'+
				'<tr><td>Orientation: </td><td>'+ orientation +'&deg;'+flipped+'</td></tr>'+
				'<tr><td>Order: </td><td>'+ order +'</td></tr>'+
				'<tr><td>Position (ribbon): </td><td>'+ (DATA.ribbons[r].indexOf(gid)+1) +
					'/'+ DATA.ribbons[r].length +'</td></tr>'+
				'<tr><td>Position (global): </td><td>'+ (order+1) +'/'+ DATA.order.length +'</td></tr>'+
			'</table>'+
		'</div>')
}



/**********************************************************************
* vim:set ts=4 sw=4 nowrap :										 */
