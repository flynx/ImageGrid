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

var CONTEXT_INDICATOR_UPDATERS = []


// this can be:
// 	- 'floating'
// 	- 'panel'
var PROGRESS_WIDGET_CONTAINER = 'floating'
// can be between 0 and 3000
var PROGRESS_HIDE_TIMEOUT = 1500



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


function setupIndicators(){
	showGlobalIndicator(
			'cropped-view', 
			'Cropped view (shift-F2/F3/C/F)')
		.css('cursor', 'hand')
		.click(function(){ uncropData() })
}


function makeContextIndicatorUpdater(image_class){
	var _updater = function(image){
		var indicator = $('.context-mode-indicators .current-image-'+image_class)
		if(image.hasClass(image_class)){
			indicator.addClass('shown')
		} else {
			indicator.removeClass('shown')
		}
	}
	CONTEXT_INDICATOR_UPDATERS.push(_updater)
	return _updater
}


function updateContextIndicators(image){
	image = image == null ? getImage() : $(image)

	CONTEXT_INDICATOR_UPDATERS.map(function(update){
		update(image)
	})	
}


function showCurrentMarker(){
	return $('<div/>')
		.addClass('current-marker')
		.css({
			opacity: '0',
			top: '0px',
			left: '0px',
		})
		.appendTo($('.ribbon-set'))
		.animate({
			'opacity': 1
		}, 500)
		.mouseover(function(){
			$('.current.image')
		})
}

function updateCurrentMarker(){
	var scale = getElementScale($('.ribbon-set'))
	var marker = $('.current-marker')
	var cur = $('.current.image')
	var w = cur.outerWidth(true)
	var h = cur.outerHeight(true)
	marker = marker.length == 0 ? showCurrentMarker() : marker 
	var d = getRelativeVisualPosition(marker, cur)
	return marker.css({
		top: parseFloat(marker.css('top')) + d.top/scale,
		left: parseFloat(marker.css('left')) + d.left/scale,
		// keep size same as the image...
		width: w,
		height: h,
	})
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


function showRibbonIndicator(){
	var cls = '.ribbon-indicator'
	var indicator = $(cls)

	if(indicator.length == 0){
		indicator = $('<div>')
			.addClass(cls.replace('.', ''))
			.appendTo($('.viewer'))
	}

	var r = getRibbonIndex()

	// get the base ribbon...
	var base = getBaseRibbonIndex()

	var r =  r == base ? r+'*' : r
	return indicator.text(r)
}


function flashRibbonIndicator(){
	var indicator = showRibbonIndicator()
	var cls = '.flashing-ribbon-indicator'

	var flashing_indicator = $(cls)

	if(flashing_indicator.length == 0){
		flashing_indicator = indicator
			.clone()
			.addClass(cls.replace('.', ''))
			.appendTo($('.viewer'))
	}

	return flashing_indicator
//		.stop()
//		.show()
//		.delay(200)
//		.fadeOut(500)
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

	elem 
		.appendTo(target)

	return elem
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
	//return showStatusQ.apply(null, message)
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
* Progress bar...
*/

// Make or get progress bar container...
//
// mode can be:
// 	- null			- default
// 	- 'floating'
// 	- 'panel'
function getProgressContainer(mode, parent){
	parent = parent == null ? $('.viewer') : parent
	mode = mode == null ? PROGRESS_WIDGET_CONTAINER : mode

	if(mode == 'floating'){
		// widget container...
		var container = parent.find('.progress-container')
		if(container.length == 0){
			container = $('<div class="progress-container"/>')
				.appendTo(parent)
		}
	} else {
		var container = getPanel('Progress')
		if(container.length == 0){
			container = makeSubPanel('Progress')
				.addClass('.progress-container')
		}

		container = container.find('.content')
	}

	return container
}


// Make or get progress bar by name...
//
// Setting close to false will disable the close button...
//
// Events:
// 	- progressUpdate (done, total)
// 		Triggered by user to update progress bar state.
//
// 		takes two arguments:
// 			done	- the number of done tasks
// 			total	- the total number of tasks
//
// 		Usage:
// 			widget.trigger('progressUpdate', [done, total])
// 			
// 		Shorthand:
// 			updateProgressBar(name, done[, total])
//
// 	- progressClose
// 		Triggered by the close button.
//		By default triggers the progressDone event.
//
// 		Shorthand:
// 			closeProgressBar(name[, msg])
//
// 	- progressDone
// 		Triggered by user or progressClose handler.
// 		Set the progress bar to done state and hide after hide_timeout.
//
// 	- progressReset
// 		Triggered by user or progressBar(..) if the progress bar already 
// 		exists and is hidden (display: none).
// 		Reset the progress bar to it's initial (indeterminite) state 
// 		and show it.
//
// 		Shorthand:
// 			resetProgressBar(name)
//
function progressBar(name, container, close, hide_timeout, auto_remove){
	container = container == null 
		? getProgressContainer() 
		: container
	close = close === undefined 
		? function(){ 
			$(this).trigger('progressDone') } 
		: close
	hide_timeout = hide_timeout == null ? PROGRESS_HIDE_TIMEOUT 
		: hide_timeout < 0 ? 0
		: hide_timeout > 3000 ? 3000
		: hide_timeout
	auto_remove = auto_remove == null ? true : auto_remove

	var widget = getProgressBar(name)

	// a progress bar already exists, reset it and return...
	// XXX should we re-bind the event handlers here???
	if(widget.length > 0 && widget.css('display') == 'none'){
		return widget.trigger('progressReset')
	}

	// fields we'll need to update...
	var state = $('<span class="progress-details"/>')
	var bar = $('<progress/>')

	// the progress bar widget...
	var widget = $('<div class="progress-bar" name="'+name+'">'+name+'</div>')
		// progress state...
		.append(state)
	// the close button...
	if(close !== false){
		widget
			.append($('<span class="close">&times;</span>')
				.click(function(){
					$(this).trigger('progressClose')
				}))
	}
	widget
		.append(bar)
		.appendTo(container)
		.on('progressUpdate', function(evt, done, total){
			done = done == null ? bar.attr('value') : done
			total = total == null ? bar.attr('max') : total
			bar.attr({
				value: done,
				max: total
			})
			state.text(' ('+done+' of '+total+')')
		})
		.on('progressDone', function(evt, done, msg){
			done = done == null ? bar.attr('value') : done
			msg = msg == null ? 'done' : msg
			bar.attr('value', done)
			state.text(' ('+msg+')')
			widget.find('.close').hide()

			setTimeout(function(){
				widget.hide()

				// XXX this is not a good way to go... 
				// 		need a clean way to reset...
				if(auto_remove){
					widget.remove()
				}
			}, hide_timeout)
		})
		.on('progressReset', function(){
			widget
				.css('display', '')
				.find('.close')
					.css('display', '')
			state.text('')
			bar.attr({
				value: '',
				max: '',
			})
		})

	if(close === false){
		widget.on('progressClose', function(evt, msg){
			if(msg != null){
				widget.trigger('progressDone', [null, msg]) 
			} else {
				widget.trigger('progressDone') 
			}
		})
	} else if(close != null){
		widget.on('progressClose', close)
	}

	bar = $(bar[0])
	state = $(state[0])
	widget = $(widget[0])

	return widget
}


function getProgressBar(name){
	return $('.progress-bar[name="'+name+'"]')
}



/******************************************* Event trigger helpers ***/

function triggerProgressBarEvent(name, evt, args){
	var widget = typeof(name) == typeof('str') 
		? getProgressBar(name) 
		: name
	return widget.trigger(evt, args)
}


function resetProgressBar(name){
	return triggerProgressBarEvent(name, 'progressReset')
}
function updateProgressBar(name, done, total){
	return triggerProgressBarEvent(name, 'progressUpdate', [done, total])
}
function closeProgressBar(name, msg){
	if(msg != null){
		return triggerProgressBarEvent(name, 'progressClose', [msg])
	}	
	return triggerProgressBarEvent(name, 'progressClose')
}



/**********************************************************************
* Dialogs...
*/

function detailedAlert(text, description, button){
	return formDialog(null, '', {'': {
		html: $('<details/>')
			.append($('<summary/>')
				.html(text))
			.append($('<span/>')
				.html(description))
	}}, button == null ? false : button, 'detailed-alert')
}


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



/***************************************** Domain-specific dialogs ***/

// XXX do reporting...
// XXX would be nice to save settings...
// 		...might be good to use datalist...
function exportPreviewsDialog(state, dfl){
	dfl = dfl == null ? BASE_URL : dfl

	// XXX make this more generic...
	// tell the user what state are we exporting...
	if(state == null){
		var imgs = 0
		// NOTE: we are not using order or image count as these sets may
		// 		be larger that the current crop...
		DATA.ribbons.map(function(e){
			imgs += e.length
		})
		state = toggleSingleImageMode('?') == 'on' ? 'current image' : state
		state = state == null && isViewCropped() ? 
			'cropped view: '+
				imgs+' images in '+
				DATA.ribbons.length+' ribbons' 
			: state
		state = state == null ?
			'all: '+
				imgs+' images in '+
				DATA.ribbons.length+' ribbons' 
			: state
	}

	var res = $.Deferred()

	updateStatus('Export...').show()

	// NOTE: we are not defining the object in-place here because some 
	// 		keys become unreadable with JS syntax preventing us from 
	// 		splitting the key into several lines...
	var cfg = {}
	var img_pattern = 'Image name pattern | '+
		'%f - full filename (same as %n%e)\n'+
		'%n - filename\n'+
		'%e - extension (with leading dot)\n'+
		'%(abc)m - if marked insert "abc"\n'+
		'%(abc)b - if bookmarked insert "abc"\n'+
		'%gid - long gid\n'+
		'%g - short gid\n'
	// multiple images...
	if(state != 'current image'){
		cfg[img_pattern +
				'%I - global order\n'+
				'%i - current selection order'] = '%f'
		cfg['Level directory name'] = 'fav'
	// single image...
	} else {
		cfg[img_pattern +
				'\n'+
				'NOTE: %i and %I are not supported for single\n'+
				'image exporting.'] = '%f'
	}
	cfg['Size | '+
			'The selected size is aproximate, the actual\n'+
			'preview will be copied from cache.\n'+
			'\n'+
			'NOTE: if not all previews are yet generated,\n'+
			'this will save the available previews, not all\n'+
			'of which may be of the right size, if this\n'+
			'happens wait till all the previews are done\n'+
			'and export again.'] = {
		select: ['Original image'].concat(PREVIEW_SIZES.slice().sort()),
		default: 1
	}
	cfg['Destination | '+
			'Relative paths are supported.\n\n'+
			'NOTE: All paths are relative to the curent\n'+
			'directory.'] = {ndir: dfl}

	var keys = Object.keys(cfg)

	formDialog(null, 'Export: <b>'+ state +'</b>.', cfg, 'OK', 'exportPreviewsDialog')
		.done(function(data){
			// get the form data...
			var name = data[keys[0]]
			if(state != 'current image'){
				var size = data[keys[2]]
				var path = normalizePath(data[keys[3]]) 
				var dir = data[keys[1]]

			} else {
				var size = data[keys[1]]
				var path = normalizePath(data[keys[2]])
			}
			size = size == 'Original image' ? Math.max.apply(null, PREVIEW_SIZES)*2 : parseInt(size)-5

			// do the actual exporting...
			// full state...
			if(state != 'current image'){
				exportImagesTo(path, name, dir, size)

			// single image...
			} else {
				exportImageTo(getImageGID(), path, name, size)
			}

			// XXX do real reporting...
			showStatusQ('Copying data...')
			res.resolve(data[''])
		})
		.fail(function(){ 
			showStatusQ('Export: canceled.')
			res.reject() 
		})

	return res
}


function loadDirectoryDialog(dfl){
	dfl = dfl == null ? BASE_URL : dfl

	updateStatus('Open...').show()

	formDialog(null, 'Path to open | To see list of previously loaded urls press ctrl-H.', {
		'': {ndir: dfl},
		'Precess previews': true,
	}, 'OK', 'loadDirectoryDialog')
		.done(function(data){
			var path = normalizePath(data[''].trim())
			var process_previews = data['Precess previews']

			// reset the modes...
			toggleSingleImageMode('off')
			toggleSingleRibbonMode('off')
			toggleMarkedOnlyView('off')

			// do the loading...
			statusNotify(loadDir(path, !process_previews))
				/*
				.done(function(){
					if(process_previews){ 
						showStatusQ('Previews: processing started...')
						// generate/attach previews...
						makeImagesPreviewsQ(DATA.order) 
							.done(function(){ 
								showStatusQ('Previews: processing done.')
							})
					}
				})
				*/
				.done(function(){
					// XXX is this the right place for this???
					pushURLHistory(BASE_URL)
				})
		})
		.fail(function(){
			showStatusQ('Open: canceled.')
		})
}


// XXX get EXIF, IPTC...
function showImageInfo(){
	var gid = getImageGID(getImage())
	var r = getRibbonIndex(getRibbon())
	var data = IMAGES[gid]
	var orientation = data.orientation
	orientation = orientation == null ? 0 : orientation
	var flipped = data.flipped
	flipped = flipped == null ? '' : ', flipped '+flipped+'ly'
	var order = DATA.order.indexOf(gid)
	var name = getImageFileName(gid)
	var date = new Date(data.ctime * 1000)
	var comment = data.comment
	comment = comment == null ? '' : comment
	comment = comment.replace(/\n/g, '<br>')
	var tags = data.tags
	tags = tags == null ? '' : tags.join(', ')

	return formDialog(null,
			('<div>'+
				'<h2>"'+ name +'"</h2>'+

				'<table>'+
					// basic info...
					// XXX BUG: something here breaks when self-generated data is 
					// 		currently open -- .length of undefined...
					'<tr><td colspan="2"><hr></td></tr>'+
					'<tr><td>GID: </td><td>'+ gid +'</td></tr>'+
					'<tr><td>Date: </td><td>'+ date +'</td></tr>'+
					'<tr><td>Path: </td><td>"'+ unescape(data.path) +'"</td></tr>'+
					'<tr><td>Orientation: </td><td>'+ orientation +'&deg;'+flipped+'</td></tr>'+
					'<tr><td>Order: </td><td>'+ order +'</td></tr>'+
					'<tr><td>Position (ribbon): </td><td>'+ (DATA.ribbons[r].indexOf(gid)+1) +
						'/'+ DATA.ribbons[r].length +'</td></tr>'+
					'<tr><td>Position (global): </td><td>'+ (order+1) +'/'+ DATA.order.length +'</td></tr>'+
					'<tr><td>Sorted: </td><td>'+ 
						//Math.round(((DATA.order.length-tagSelectAND('unsorted', DATA.order).length)/DATA.order.length)*100+'') +
						//Math.round(((DATA.order.length-tagSelectAND('unsorted').length)/DATA.order.length)*100+'') +
						Math.round(((DATA.order.length-TAGS['unsorted'].length)/DATA.order.length)*100+'') +
					'%</td></tr>'+

					// editable fields...
					'<tr><td colspan="2"><hr></td></tr>'+
					// XXX this expanding to a too big size will mess up the screen...
					// 		add per editable and global dialog max-height and overflow
					'<tr><td>Comment: </td><td class="comment" contenteditable>'+ comment +'</td></tr>'+
					'<tr><td>Tags: </td><td class="tags" contenteditable>'+ tags +'</td></tr>'+
				'</table>'+
				'<br>'+
			'</div>'),
			// NOTE: without a save button, there will be no way to accept the 
			// 		form on a touch-only device...
			{}, 'OK', 'showImageInfoDialog')

		// save the form data...
		.done(function(_, form){
			// comment...
			var ncomment = form.find('.comment').html()
			if(ncomment != comment){
				ncomment = ncomment.replace(/<br>/ig, '\n')
				if(ncomment.trim() == ''){
					delete data.comment
				} else {
					data.comment = ncomment
				}
				imageUpdated(gid)
			}

			// tags...
			var ntags = form.find('.tags').text().trim()
			if(ntags != tags){
				ntags = ntags.split(/\s*,\s*/)

				updateTags(ntags, gid)
			}
		})
}



/*********************************************************************/

// XXX need a propper:
// 		- update mechanics...
// 		- save mechanics
function makeCommentPanel(panel){
	return makeSubPanel(
			'Info: Comment', 
			$('Comment: <div class="comment" contenteditable/>'),
			panel, 
			true, 
			true)
}



/*********************************************************************/

function setupUI(viewer){
	console.log('UI: setup...')

	setupIndicators()

	return viewer
		.click(function(){
			if($('.ribbon').length == 0){
				loadDirectoryDialog()
			}
		})
		.on([
				'focusingImage',
				'fittingImages',
				//'updatingImageProportions',
				'horizontalShiftedImage',
			].join(' '), 
			function(){
				updateCurrentMarker()
			})

}
SETUP_BINDINGS.push(setupUI)



/**********************************************************************
* vim:set ts=4 sw=4 nowrap :										 */
