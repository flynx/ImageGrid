/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/**********************************************************************
* Modal dialogs...
*/

/********************************************************* Helpers ***/

// Set element text and tooltip
//
// NOTE: when text is a list, we will only use the first and the last 
// 		elements...
// NOTE: if tip_elem is not given then both the text and tip will be set
// 		on text_elem
//
// XXX add support for quoted '|'...
function setTextWithTooltip(text, text_elem, tip_elem){
	text_elem = $(text_elem)
	tip_elem = tip_elem == null ? text_elem : tip_elem

	if(typeof(text) != typeof('str')){
		tip = text
	} else {
		var tip = text.split(/\s*\|\s*/)
	}

	// set elemnt text...
	text_elem
		.html(tip[0])

	// do the tooltip...
	tip = tip.slice(1)
	tip = tip[tip.length-1]
	if(tip != null && tip.trim().length > 0){
		$('<span class="tooltip-icon tooltip-right"> *</span>')
			.attr('tooltip', tip)
			.appendTo(tip_elem)
	}

	return text_elem
}


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
			.on('click', function(evt){ 
				evt.stopPropagation() 
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

function isOverlayVisible(root){
	return getOverlay(root).css('display') != 'none'
}


/**********************************************************************
* Field definitions...
*/

var FIELD_TYPES = {
	// a simple hr...
	//
	// format:
	// 		'---'
	// 		Three or more '-'s
	hr: {
		type: 'hr',
		text: null,
		default: false,
		html: '<hr>',
		test: function(val){
			return /\-\-\-+/.test(val)
		},
	},
	// a simple br...
	//
	// format:
	// 		'   '
	// 		Three or more spaces
	br: {
		type: 'br',
		text: null,
		default: false,
		html: '<br>',
		test: function(val){
			return /\s\s\s+/.test(val)
		},
	},
	// format:
	// 	{
	// 		html: <html-block>
	// 	}
	html: {
		type: 'html',
		text: null,
		default: false,
		html: '<div class="html-block"/>',
		test: function(val){
			return val.html != null
		},
		set: function(field, value){
			if(typeof(value.html) == typeof('str')){
				field.html(value.html)
			} else {
				field.append(value.html)
			}
		},
	},

	// format: 
	// 		string
	// XXX add datalist option...
	// XXX make this textarea compatible...
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

	// format: 
	// 		true | false
	bool: {
		type: 'bool',
		text: null,
		default: false,
		html: '<div class="field checkbox">'+
				'<label><input type="checkbox" class="value">'+
				'<span class="text"></span></label>'+
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
	// format: 
	// 		{ dir: <default-path> }
	dir: {
		type: 'dir',
		text: null,
		default: false,
		html: '<div class="field checkbox">'+
				'<span class="text"></span>'+
				'<input type="file" class="value" nwdirectory />'+
			'</div>',
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
	// format: 
	// 		{ dir: <default-path> }
	// XXX add datalist option...
	ndir: {
		type: 'ndir',
		text: null,
		default: false,
		html: '<div class="field dir">'+
				'<span class="text"></span>'+
				'<input type="text" class="path"/>'+
				'<button class="browse">Browse</button>'+
			'</div>',
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
					// focus+select the path field...
					// NOTE: this is here to enable fast select-open 
					// 		keyboard cycle (tab, enter, <select path>, 
					// 		enter, enter)...
					field.find('.path')
						.focus()
						.select()
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

	// format: 
	// 		['a', 'b', 'c', ...]
	//
	// an item can be of the folowing format:
	// 		<text> ['|' 'default' | 'disabled' ] [ '|' <tool-tip> ]
	//
	// NOTE: only one 'default' item should be present.
	// NOTE: if no defaults are set, then the first item is checked.
	choice: {
		type: 'choice',
		text: null,
		default: false,
		html: '<div class="field choice">'+
				'<span class="text"></span>'+
				'<div class="item"><label>'+
					'<input type="radio" class="value"/>'+
					'<span class="item-text"></span>'+
				'</label></div>'+
			'</div>',
		test: function(val){
			return typeof(val) == typeof([]) && val.constructor.name == 'Array'
		},
		set: function(field, value){
			var t = field.find('.text').html()
			t = t == '' ? Math.random()+'' : t
			var item = field.find('.item').last()
			for(var i=0; i < value.length; i++){
				// get options...
				var opts = value[i]
					.split(/\|/g)
					.map(function(e){ return e.trim() })

				var val = item.find('.value')
				val.val(opts[0])

				// set checked state...
				if(opts.slice(1).indexOf('default') >= 0){
					val.prop('checked', true)
					opts.splice(opts.indexOf('default'), 1)
				} else {
					val.prop('checked', false)
				}

				// set disabled state...
				if(opts.slice(1).indexOf('disabled') >= 0){
					val.prop('disabled', true)
					opts.splice(opts.indexOf('disabled'), 1)
					item.addClass('disabled')
				} else {
					val.prop('disabled', false)
					item.removeClass('disabled')
				}

				setTextWithTooltip(opts, item.find('.item-text'))

				item.appendTo(field)

				item = item.clone()
			}
			var values = field.find('.value')
				.attr('name', t)
			// set the default...
			if(values.filter(':checked:not([disabled])').length == 0){
				values.filter(':not([disabled])').first()
					.prop('checked', true)
			}
		},
		get: function(field){ 
			return $(field).find('.value:checked').val()
		},
	},

	// format: 
	// 	{ 
	// 		select: ['a', 'b', 'c', ...] 
	// 		// default option (optional)...
	// 		default: <number> | <text>
	// 	}
	select: {
		type: 'select',
		text: null,
		default: false,
		html: '<div class="field choice">'+
				'<span class="text"></span>'+
				'<select>'+
					'<option class="option"></option>'+
				'</select>'+
			'</div>',
		test: function(val){
			return 'select' in val
		},
		set: function(field, value){
			var t = field.find('.text').text()
			var item = field.find('.option').last()
			var select = field.find('select')
			for(var i=0; i < value.select.length; i++){
				item
					.html(value.select[i])
					.val(value.select[i])
				item.appendTo(select)

				item = item.clone()
			}
			if(value.default != null){
				if(typeof(value.default) == typeof(123)){
					field.find('.option')
						.eq(value.default)
							.attr('selected', '')
				} else {
					field.find('.option[value="'+ value.default +'"]')
						.attr('selected', '')
				}
			}
		},
		get: function(field){ 
			return $(field).find('.option:selected').val()
		},
	},

	// NOTE: a button can have state...
	// format: 
	// 	{ 
	// 		// click event handler...
	// 		button: <function>, 
	// 		// optional, button text (default 'OK')...
	// 		text: <button-label>,
	// 		// optional, initial state setup...
	// 		default: <function>,
	// 	}
	button: {
		type: 'button',
		text: null,
		default: false,
		html: '<div class="field button">'+
				'<span class="text"></span>'+
				'<button class="button"></button>'+
			'</div>',
		test: function(val){
			return 'button' in val
		},
		set: function(field, value){
			var btn = $(field).find('button')
				.click(value.button)
				.html(value.text == null ? 'OK' : value.text)
			if('default' in value){
				value.default(btn)
			}
		},
		get: function(field){ 
			return $(field).attr('state')
		},
	},

}



/**********************************************************************
* Constructors...
*/

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
// <field-description> and split in two with a "|" the section before will
// show as the field text and the text after as the tooltip.
// Example:
// 		"field text | field tooltip..."
//
// field's default value determines it's type:
// 	bool		- checkbox
// 	string		- textarea
//
// see FIELD_TYPES for supported field types.
//
// NOTE: if btn is set to false explicitly then no button will be 
// 		rendered in the form dialog.
// NOTE: to include a literal "|" in <field-description> just escape it
// 		like this: "\|"
//
// XXX add form testing...
// XXX add undefined field handling/reporting...
function formDialog(root, message, config, btn, cls){
	cls = cls == null ? '' : cls
	btn = btn == null ? 'OK' : btn
	root = root == null ? $('.viewer') : root

	var form = $('<div class="form"/>')
	var data = {}
	var res = $.Deferred()

	// handle message and btn...
	if(message.trim().length > 0){
		setTextWithTooltip(message, $('<div class="text"/>'))
			.appendTo(form)
	}

	// build the form...
	for(var t in config){
		var did_handling = false
		for(var f in FIELD_TYPES){
			if(FIELD_TYPES[f].test(config[t])){
				var field = FIELD_TYPES[f]
				var html = $(field.html)

				// setup text and data...
				setTextWithTooltip(t, html.find('.text'), html)

				if(field.set != null){
					field.set(html, config[t])
				}

				if(field.get != null){
					// NOTE: this is here to isolate t and field.get values...
					// 		...is there a better way???
					var _ = (function(title, getter){
						html.on('resolve', function(evt, e){
							data[title] = getter(e)
						})
					})(t, field.get)
				}

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
	} else {
		var button = null
	}

	var overlay = showInOverlay(root, form)
		.addClass('dialog ' + cls)
		.on('accept', function(){
			form.find('.field').each(function(_, e){
				$(e).trigger('resolve', [$(e)])
			})

			// XXX test if all required stuff is filled...
			res.resolve(data, form)

			hideOverlay(root)
		})
		.on('close', function(){
			res.reject()

		})

	if(button != null){
		button.click(function(){
			overlay.trigger('accept')
		})
	}

	// focus an element...
	// NOTE: if first element is a radio button set, focus the checked
	//		element, else focus the first input...
	form.ready(function(){ 
		// NOTE: we are using a timeout to avoid the user input that opened
		// 		the dialog to end up in the first field...
		setTimeout(function(){
			var elem = form.find('.field input').first()
			if(elem.attr('type') == 'radio'){
				form.find('.field input:checked')
					.focus()
					.select()
			} else {
				elem
					.focus()
					.select()
			}
		}, 100)
	})

	return res
}



/************************************************ Standard dialogs ***/
// NOTE: these return a deferred that will reflect the state of the 
// 		dialog, and the progress of the operations that it riggers...
//
// XXX might be a good idea to be able to block the ui (overlay + progress
// 		bar?) until some long/critical operations finish, to prevent the
// 		user from breaking things while the ui is inconsistent...

function alertDialog(){
	var message = $.makeArray(arguments).join(' ')
	return formDialog(null, String(message), {}, false, 'alert')
}


function promptDialog(message, dfl, btn){
	btn = btn == null ? 'OK' : btn
	var res = $.Deferred()
	formDialog(null, message, {'': ''+(dfl == null ? '' : dfl)}, btn, 'prompt')
		.done(function(data){ res.resolve(data['']) })
		.fail(function(){ res.reject() })
	return res
}


/*
function confirmDialog(){
}
*/



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
