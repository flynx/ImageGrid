/******************************************* Actions (EXPERIMENTAL) **/
// XXX this set of features is experimental...
//
// this gives us:
// 	- namespace cleanup
// 	- auto-generated help
//
// the main questions are:
// 	- is this overcomplicating things?
// 	- are the benefits worth the code bloat?
//


var ImageGrid = {
	// this can be serialized...
	// NOTE: to load a serialized set of options use ImageGrid.set(options)...
	actions: {},
	option: {},
	option_props: {},
	option_groups: [],

	image_data: null,

	// define an action...
	// the two values that are obligatory are:
	// 		title	- name of the action
	// 		call	- callable
	// XXX revise...
	ACTION: function(obj, func){
		var base = this
		var id = func.name != '' ? func.name : obj.id

		if(func != null){
			obj = $.extend(obj, {
				id: id,
				//call: func 
				call: function(){
					res = func.apply(base, arguments)
					$(document).trigger(id)
					return res
				}
			})
		}
		// add all the attrs to the function...
		if(this._type_handler[obj.type] != null){
			this._type_handler[obj.type](obj)
		}
		var call = obj.call
		for(i in obj){
			if(i == 'doc' && call.doc != null){
				call.func_doc = call.doc 
			}
			call[i] = obj[i]
		}
		this[obj.id] = call
		this.actions[obj.id] = call
		return call
	},
	// shorthand: each argument is an action, the group of each will be set the same...
	GROUP: function(group){
		for(var i=1; i<arguments.length; i++){
			var obj = arguments[i]
			obj.group = group
			// if we have an option for this prop then fix it's group too...
			if(this.option_props[obj.id] != null){
				this.option_props[obj.id].group = group
			}
			if(this.option_groups.indexOf(obj.group) < 0 && obj.group != null){
				this.option_groups.push(obj.group)
				this.option_groups.sort()
			}
		}
	},
	// define an option...
	OPTION: function(obj){
		this.option[obj.name] = obj.value
		this.option_props[obj.name] = obj
		if(this.option_groups.indexOf(obj.group) < 0 && obj.group != null){
			this.option_groups.push(obj.group)
			this.option_groups.sort()
		}
		return obj
	},
	TYPE: function(name, handler){
		this._type_handler[name] = handler
	},
	_type_handler: {
	},
}

// system actions and handlers...
ImageGrid.GROUP('API',
	ImageGrid.ACTION({
			doc: 'Set option(s) value(s), calling apropriate callbacks.',
			group: 'API',
			display: false,
		},
		function set(obj){
			for(var n in obj){
				this.option[n] = obj[n]
			}
			// NOTE: this is separate so as to exclude the posibility of race 
			// 		 conditions...
			// 		 ...thogh there is still a posibility of conflicting 
			// 		 modes, especially if one mode sets more modes...
			for(var n in obj){
				// call the callback if it exists...
				if(this.option_props[n].set != null){
					this.option_props[n].set()
				}
			}
		}),
	ImageGrid.ACTION({
			doc: 'Get documentation for name.',
			group: 'API',
			display: false,
		},
		function doc(name){
			return {
				action: this[name] != null ? this[name].doc : null,
				action_func: this[name] != null ? this[name].func_doc : null,
				option: this.option_props[name] != null ? this.option_props[name].doc : null,
			}
		}))

ImageGrid.GROUP('State',
	ImageGrid.ACTION({
			doc: 'Save state to local storage',
			display: false,
		},
		function save_config(name){
			if(name == null){
				name = ''
			}
			$.jStorage.set(this.option.KEY_NAME_CONFIG+name, this.sync())
		}),
	// XXX merge this with save_localstorage...
	ImageGrid.ACTION({
			doc: 'Save state to file',
			display: false,
		},
		function save_file(name){
			if(dumpJSONfile == null){
				return false
			}
			if(name == null){
				name = ''
				// push the last config to a new version...
				var history = loadJSONfile(this.option.FILE_NAME_HISTORY, [])
				// XXX should we add a date?
				history.push(loadJSONfile(this.option.FILE_NAME_STATE))
				// remove versions beyond VERSIONS_TO_KEEP...
				var c = history.length - this.option.VERSIONS_TO_KEEP
				if(c > 0){
					history.splice(0, c)
				}
				dumpJSONfile(this.option.FILE_NAME_HISTORY, history)
			} else {
				name = '-' + name
			}
			this.save_config()
			dumpJSONfile(this.option.FILE_NAME_STATE+name, buildJSON())
		}),
	ImageGrid.ACTION({
			doc: 'Save state to local storage',
			display: false,
		},
		function save_localstorage(name){
			if(name == null){
				name = ''
				// push the last config to a new version...
				var history = $.jStorage.get(this.option.KEY_NAME_HISTORY, [])
				// XXX should we add a date?
				history.push($.jStorage.get(this.option.KEY_NAME_STATE))
				// remove versions beyond VERSIONS_TO_KEEP...
				var c = history.length - this.option.VERSIONS_TO_KEEP
				if(c > 0){
					history.splice(0, c)
				}
				$.jStorage.set(this.option.KEY_NAME_HISTORY, history)
			} else {
				name = '-' + name
			}
			this.save_config()
			$.jStorage.set(this.option.KEY_NAME_STATE+name, buildJSON())
		}),
	ImageGrid.ACTION({
			doc: 'Load state from local storage',
			display: false,
		},
		function load(name, dfl_state, dfl_config){
			if(name == null){
				name = ''
			} else {
				name = '-' + name
			}
			if(dfl_state == null){
				dfl_state = {}
			}
			if(dfl_config == null){
				dfl_config = {}
			}
			loadJSON($.jStorage.get(this.option.KEY_NAME_STATE+name, dfl_state))
			// NOTE: we need to load the config ACTER the state as to be 
			// 		able to set correct state-related data like current 
			// 		image ID...
			this.set($.jStorage.get(this.option.KEY_NAME_CONFIG+name, dfl_config))
		}),
	ImageGrid.ACTION({
			doc: 'Revert to last verison. if n is given then revert n versions back.\n\n'+
					'NOTE: this will push the current state to history, thus '+
							'enabling trivial redo.\n'+
					'NOTE: if n is greater than 1 then all the skipped steps will '+
							'get dropped.',
			display: false,
		},
		function undo(n){
			if(n < 1){
				return
			}
			if(n == null){
				n = 1
			}
			var cur = buildJSON()
			var history = $.jStorage.get(this.option.KEY_NAME_HISTORY, [])
			if(history.length <= n){
				n = history.length-1
			}
			// do the loading...
			var i = history.length - n
			loadJSON(history[i])
			// remove the history top...
			history.splice(i, history.length)
			// push the prev state to enable redo...
			history.push(cur)
			$.jStorage.set(this.option.KEY_NAME_HISTORY, history)
		}),
	ImageGrid.ACTION({
			doc: 'Sync and update option values.\n\n'+
					'NOTE: this is here because JS has no direct way to '+
					'on-demand, transparently update the value of an attr. '+
					'.valueOf() is not transparent enough.',
			display: false,
		},
		function sync(){
			for(var n in this.option_props){
				if(this.option_props[n].get != null){
					var value = this.option_props[n].get()
					this.option_props[n].value = value
					this.option[n] = value
				}
			}
			return this.option	
		}))



ImageGrid.TYPE('toggle', function(obj){
	var call = obj.call
	// wrap the call to set the option...
	// XXX this is context mirroring...
	obj.call = function(action){
		//var res = call(action)
		var res = call.apply(ImageGrid, [action])
		//ImageGrid.option[obj.id] = call('?')
		ImageGrid.option[obj.id] = call.apply(ImageGrid, ['?'])
		return res
	}
	// add an option to store the state...
	ImageGrid.OPTION({
		name: obj.id,
		title: obj.title,
		group: obj.group,
		display: obj.display,
		doc: obj.doc == null ? 'Stores the state of '+obj.id+' action.' : obj.doc,
		value: obj.call('?'),
		set: function(){
			obj.call(ImageGrid.option[obj.id])
		},
		get: function(){
			return obj.call('?')
		},
		click_handler: function(){
			obj.call()
		}
	})
})




/******************************************* Setup Data and Globals **/

var DEBUG = true
//var DEBUG = false


ImageGrid.GROUP('State',
	ImageGrid.OPTION({
			name: 'KEY_NAME_CONFIG',
			title: 'Name of localStorage key to store config data.',
			value: 'ImageGrid_config',
			display: false,
		}),
	ImageGrid.OPTION({
			name: 'FILE_NAME_STATE',
			title: 'File name to store state.',
			value: '.ImageGrid.state',
			display: false,
		}),
	ImageGrid.OPTION({
			name: 'FILE_NAME_HISTORY',
			title: 'File name to store state history.',
			value: '.ImageGrid.history',
			display: false,
		}),
	ImageGrid.OPTION({
			name: 'KEY_NAME_STATE',
			title: 'Name of localStorage key to store state.',
			value: 'ImageGrid_state',
			display: false,
		}),
	ImageGrid.OPTION({
			name: 'KEY_NAME_HISTORY',
			title: 'Name of localStorage key to store state history.',
			value: 'ImageGrid_history',
			display: false,
		}),
	ImageGrid.OPTION({
			name: 'VERSIONS_TO_KEEP',
			title: 'History depth.',
			value: 10,
		}),
	ImageGrid.OPTION({
			name: 'LAST_MOVE_DIRECTION',
			title: 'Direction the last move was made to',
			doc: 'Used to naturally position the current image after '+
					'shift up/down operations.',
			value: 'next',
			display: false,
		}),
	/*
	// XXX is this the correct way to go...
	ImageGrid.OPTION({
			name: 'CURRENT_IMAGE_ID',
			doc: '',
			display: false,
			set: function(){
				$('#' + ImageGrid.option.CURRENT_IMAGE_ID).click()
			},
			get: function(){
				return parseInt($('.current.image').attr('id'))
			}
		}),
	*/
	ImageGrid.OPTION({
			name: 'BACKGROUND_MODES',
			doc: 'list of available background styles.\n\n'+
				'NOTE: there is also a null mode that is what is set in the '+
				'main CSS.',
			display: false,
			value: [
				'dark',
				'black',
				// this can be removed but when given it must be last.
				null
			]
		}),
	ImageGrid.OPTION({
			name: 'NORMAL_MODE_INFO',
			display: false,
			value: null,
			doc: 'Info display in normal mode.',
			set: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'off'){
					ImageGrid.toggleInfo(ImageGrid.option.NORMAL_MODE_INFO)
				}
			},
			get: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'on'){
					return ImageGrid.option.NORMAL_MODE_INFO
				}
				return ImageGrid.toggleInfo('?')
			}
		}),
	ImageGrid.OPTION({
			name: 'NORMAL_MODE_BG',
			display: false,
			value: null,
			doc: 'Background style in normal (ribbon) mode.\n\n'+
				'NOTE: This will get updated on background change in tuntime.\n'+
				'NOTE: null represents the default style.',
			set: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'off'){
					ImageGrid.setBackgroundMode(ImageGrid.option.NORMAL_MODE_BG)
				}
			},
			get: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'on'){
					return ImageGrid.option.NORMAL_MODE_BG
				}
				return ImageGrid.toggleBackgroundModes('?')
			}
		}),
	ImageGrid.OPTION({
			name: 'SINGLE_IMAGE_MODE_BG',
			display: false,
			value: 'black',
			doc: 'Background style in single image mode.\n\n'+
				'NOTE: This will get updated on background change in tuntime.\n'+
				'NOTE: null represents the default style.',
			set: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'on'){
					ImageGrid.setBackgroundMode(ImageGrid.option.SINGLE_IMAGE_MODE_BG)
				}
			},
			get: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'off'){
					return ImageGrid.option.SINGLE_IMAGE_MODE_BG
				}
				return ImageGrid.toggleBackgroundModes('?')
			}
		}),
	ImageGrid.OPTION({
			name: 'ORIGINAL_FIELD_SCALE',
			display: false,
			value: 1.0,
			doc: 'Scale of view in image mode.\n\n'+
				'NOTE: this will change if changed at runtime.',
			set: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'off'){
					ImageGrid.setContainerScale(ImageGrid.option.ORIGINAL_FIELD_SCALE)
				}
			},
			get: function(){
				if(ImageGrid.toggleSingleImageMode('?') == 'on'){
					return ImageGrid.option.ORIGINAL_FIELD_SCALE
				}
				return getElementScale($('.field'))
			}
		}))


ImageGrid.GROUP('Mode: All',
	ImageGrid.OPTION({
			name: 'ZOOM_FACTOR',
			title: 'Zooming factor',
			value: 2,
			doc: 'Sets the zoom factor used for a manual zooming step.'
		}),
	ImageGrid.OPTION({
			name: 'MOVE_DELTA',
			title: 'Move step',
			value: 50,
			doc: 'Sets the move delta in pixels for keyboard view moving.'
		}))


if(DEBUG){
	ImageGrid.OPTION({
			name: 'TEST',
			title: 'Test the Other group mechanics',
			doc: 'this will not be created wone the DEBUG flag is false',
			display: false,
			value: 0,
		})
}



/************************************************ jQuery extensions **/


jQuery.fn.reverseChildren = function(){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().reverse())
	})
}



jQuery.fn.sortChildren = function(func){
	return $(this).each(function(_, e){
		return $(e).append($(e).children().detach().get().sort(func))
	})
}




/********************************************************** Helpers **/

function getImagePath(img){
	var data = getImageData($(img).attr('id'))
	if(data != null){
		return data.path
	}
}

function getImageDate(img){
	var data = getImageData($(img).attr('id'))
	if(data != null){
		return data.ctime
	}
}


function getImageId(img){
	var id = $(img).attr('id')
}

// XXX make this an attr...
var getImageOrder = getImagePath


function setImageOrder(img, order){
	return $(img).attr({'id': order})
}


function cmpImageOrder(a, b){
	a = getImageOrder(a)
	b = getImageOrder(b)
	return a > b ? 1 : a < b ? -1 : 0
}



// NOTE: don't understand why am I the one who has to write this...
var SPECIAL_KEYS = {
	9:		'Tab',
	13:		'Enter',
	16:		'Shift',
	17:		'Ctrl',
	18:		'Alt',
	20:		'Caps Lock',
	27:		'Esc',
	32:		'Space',
	33:		'PgUp',
	34:		'PgDown',	
	35:		'End',
	36:		'Home',
	37:		'Right',
	38:		'Up',
	39:		'Left',
	40:		'Down',
	45:		'Ins',
	46:		'Del',
	80:		'Backspace',
	91:		'Win',
	93:		'Menu',
	
	112:	'F1',
	113:	'F2',
	114:	'F3',
	115:	'F4',
	116:	'F5',
	117:	'F6',
	118:	'F7',
	119:	'F8',
	120:	'F9',
	121:	'F10',
	122:	'F11',
	123:	'F12',
}

// XXX some keys look really wrong...
function toKeyName(code){
	// check for special keys...
	var k = SPECIAL_KEYS[code]
	if(k != null){
		return k
	}
	// chars...
	k = String.fromCharCode(code)
	if(k != ''){
		return k.toLowerCase()
	}
	return null
}


// show a jQuary opject in viewer overlay...
// XXX need to set .scrollTop(0) when showing different UI... 
// 		...and not set it when the UI is the same
// XXX this must create it's own overlay...
function showInOverlay(obj){
	obj.click(function(){ return false })
	// XXX 
	$('.viewer').addClass('overlay-mode')
	// clean things up...
	$('.overlay .content').children().remove()
	// put it in the overlay...
	$('.overlay .content').append(obj)
	// prepare the overlay...
	$('.overlay')
		.one('click', function(){
			$('.overlay')
				.fadeOut(function(){
					$('.overlay .content')
						.children()
							.remove()
					$('.overlay-mode').removeClass('overlay-mode')
				})
		})
		.fadeIn()
	return obj
}



function overlayMessage(text){
	return showInOverlay($('<div class="overlay-message">' +text+ '</div>'))
}



// XXX revise!!
function showOptionsUI(data, get_value, get_handler){
	var tree = {}
	var groups = []
	var groups_ui = {}
	// build the group/action structure...
	for(var a in data){
		var group = data[a].group!=null?data[a].group:'Other'
		if(groups.indexOf(group) == -1){
			groups.push(group)
		}
		if(tree[group] == null){
			tree[group] = []
		}
		tree[group].push([
				data[a].title!=null?data[a].title:a, 
				a
		])
	}
	// sort things...
	groups.sort()
	for(var g in tree){
		tree[g].sort(function(a, b){
			a = a[0]
			b = b[0]
			return a > b ? 1 : a < b ? -1 : 0
		})
	}
	// build the HTML...
	var ui = $('<div class="options"/>')
	for(var g in tree){
		var group = null
		for(var i=0; i<tree[g].length; i++){
			// get the element...
			var elem = data[tree[g][i][1]]
			if(!DEBUG && elem.display == false){
				continue
			}
			if(group == null){
				group = $('<div class="group"/>')
					.append($('<div class="title"/>').text(g))
			}
			var option
			group.append(
				option = $('<div class="option"/>').append($([
					$('<div class="title"/>').text(tree[g][i][0])[0],
					$('<div class="doc"/>').html(
						elem.doc?elem.doc.replace(/\n/g, '<br>'):'')[0],
					$('<div class="value"/>').text(get_value(elem))[0]
			])))
			if(elem.display == false){
				option.addClass('disabled')
			} else {
				// handler...
				var handler = get_handler(elem)
				if(handler != null){
					option.click(handler)
				}
			}
		}
		if(group != null){
			groups_ui[g] = group
		}
	}
	// put the Other group in the back...
	var i = groups.indexOf('Other')
	if(i != -1){
		groups.splice(i, 1)
		groups.push('Other')
	}
	// buildup the sorted groups...
	for(var i=0; i<groups.length; i++){
		ui.append(groups_ui[groups[i]])
	}
	// refresh...
	ui.click(function(){
		// XXX is this a good way to do a refresh?
		showOptionsUI(data, get_value, get_handler)
	})
	showInOverlay(ui)
}



// Return a scale value for the given element(s).
// NOTE: this will only return a single scale value...
function getElementScale(elem){
	//var transform = elem.css('transform')
	var vendors = ['o', 'moz', 'ms', 'webkit']
	var transform = elem.css('transform')
	var res

	// go through vendor prefixes... (hate this!)
	if(!transform || transform == 'none'){
		for(var i in vendors){
			transform = elem.css('-' + vendors[i] + '-transform')
			if(transform && transform != 'none'){
				break
			}
		}
	}
	// no transform is set...
	if(!transform || transform == 'none'){
		return 1
	}
	// get the scale value -- first argument of scale/matrix...
	return parseFloat((/(scale|matrix)\(([^,]*),.*\)/).exec(transform)[2])
}


function setElementScale(elem, scale){
	return elem.css({
		'transform': 'scale('+scale+', '+scale+')',
		'-moz-transform': 'scale('+scale+', '+scale+')',
		'-o-transform': 'scale('+scale+', '+scale+')',
		'-ms-transform': 'scale('+scale+', '+scale+')',
		'-webkit-transform': 'scale('+scale+', '+scale+')',
	})
}


// returns the width of the current image square...
function getCurrentImageSize(){
	return ImageGrid.getContainerScale() * $('.image').width()
}


// returns the number of images fitting viewer size...
function getViewerWidthImages(){
	return Math.floor($('.viewer').width()/getCurrentImageSize())
}


// this will create a function that will add/remove a css_class to elem 
// calling the optional callbacks before and/or after.
//
// elem is a jquery compatible object; default use-case: a css selector.
//
// the resulting function understands the folowing arguments:
// 	- 'on'			: switch mode on
// 	- 'off'			: switch mode off
// 	- '?'			: return current state ('on'|'off')
// 	- no arguments	: toggle the state
//
// NOTE: of only one callback is given then it will be called after the 
// 		 class change...
// 		 a way around this is to pass an empty function as callback_b
//
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
	var func = function(action){
		if(action == null || action == '?'){
			var getter = action == '?' ? true : false
			action = 'on'
			// get current state...
			if( $(elem).hasClass(css_class) ){
				action = 'off'
			}
			if(getter){
				// as the above actions indicate intent and not state, 
				// we'll need to swap the values...
				return action == 'on' ? 'off' : 'on'
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
	func.doc = 'With no arguments this will toggle between "on" and '+
		'"off".\n'+
		'If either "on" or "off" are given then this will switch '+
		'to that mode.\n'+
		'If "?" is given, this will return either "on" or "off" '+
		'depending on the current state.'
	return func
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



// find an image object after which to position image ID...
// used for two main tasks:
// 	- positioning promoted/demoted images
// 	- centering ribbons
// returns:
// 	- null		- empty ribbon or no element greater id should be first
// 	- element
// XXX do we need to make ids numbers for this to work?
function getImageBefore_lin(id, ribbon, get_order){
	if(get_order == null){
		get_order = getImageOrder
	}
	var order = get_order($('#'+id))
	// walk the ribbon till we find two images one with an ID less and 
	// another greater that id...
	var images = ribbon.children('.image')
	var prev = null
	for(var i=0; i < images.length; i++){
		// XXX replace the id attr with a universal getter
		if(get_order(images[i]) > order){
			return prev
		}
		prev = $(images[i])
	}
	return prev
}

// generic binery search for element just before the id...
// NOTE: if id is in lst, this will return the element just before it.
// NOTE: lst must be sorted.
function binarySearch(order, lst, get_order){
	if(get_order == null){
		get_order = function(o){return o}
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
		var i_order = get_order(lst[i])
		// beginning of the array...
		if(i == 0){
			if(order > i_order){
				return i
			}
			return null
		}
		// we got a hit...
		if(i_order == order){
			return i-1
		}
		// we are at the end...
		if(i == lst.length-1 && order > i_order){
			return i
		}
		var ii_order = get_order(lst[i+1])
		// test if order is between i and i+1...
		if( i_order < order && order < ii_order ){
			return i
		}
		// prepare for next iteration...
		// NOTE: we saturate the values so we will never get out of bounds.
		l = Math.round(l/2)
		if(order < i_order){
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
function getImageBefore_bin(id, ribbon, get_order){
	if(get_order == null){
		get_order = getImageOrder
	}
	var order = get_order($('#'+id))
	var images = ribbon.children('.image') 
	var i = binarySearch(order, images, get_order)
	if(i == null){
		return null
	}
	return $(images[i])
}

// set the default search...
var getImageBefore = getImageBefore_bin



/*
 * The folowing two functions will get the vertical and horizontal 
 * distance components between the points a and A, centers of the small
 * and large squares respectively.
 * One of the squares is .field and the other is .container, 
 * which is small or big is not important.
 *
 *      +---------------+-------+
 *      |               |       |
 *      |               |       |
 *      |       + a . . | . . . | . +
 *      |       .       |       |   +- getCurrentVerticalOffset(...)
 *      |       .   + A | . . . | . +
 *      +---------------+       |
 *      |       .   .           |
 *      |       .   .           |
 *      |       .   .           |
 *      +-----------------------+
 *              .   .
 *              +-+-+
 *                +------------------- getCurrentHorizontalOffset(...)
 *
 *
 * Adding this distance to margins of one of the sqares will effectively 
 * allign the two points.
 *
 * NOTE: neither function accunts for field margins.
 *
 */

// get the vertical offset of the center of square from center of container
// NOTE: this does not account for field margins
function getCurrentVerticalOffset(image){
	if(image == null){
		image = $('.image.current')
	}

	var scale = getElementScale($('.field'))

	var ribbons = $('.ribbon')
	var ribbon = image.parents('.ribbon')
	var images = ribbon.children('.image')

	// vertical...
	var H = $('.container').height()
	var h = ribbons.outerHeight(true)
	// margin...
	var mh = h - ribbons.outerHeight()
	// current ribbon position (1-based)
	var rn = ribbons.index(ribbon) + 1
	// relative position to field... 
	// XXX is there a better way to get this?
	var t = rn * (h - mh/2)
	
	return -t + H/2 + h/2
}

// get the horizontal offset of the center of square from center of container
// NOTE: this does not account for field margins
function getCurrentHorizontalOffset(image){
	if(image == null){
		image = $('.image.current')
	}

	var ribbon = image.parents('.ribbon')
	var images = ribbon.children('.image')

	var W = $('.container').width()
	var w = images.outerWidth(true)
	// margin...
	var mw = w - images.outerWidth()
	// current square position (1-based)
	var sn = images.index(image) + 1
	var l = sn * (w - mw/2)

	return -l + W/2 + w/2
}



// XXX some minor inacuracies...
function centerIndicator(){
	// XXX something odd going on with the border here...
	var i_border = Math.abs($('.current-indicator').outerHeight() - $('.current-indicator').height())/2
	$('.current-indicator').css({
		'top': ($('.ribbon').index($('.current.ribbon'))) * $('.ribbon').outerHeight() - i_border, 
		'left': ($('.viewer').outerWidth() - $('.current-indicator').outerWidth())/2,
	})
}



function centerSquare(){
	$('.field').css({
		'margin-top': getCurrentVerticalOffset()
	})
	// horizontal...
	alignRibbon()
	ImageGrid.centerCurrentImage()
}



function alignRibbon(image, position){
	// default values...
	if(image == null){
		image = $('.image.current')
	}
	if(position == null){
		position = 'center'
	}

	var ribbon = image.parents('.ribbon')

	// account for margined field...
	// NOTE: this enables us to cheat and shift all the ribbons just
	//       by changing field margin-left...
	var cml = parseFloat($('.field').css('margin-left'))
	if(!cml){
		cml = 0
	}
	var h_offset = getCurrentHorizontalOffset(image) - cml
	var w = $('.image').outerWidth(true)

	switch(position){
		case 'before':
			ribbon.css({'margin-left': h_offset - w/2})
			return true
		case 'center':
			ribbon.css({'margin-left': h_offset})
			return true
		case 'after':
			ribbon.css({'margin-left': h_offset + w/2})
			return true
	}
	return false
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





/************************************************** Info Generators **/

function currentImageNumberInRibbon(){
	// XXX use image_data intead of DOM as the later can be loaded partially...
	return (
		($('.current.ribbon').children('.image').index($('.current.image'))+1) 
		+ '/' 
		+ $('.current.ribbon').children('.image').length)
}

function currentImagePath(){
	if($('.current.image').length == 0){
		return ''
	}
	return unescape(getImageData($('.current.image').attr('id')).path)
}

function updateInfo(){
	$('.info .bottom-right')
		.text(currentImageNumberInRibbon())

	//$('.info .bottom-left')
	//	.text(currentImagePath())
}




/************************************************** Setup Functions **/
// XXX is this a correct place for these?

function setDefaultInitialState(){
	if($('.current.ribbon').length == 0){
		$('.ribbon').first().addClass('current')
	}
	if($('.current.image').length == 0){
		$('.current.ribbon').children('.image').first().addClass('current')
	}

	updateInfo()
}


function setupEvents(){
	var updated = false
	// persistence...
	$(window).unload(ImageGrid.saveState)
	$(document)
		.on([
				// main modifier events...
				'shiftImageUp',
				'shiftImageDown',
				'shiftImageUpNewRibbon',
				'shiftImageDownNewRibbon',
				'reverseImageOrder',
				'reverseRibbons'
			].join(' '),
			function(){
				updated = true
			})
		.on([
				// navigation events...
				'nextImage prevImage', 
				'nextScreenImages', 
				'prevScreenImages', 
				'focusAboveRibbon', 
				'focusBelowRibbon',
				'firstImage',
				'lastImage'
			].join(' '), 
			function(){
				/*
				updated = true
				*/

				updateInfo()
			})
	// zooming...
	$(document)
		.on([
				'scaleContainerUp',
				'scaleContainerDown',
				'fitNImages',

				'focusAboveRibbon', 
				'focusBelowRibbon'
			].join(' '),
			function(e){
				// call this after transitions are done...
				if(ImageGrid.toggleTransitions('?') == 'on'){
					$('.viewer')
						.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", function(){
							updateRibbonImages($('.current.image'), true)
						})
				} else {
					// update images on zooming...
					updateRibbonImages($('.current.image'), true)
				}
			})
	// save things if updated within a minute...
	// XXX this gets very slow when saving a large data dump...
	/* XXX temporarely disabled to avoid real-life slowdowns...
	setInterval(function(){
			if(updated){
				ImageGrid.saveState()
				updated = false
			}}, 
			// check every 2 minutes...
			2*60*1000)
	*/
	// autosave every ten minutes...
	// XXX do we really need this?
	//setInterval(ImageGrid.saveState, 600000)

	// resize...
	$(window).resize(function() {
		$('.current.image').click()
	})
	// keyboard...
	if(DEBUG){
		$(document)
			.keydown(makeKeyboardHandler(keybindings, function(k){alert(k)}))
	} else {
		$(document)
			.keydown(makeKeyboardHandler(keybindings))
	}
	// swipe...
	$('.viewer')
		.swipe({
			swipeLeft: ImageGrid.nextImage,
			swipeRight: ImageGrid.prevImage,

			swipeUp: ImageGrid.shiftImageUp,
			swipeDown: ImageGrid.shiftImageDown,
		})
	// pinch... 
	// XXX do gradual animated zooming...
	// XXX this does not work with swipe (report submitted)...
	$('.viewer')
		.swipe({
			pinchIn: ImageGrid.scaleContainerUp,
			pinchOut: ImageGrid.scaleContainerDown,

			fingers: '2'
		})

	// dragging...
	// XXX make this work seamlessly with touchSwipe...
	// XXX cancel clicks while dragging...
	// XXX this does not work on android...
	//$('.field').draggable()
}



function setupControlElements(){
	// images...
	// NOTE: when the images are loaded, the actual handlers will be set by the loader...
	setupImageEventHandlers($(".image"))

	// make the indicator active...
	$(".current-indicator div")
		.click(function(){
			$('.current.image').click()
		})
		.dblclick(function(){
			ImageGrid.toggleSingleImageMode()
		})
	

	// buttons...
	$('.screen-button.next-image').mousedown(ImageGrid.nextImage)
	$('.screen-button.prev-image').mousedown(ImageGrid.prevImage)
	// XXX rename classes to "shift-image-up" and "shift-image-down"...
	$('.screen-button.demote').mousedown(ImageGrid.shiftImageUp)
	$('.screen-button.promote').mousedown(ImageGrid.shiftImageDown)
	$('.screen-button.zoom-in').mousedown(ImageGrid.scaleContainerUp)
	$('.screen-button.zoom-out').mousedown(ImageGrid.scaleContainerDown)
	// XXX
	$('.screen-button.toggle-wide').mousedown(ImageGrid.fit21Images)
	$('.screen-button.toggle-single').mousedown(function(){ImageGrid.toggleSingleImageMode()})
	$('.screen-button.fit-three').mousedown(ImageGrid.fitThreeImages)
	$('.screen-button.show-controls').mousedown(function(){ImageGrid.toggleControls('on')})
	$('.screen-button.settings').mousedown(ImageGrid.showKeyboardBindings)
}



/**************************************************** Serialization **/


// setup image event handlers...
function setupImageEventHandlers(image){
	return (image
			.click(handleImageClick)
			.dblclick(function(e){
				$(this).click()
				ImageGrid.toggleSingleImageMode()
			}))
}



// build an image element...
function makeImage(order, set_order){
	if(set_order == null){
		set_order = setImageOrder
	}
	return (setupImageEventHandlers(
				set_order($('<div class="image"/>')
				//set_order($('<div class="image"><div class="image-overlay"/></div>')
					, order)))
}


// NOTE: if there is no id image this will return null
function getImageData(id){
	var json = ImageGrid.image_data
	var ribbons = json.ribbons

	for(var i=0; i<ribbons.length; i++){
		var ribbon = ribbons[i]
		if(ribbon[id] != null){
			return ribbon[id]
		}
	}
}

// Get a preview url of apropriate size...
// NOTE: this is largely independent of ImageGrid.image_data structure, 
// 		it needs only content...
function getURL(id, size){
	if(size == null){
		size = 0
	}
	var json = ImageGrid.image_data
	var ribbons = json.ribbons

	var image = getImageData(id)
	// select appropriate preview...
	if(image.preview != null){
		var sizes = []
		var keys = []
		var max
		for(var s in image.preview){
			if(max == null || max <= s){
				max = s
			}
			if(parseInt(s) >= size){
				sizes.push(parseInt(s))
				keys.push(s)
			}
		}
		// we are bigger than any preview...
		if(sizes.length < 1){
			return image.preview[max]
		} else {
			var cur_size = Math.min.apply(Math, sizes)
			return image.preview[keys[sizes.indexOf(cur_size)]]
		}
	} else {
		// legacy default...
		return image.url
	}
}

function updateImage(img, size){
	var id = img.attr('id')
	var overlay = $('#'+id+' .image-overlay')
	var original_url = img.css('background-image')
	var new_url = 'url('+getURL(id, size)+')'

	// don't do anything if the url has not changed...
	if(new_url != 'none' && new_url == original_url){
		return
	}

	// create an overlay with the same image...
	/*
	overlay
		.css({
			'background-image': original_url, 
			'display': 'block'
		})
	*/
	img
		.css({ 
		'background-image': new_url
		})
	/*
		// when the new image loads, fadeout the overlay remove it...
		// XXX this fires before the image is loaded...
		.ready(function(){
				overlay.fadeOut()
		})
	*/
}



var SCREEN_WIDTH_CACHE = 4

// XXX make this update only when the threshold is passed...
// XXX update images on zoom...
// NOTE: this is largely independent of ImageGrid.image_data...
function updateRibbonImages(img, force){
	var r = getViewerWidthImages()
	var size = getCurrentImageSize()
	var R = r*SCREEN_WIDTH_CACHE
	var images = img.parents('.ribbon').children('.image')

	/* XXX for some reason this does not work...
	// check the threshold -- one screen-width in any direction...
	var i = images.filter('.loaded').index(img)
	if(i >= 0 && Math.abs(i - images.filter('.loaded').length) < r){
		console.log('skipping...', i, images.filter('.loaded').length)
		return
	}
	console.log('loading...', i, images.filter('.loaded').length)
	*/

	var cur_i = images.index(img)

	// load...
	var loading = $([])
	for(var i=Math.max(0, cur_i-R); i<=Math.min(images.length-1, cur_i+R); i++){
		var img = $(images[i])
		loading.push(img[0])
		// update only the images that are not set...
		// XXX update images on zoom...
		var bg = img.css('background-image')
		if(force || bg == 'none' || bg == null){
			updateImage(img, size)
		}
		//img.not('.loaded').css({ 'background-image': 'url('+getURL(img.attr('id'))+')' })
		// remove the processed images from the list...
		images[i] = {}
	}
	// do the loading...
	loading.not('.loaded')
		.addClass('loaded')
	// unload...
	images.filter('.loaded')
		.removeClass('loaded')
		.css({ 'background-image': 'none' })
}



function loadImagesFromList(images){
	var json = {
		ribbons: [
			{}
		]
	}
	var ribbon = json.ribbons[0]
	for(var i = 0; i < images.length; i++){
		ribbon[i] = {
			url: images[i]
		}
	}
	return loadJSON(json)
}



/* bulid a JSON object from current state...
 *
 * format:
 * 	{
 * 		position: <image-id>,
 * 		ribbons: [
 * 			{
 * 				<image-id>: {
 * 					url: <image-URL>,
 * 				},				
 * 				...
 * 			},
 * 			...
 * 		]
 * 	}
 */
// XXX add incremental or partial updates...
function buildJSON(){
	/* XXX can't return this yet as we are not updating this properly yet...
	if(ImageGrid.image_data != null){
		return ImageGrid.image_data
	}
	*/
	var size = getCurrentImageSize()
	var ribbons = $('.ribbon')
	res = {
		position: $('.current.image').attr('id'),
		ribbons: []
	}
	for(var i=0; i < ribbons.length; i++){
		var images = $(ribbons[i]).children('.image')
		// skip empty ribbons...
		if(images.length == 0){
			continue
		}
		var ribbon = {}
		res.ribbons.push(ribbon)
		for(var j=0; j < images.length; j++){
			var image = $(images[j])
			var data = getImageData(image.attr('id'))
			ribbon[data.id] = data
		}
	}
	ImageGrid.image_data = res
	return res
}



// XXX might be good to add images in packs here, not one by one...
// make this work on detached elements...
function loadJSON(data, position, set_order){
	if(position == null){
		position = data.position
	}
	if(set_order == null){
		set_order = setImageOrder
	}
	var ribbons = data.ribbons
	if(ribbons == null){
		return
	}

	// store the structure...
	ImageGrid.image_data = data

	var field = $('.field')
	field.hide()
	//var c = field.parent()

	//field.detach()

	// drop all old content...
	field.children('.ribbon').remove()

	var order = 0

	for(var i=0; i < ribbons.length; i++){
		var images = ribbons[i]
		// skip empty ribbons...
		if(images.length == 0){
			continue
		}
		// create ribbon...
		var ribbon = $('<div class="ribbon"></div>')
		var new_images = {}
		for(var j in images){
			var image = images[j]
			makeImage(j, set_order)
				.appendTo(ribbon)
			order++
		}
		ribbon.appendTo(field)
	}
	// sort images...
	ImageGrid.sortImages()
	console.log('loaded: ', order)
	if(position != null && $('#' + position).length != 0){
		$('#' + position).click()
	} else {
		$('.image').first().click()
	}

	//field.appendTo(c)
	field.show()
}




/*************************************************** Event Handlers **/

// handle click for images...
function handleImageClick(){
	var ribbons = $(this).parents('.ribbon').siblings('.ribbon')
	// set classes...
	$('.current').removeClass('current')
	$(this)
		.addClass('current')
		.parents('.ribbon')
			.addClass('current')
	// position the field and ribbons...
	centerSquare()
	centerIndicator()
	alignRibbons()
	// update this ribbon...
	updateRibbonImages($(this))
	// update other ribbons...
	var id = $(this).attr('id')
	for(var i=0; i<ribbons.length; i++){
		var img = getImageBefore(id, $(ribbons[i]))
		// XXX revise: should we check if ribbon is empty if img is null??
		updateRibbonImages(img?img:$(ribbons[i]).children('.image').first())
	}
}



// if set to false the event handlers will always return false...
var KEYBOARD_HANDLER_PROPAGATE = false

/* Basic key format:
 * 		<key-code> : <callback>,
 * 		<key-code> : {
 * 			'default': <callback>,
 *			// a modifier can be any single modifier, like shift or a 
 *			// combination of modifers like 'ctrl+shift', given in order 
 *			// of priority.
 *			// supported modifiers are (in order of priority):
 *			//	- ctrl
 *			//	- alt
 *			//	- shift
 * 			<modifer>: [...]
 * 		},
 * 		<key-code> : [
 *			// this can be any type of handler except for an alias...
 * 			<handler>, 
 * 			<doc>
 * 		],
 *		// alias...
 * 		<key-code-a> : <key-code-b>,
 *
 * XXX might need to add meta information to generate sensible help...
 */
function makeKeyboardHandler(keybindings, unhandled){
	if(unhandled == null){
		unhandled = function(){return false}
	}
	return function(evt){
		var did_handling = false
		var res = null
		for(var mode in keybindings){
			if($(mode).length > 0){
				var bindings = keybindings[mode]

				var key = evt.keyCode
				if(bindings.ignore != null && bindings.ignore.indexOf(key) != -1){
					// return true
					res = res == null ? true : res
					did_handling = true
					continue
				}
				// XXX ugly...
				var modifers = evt.ctrlKey ? 'ctrl' : ''
				modifers += evt.altKey ? (modifers != '' ? '+alt' : 'alt') : ''
				modifers += evt.shiftKey ? (modifers != '' ? '+shift' : 'shift') : ''

				var handler = bindings[key]

				// alias...
				while (typeof(handler) == typeof(123)) {
					handler = bindings[handler]
				}
				// no handler...
				if(handler == null){
					continue
				}
				// Array, lisp style with docs...
				// XXX for some odd reason in chrome typeof([]) == typeof({})!!!
				if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
					// we do not care about docs here, so just get the handler...
					handler = handler[0]
				}
				// complex handler...
				if(typeof(handler) == typeof({})){
					var callback = handler[modifers]
					if(callback == null){
						callback = handler['default']
					}
					if(callback != null){
						res = callback()
						did_handling = true
						continue
					}
				} else {
					// simple callback...
					res = handler() 
					did_handling = true
					continue
				}
			}
		}
		if(!did_handling){
			// key is unhandled by any modes...
			return unhandled(key)
		} else {
			// XXX should we handle multiple hits???
			return KEYBOARD_HANDLER_PROPAGATE&&res?true:false
		}
	}
}




/************************************************ Mode & UI Actions **/

ImageGrid.GROUP('Mode: All',
	ImageGrid.ACTION({
			title: 'Save current state.',
		},
		function saveState(){
			ImageGrid.save_localstorage()
		}),
	ImageGrid.ACTION({
			title: 'Get the background mode',
			display: false,
		},
		function getBackgroundMode(){
			var mode = null
			var BACKGROUND_MODES = ImageGrid.option.BACKGROUND_MODES
			// find a mode to set...
			for(var i = 0; i < BACKGROUND_MODES.length; i++){
				// we found our mode...
				if( $('.' + BACKGROUND_MODES[i]).length > 0 ){
					return BACKGROUND_MODES[i]
				}
			}
			return mode
		}),
	ImageGrid.ACTION({
			title: 'Set the background mode',
			doc: 'NOTE: passing null will set the default.',
			display: false,
		},
		function setBackgroundMode(mode){
			var BACKGROUND_MODES = ImageGrid.option.BACKGROUND_MODES
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
		}),
	ImageGrid.ACTION({
			title: 'Toggle background modes',
			doc: 'Toggle through background theems: none -> dark -> black\n\n'+
				'NOTE: modes are toggled independently for single image and '+
				'rinbon modes',
			type: 'toggle',
		},
		function toggleBackgroundModes(action){
			if(action == '?'){
				return ImageGrid.getBackgroundMode()
			} else if(action != null){
				return ImageGrid.setBackgroundMode(action)
			} else {
				var BACKGROUND_MODES = ImageGrid.option.BACKGROUND_MODES
				var mode = ImageGrid.getBackgroundMode()
				// default -> first
				if(mode == null){
					ImageGrid.setBackgroundMode(BACKGROUND_MODES[0])
				// last -> default...
				} else if(mode == BACKGROUND_MODES[BACKGROUND_MODES.length-1]){
					ImageGrid.setBackgroundMode()
				// next...
				} else {
					ImageGrid.setBackgroundMode(BACKGROUND_MODES[BACKGROUND_MODES.indexOf(mode)+1])
				}
			}
		}),
	ImageGrid.ACTION({
			id: 'toggleInfo',
			title: 'Single additional information',
			type: 'toggle',
		}, 
		createCSSClassToggler('.viewer', 'display-info', updateInfo)),

	ImageGrid.ACTION({
			id: 'toggleControls',
			title: 'Toggle keyboard-oriented interface',
			doc: 'Toggle Touch/Keyboard UI controls.',
			type: 'toggle',
		},
		createCSSClassToggler('.viewer', 'hidden-controls')),
	ImageGrid.ACTION({
			id: 'toggleTransitions',
			title: 'Global transitions',
			doc: 'Toggle global transitions.',
			type: 'toggle',
		},
		createCSSClassToggler('.viewer', 'transitions-enabled')))



ImageGrid.GROUP('Configuration and Help',
	ImageGrid.ACTION({
			title: 'Close overlay'
		},
		function closeOverlay(){ $('.overlay').click() }),
	// XXX use order and priority of options...
	// XXX make history work for this...
	// XXX should this be a toggle??
	ImageGrid.ACTION({
			title: 'Settings',
			doc: 'Show setup interface.',
		},
		function showSetup(){
			showOptionsUI(ImageGrid.option_props, 
					function(e){
						// XXX need to update a value here...
						return ImageGrid.option[e.name]
					}, 
					function(e){return e.click_handler})
		}),
	// XXX do not use global keybindings...
	ImageGrid.ACTION({
			title: 'Keyboard configuration',
			doc: 'Show keyboard configuration interface.',
		},
		function showKeyboardBindings(){
			// build reverse key index...
			var bindings = {}
			for(var m in keybindings){
				var mode_bindings = keybindings[m]

				// XXX do the doc for the mode...
				// XXX

				for(var k in mode_bindings){
					// XXX skip doc attrs...
					if(k == 'title' || k == 'doc' || k == 'ignore'){
						continue
					}

					var id
					var v = mode_bindings[k]

					// alias...
					while (typeof(v) == typeof(123)) {
						v = mode_bindings[v]
					}
					// Array, lisp style with docs...
					if(typeof(v) == typeof([]) && v.constructor.name == 'Array'){
						// XXX what do we do here???
					}
					// function...
					if(typeof(v) == typeof(function(){})){
						id = v.id != null ? v.id : v.name
					}
					// complex handler...
					// NOTE: this can contain several key bindings...
					if(typeof(v) == typeof({})){
						for(var m in v){
							id = v[m].id != null ? v[m].id : v[m].name
							if(bindings[id] == null){
								bindings[id] = []
							} 
							bindings[id].push((m=='default'?'':m+'+') + toKeyName(k))
						}
						continue
					}

					if(bindings[id] == null){
						bindings[id] = []
					} 
					bindings[id].push(toKeyName(k))
				}

			}
			showOptionsUI(ImageGrid.actions, 
					function(e){ 
						return (bindings[e.id]!=null?bindings[e.id]:'None')
									.toString()
									.replace(/,/g, ', ') 
					}, 
					// XXX
					function(e){})
		}))



ImageGrid.GROUP('Mode: Single Image',
	ImageGrid.ACTION({
			id: 'toggleSingleImageMode',
			title: 'Single image mode',
			doc: 'Toggle single image mode.',
			type: 'toggle',
		},
		createCSSClassToggler('.viewer', 'single-image-mode', 
			// pre...
			function(action){
				if(action == 'on'){
					ImageGrid.option.NORMAL_MODE_BG = ImageGrid.getBackgroundMode()
					ImageGrid.option.NORMAL_MODE_INFO = ImageGrid.toggleInfo('?')
					ImageGrid.option.ORIGINAL_FIELD_SCALE = getElementScale($('.field'))
				// do this only when coming out of single image mode...
				} else if(ImageGrid.toggleSingleImageMode('?') == 'on'){
					ImageGrid.option.SINGLE_IMAGE_MODE_BG = ImageGrid.getBackgroundMode()
				}
			},
			// post...
			function(action){
				if(action == 'on'){
					ImageGrid.fitImage()
					ImageGrid.setBackgroundMode(ImageGrid.option.SINGLE_IMAGE_MODE_BG)
					ImageGrid.toggleInfo('off')
				} else {
					ImageGrid.setContainerScale(ImageGrid.option.ORIGINAL_FIELD_SCALE)
					ImageGrid.setBackgroundMode(ImageGrid.option.NORMAL_MODE_BG)
					ImageGrid.toggleInfo(ImageGrid.option.NORMAL_MODE_INFO)
				}
				clickAfterTransitionsDone()
			})),
	// XXX for some reason this is backwords... (says 'on' when it's off ans 'off' when on)
	// 		...and needs an extra click to sync with state...
	ImageGrid.ACTION({
			id: 'toggleSingleImageModeTransitions',
			title: 'Disable single image mode transitions',
			doc: 'Toggle transitions in single image mode.',
			type: 'toggle',
		},
		createCSSClassToggler('.viewer', 'no-single-image-transitions')))



ImageGrid.GROUP('Mode: Ribbon',
	ImageGrid.ACTION({
			id: 'toggleSingleRibbonMode',
			title: 'Single ribbon mode',
			doc: 'Show/hide other ribbons.',
			type: 'toggle',
		}, 
		createCSSClassToggler('.viewer', 'single-ribbon-mode')),
	ImageGrid.ACTION({
			id: 'toggleCurrentRibbonOpacity',
			title: 'Current ribbon opacity',
			doc: 'Toggle other image transparancy/opacity in current ribbon.',
			type: 'toggle',
		}, 
		createCSSClassToggler('.viewer', 'opaque-current-ribbon')),
	ImageGrid.ACTION({
			id: 'toggleIndicatorDot',
			title: 'Dot indicator',
			doc: 'Toggle indicator between dot and frame modes.\n\n'+
					'NOTE: this is visible only when the indicator is visible.',
			type: 'toggle',
		}, 
		createCSSClassToggler('.viewer', 'dot-indicator')),

	// XXX this can be done in two ways:
	// 		- keep all images when promoting, just add a class to them that 
	// 		  will hide them until we enable their display...
	// 		  	+ very fast to show/hide
	// 		  	- will complicate reversing ribbons allot
	// 		- add/remove these images on demand
	// 			+ a tad complicated...
	ImageGrid.ACTION({
			id: 'toggleDisplayShiftedUpImages',
			title: 'Display shifted up images',
			doc: 'Toggle display of shifted images.',
			display: false,
			type: 'toggle',
		},
		createCSSClassToggler('.viewer', 'show-shifted-up-images')))





/********************************************************* Movement **/

ImageGrid.GROUP('Movement',
	ImageGrid.ACTION({
			title: 'Center origin',
			doc: 'Set the transform-origin to the center of the current view.',
			display: false,
		},
		function centerOrigin(){
			var mt = parseFloat($('.field').css('margin-top'))
			var ml = parseFloat($('.field').css('margin-left'))
			var cml = parseFloat($('.current.ribbon').css('margin-left'))

			var t = parseFloat($('.field').css('top'))
			var l = parseFloat($('.field').css('left'))
			var w = $('.field').width()
			var h = $('.field').height()
			var W = $('.container').width()
			var H = $('.container').height()

			var ot = -getCurrentVerticalOffset() + H/2 - t
			var ol = -ml + W/2 - l

			$('.field').css({
				'transform-origin': ol + 'px ' + ot + 'px',
				'-o-transform-origin': ol + 'px ' + ot + 'px',
				'-moz-transform-origin': ol + 'px ' + ot + 'px',
				'-webkit-transform-origin': ol + 'px ' + ot + 'px',
				'-ms-transform-origin': ol + 'px ' + ot + 'px'
			})

			// XXX for debugging...
			$('.origin-marker').css({
				'top': ot,
				'left': ol
			})
		}),
	// XXX these work oddly when page is scaled in maxthon... 
	// XXX virtually identical, see of can be merged...
	ImageGrid.ACTION({
			title: 'Move view up',
		},
		function moveViewUp(){
			var t = parseInt($('.field').css('top'))
			$('.field').css({'top': t-(ImageGrid.option.MOVE_DELTA)})
		}),
	ImageGrid.ACTION({
			title: 'Move view down',
		},
		function moveViewDown(){
			var t = parseInt($('.field').css('top'))
			$('.field').css({'top': t+(ImageGrid.option.MOVE_DELTA)})
		}),
	ImageGrid.ACTION({
			title: 'Move view left',
		},
		function moveViewLeft(){
			var l = parseInt($('.field').css('left'))
			$('.field').css({'left': l-(ImageGrid.option.MOVE_DELTA)})
		}),
	ImageGrid.ACTION({
			title: 'Move view right',
		},
		function moveViewRight(){
			var l = parseInt($('.field').css('left'))
			$('.field').css({'left': l+(ImageGrid.option.MOVE_DELTA)})
		}),

	ImageGrid.ACTION({
			title: 'Center current image',
		},
		function centerCurrentImage(){
			$('.field')
				.css({
					'top': 0,
					'left': 0
				})
				// do this after animations are done...
				.one("webkitTransitionEnd oTransitionEnd msTransitionEnd transitionend", ImageGrid.centerOrigin)
			// this is repeated intentionally...
			// ...needed for small shifts, while the after-animation event 
			// is for large moves.
			ImageGrid.centerOrigin()
		}))



/******************************************************* Navigation **/

ImageGrid.GROUP('Navigation',
	// basic navigation...
	ImageGrid.ACTION({
			title: 'Go to first image',
		},
		function firstImage(){
			return $('.current.ribbon').children('.image').first().click()
		}),
	ImageGrid.ACTION({
			title: 'Go to previous image',
		},
		function prevImage(){
			ImageGrid.option.LAST_MOVE_DIRECTION = 'prev'
			return $('.current.image').prev('.image').click()
		}),
	ImageGrid.ACTION({
			title: 'Go to next image',
		},
		function nextImage(){
			ImageGrid.option.LAST_MOVE_DIRECTION = 'next'
			return $('.current.image').next('.image').click()
		}),
	ImageGrid.ACTION({
			title: 'Go to last image',
		},
		function lastImage(){
			return $('.current.ribbon').children('.image').last().click()
		}),

	ImageGrid.ACTION({
			title: 'Skip screen images',
			doc: 'Skip screen-width images in specified direction',
			display: false,
		},
		function skipScreenImages(direction){
			// calculate screen width in images...
			var W = $('.viewer').width()
			var w = $('.current.image').width()
			var scale = getElementScale($('.field'))
			var n = Math.max(Math.floor(W/(w*scale))-1, 0)

			var img = $('.current.image')[direction + 'All']('.image').eq(n)
			if(img.length > 0){
				return img.click()
			} else if(direction == 'next'){
				return ImageGrid.lastImage()
			} else if(direction == 'prev'){
				return ImageGrid.firstImage()
			}
		}),
	ImageGrid.ACTION({
			title: 'Skip next screen images',
		},
		function nextScreenImages(){ return ImageGrid.skipScreenImages('next') }),
	ImageGrid.ACTION({
			title: 'Skip screen images backwards',
		},
		function prevScreenImages(){ return ImageGrid.skipScreenImages('prev') }),

	ImageGrid.ACTION({
			title: 'Focus ribbon',
			doc: 'Focus ribbon in specified direction',
			display: false,
		},
		function focusRibbon(direction){
			var id = $('.current.image').attr('id')
			var prev = getImageBefore(id, $('.current.ribbon')[direction]('.ribbon'))
			if(prev){
				var next = prev.next()
				// NOTE: direction is accounted for to make the up/down shifts 
				// 		 symmetrical in the general case...
				if(next.length == 0 || direction == 'next'){
					return prev.click()
				} else {
					return next.click()
				}
			} else {
				return $('.current.ribbon')[direction]('.ribbon').children('.image').first().click()
			}
		}),
	ImageGrid.ACTION({
			title: 'Focus ribbon above',
		},
		function focusAboveRibbon(){ return ImageGrid.focusRibbon('prev') }),
	ImageGrid.ACTION({
			title: 'Focus ribbon below',
		},
		function focusBelowRibbon(){ return ImageGrid.focusRibbon('next') }))





/********************************************************** Zooming **/

ImageGrid.GROUP('Zooming',
	ImageGrid.ACTION({
			title: 'Get container scale',
			display: false,
		},
		function getContainerScale(){
			return getElementScale($('.field'))
		}),
	ImageGrid.ACTION({
			title: 'Scale container by factor',
			display: false,
		},
		function scaleContainerBy(factor){
			return ImageGrid.setContainerScale(getElementScale($('.field'))*factor)
		}),
	ImageGrid.ACTION({
			title: 'Scale container up',
		},
		function scaleContainerUp(){
			return ImageGrid.scaleContainerBy(ImageGrid.option.ZOOM_FACTOR)
		}),
	ImageGrid.ACTION({
			title: 'Scale container down',
		},
		function scaleContainerDown(){
			return ImageGrid.scaleContainerBy(1/ImageGrid.option.ZOOM_FACTOR)
		}),
	ImageGrid.ACTION({
			title: 'Set container scale',
			display: false,
		},
		function setContainerScale(scale){
			return setElementScale($('.field'), scale)
		}),


	ImageGrid.ACTION({
			title: 'Fit N images to container width/height',
			display: false,
		},
		function fitNImages(n){
			var H = $('.container').height()
			var W = $('.container').width()

			var h = $('.image.current').height()
			// NOTE: this is cheating, need to get actual three widths...
			var w = $('.image.current').width()*n

			var f = Math.min(H/h, W/w)

			ImageGrid.centerCurrentImage()
			ImageGrid.setContainerScale(f)
		}),
	// the fit N image pack, for 1 <= N <= 9
	ImageGrid.ACTION({ title: 'Fit 1 image' }, function fitImage(){ImageGrid.fitNImages(1)}),
	ImageGrid.ACTION({ title: 'Fit 2 images' }, function fitTwoImages(){ImageGrid.fitNImages(2)}),
	ImageGrid.ACTION({ title: 'Fit 3 images' }, function fitThreeImages(){ImageGrid.fitNImages(3)}),
	ImageGrid.ACTION({ title: 'Fit 4 images' }, function fitFourImages(){ImageGrid.fitNImages(4)}),
	ImageGrid.ACTION({ title: 'Fit 5 images' }, function fitFiveImages(){ImageGrid.fitNImages(5)}),
	ImageGrid.ACTION({ title: 'Fit 6 images' }, function fitSixImages(){ImageGrid.fitNImages(6)}),
	ImageGrid.ACTION({ title: 'Fit 7 images' }, function fitSevenImages(){ImageGrid.fitNImages(7)}),
	ImageGrid.ACTION({ title: 'Fit 8 images' }, function fitEightImages(){ImageGrid.fitNImages(8)}),
	ImageGrid.ACTION({ title: 'Fit 9 images' }, function fitNineImages(){ImageGrid.fitNImages(9)}),
	ImageGrid.ACTION({ title: 'Fit 21 images' }, function fit21Images(){ImageGrid.fitNImages(21)})
)




/*************************************************** Ribbon Actions **/
// basic actions...
// NOTE: below 'direction' argument is meant in the html sence, 
//       i.e. next/prev...

ImageGrid.GROUP('Ribbon manipulations',
	// XXX adding a ribbon above the current is still jumpy, need to devise 
	// 		a cleaner way to do this...
	ImageGrid.ACTION({
			title: 'Create a ribbon above/below current',
			display: false,
		},
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
			// XXX this is a hack...
			setTimeout(function(){$('.field').removeClass('unanimated')}, 10)
			//$('.field').removeClass('unanimated')	

			return res
		}),
	// XXX this uses jquery animation...
	// XXX one way to optimise this is to add the lesser ribbon to the 
	//     greater disregarding their actual order...
	// XXX think about using $(...).sortChildren(...) / sortImages()
	ImageGrid.ACTION({
			title: 'Merge current and direction ribbon.',
			doc: 'NOTE: this will take all the elements from direction '+
				'ribbon and add them to current.',
			display: false,
		},
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
		}),
		
	ImageGrid.ACTION({
			title: 'Reverse ribbon order',
			doc: 'NOTE: this is like flipping the field vertically.',
		},
		function reverseRibbons(){
			// reverse...
			$('.field').reverseChildren()
			// compensate for offset cange...
			$('.current.image').click()
		}))




/**************************************************** Image Actions **/
ImageGrid.GROUP('Image manipulation',
	ImageGrid.ACTION({
			title: 'Shift image in direction',
			display: false,
		},
		function shiftImage(direction){
			if($('.current.ribbon')[direction]('.ribbon').length == 0){
				ImageGrid.createRibbon(direction)
			}

			// get previous element after which we need to put the current...
			var prev_elem = getImageBefore(
								$('.current.image').attr('id'), 
								$('.current.ribbon')[direction]('.ribbon'))

			// last image in ribbon, merge...
			if($('.current.ribbon').children('.image').length == 1){
				ImageGrid.mergeRibbons(direction)
			} else {
				img = $('.current.image')
				// XXX how will this behave if we are at the last image in ribbon???
				if((ImageGrid.option.LAST_MOVE_DIRECTION == 'prev' && img.prev('.image').length != 0)
						|| (ImageGrid.option.LAST_MOVE_DIRECTION == 'next' && img.next('.image').length == 0)){
					ImageGrid.prevImage()
				} else {
					ImageGrid.nextImage()
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
		}),
	// shift image...
	ImageGrid.ACTION({ title: 'Shift image up', }, 
		function shiftImageUp(){ return ImageGrid.shiftImage('prev') }),
	ImageGrid.ACTION({ title: 'Shift image down', }, 
		function shiftImageDown(){ return ImageGrid.shiftImage('next') }),

	// shift image to new ribbon...
	ImageGrid.ACTION({ 
			title: 'Shift image up to new ribbon', 
		}, 
		function shiftImageUpNewRibbon(){
			ImageGrid.createRibbon('prev')
			ImageGrid.shiftImageUp()
		}),
	ImageGrid.ACTION({ 
			title: 'Shift image down to new ribbon', 
		}, 
		function shiftImageDownNewRibbon(){
			ImageGrid.createRibbon('next')
			ImageGrid.shiftImageDown()
		}),
			
	// sorting...
	ImageGrid.ACTION({ 
			title: 'Sort images via criteria',
			doc: 'Use the cmp function to update image id\'s and resort.',
			display: false,
		}, 
		function sortImagesVia(cmp){
			$('.ribbon').sortChildren(cmp)
			updateRibbonImages($('.current.image').click())
		}),
	ImageGrid.ACTION({ 
			title: 'Sort images',
			doc: 'Sort images in all ribbons\n\n'+
				'NOTE: this will only realign three ribbons.'
		}, 
		function sortImages(){
			ImageGrid.sortImagesVia(cmpImageOrder)
		}),
	ImageGrid.ACTION({ 
			title: 'Reverse order of images',
			doc: 'this will reverse image order in all ribbons.',
		}, 
		function reverseImageOrder(){
			// this is done by reversing their id attr
			ImageGrid.sortImagesVia(function(a, b){return cmpImageOrder(b, a)})
		}),
	ImageGrid.ACTION({ 
			title: 'Sort images by ID',
		}, 
		function sortImagesById(){
			getImageOrder = getImageId
			ImageGrid.sortImages()
		}),
	ImageGrid.ACTION({ 
			title: 'Sort images by date',
		}, 
		function sortImagesByDate(){
			getImageOrder = getImageDate
			ImageGrid.sortImages()
		}),
	ImageGrid.ACTION({ 
			title: 'Sort images by their full path',
		}, 
		// XXX this should use a normalized path...
		function sortImagesByPath(){
			getImageOrder = getImagePath
			ImageGrid.sortImages()
		}))


// XXX group images in ribbon and merge down/up
//
// 		grouping will make the images in a ribbon adjacent to each 
// 		other...
//
// 		the group's position will be the same as current images i.e. 
// 		between the below/above two images...

// XXX shift group/image right/left...




/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
