/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

/* XXX get rid of this ASAP...
if(typeof(module) !== 'undefined' && module.exports){
	var NW = true
	var gui = require('nw.gui')

} else {
	var NW = false
}
*/


define(function(require){ var module = {}


//var promise = require('promise')

var toggler = require('../toggler')
var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')



/*********************************************************************/
// Helpers...

// XXX why do we need this???
var quoteWS = function(str){
	return str.replace(/(\s)/g, '\\$1')
}


// Quote a string and convert to RegExp to match self literally.
// XXX this depends on jli.quoteRegExp(..)
function toRegExp(str){
	return RegExp('^'
		// quote regular expression chars...
		+quoteRegExp(str)
		//+str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
		+'$')
}


function makeBrowserMaker(constructor){
	return function(elem, list, rest){
		if(typeof(rest) == typeof('str')){
			return constructor(elem, { data: list, path: rest })

		} else {
			var opts = {}
			for(var k in rest){
				opts[k] = rest[k]
			}
			opts.data = list
			return constructor(elem, opts)
		}
	}
}



/*********************************************************************/

// NOTE: the widget itself does not need a title, that's the job for
//		a container widget (dialog, field, ...)
//		...it can be implemented trivially via an attribute and a :before
//		CSS class...
var BrowserClassPrototype = {

	// Normalize path...
	//
	// This converts the path into a universal absolute array 
	// representation, taking care of relative path constructs including
	// '.' (current path) and '..' (up one level)
	//
	// XXX does this need to handle trailing '/'???
	// 		...the problem is mainly encoding a trailing '/' into an 
	// 		array, adding a '' at the end seems both obvious and 
	// 		artificial...
	// XXX is this the correct name???
	// 		...should this be .normalizePath(..)???
	path2list: function(path){
		var splitter = /[\\\/]/

		if(typeof(path) == typeof('str')){
			path = path
				.split(splitter)
				.filter(function(e){ return e != '' })
		}

		// we've got a relative path...
		if(path[0] == '.' || path[0] == '..'){
			path = this.path.concat(path)
		}

		path = path
			// clear the '..'...
			// NOTE: we reverse to avoid setting elements with negative
			// 		indexes if we have a leading '..'
			.reverse()
			.map(function(e, i){
				if(e == '..'){
					e = '.'
					path[i] = '.'
					path[i+1] = '.'
				}
				return e
			})
			.reverse()
			// filter out '.'...
			.filter(function(e){ return e != '.' })

		return path
	},

	// Construct the dom...
	make: function(obj, options){
		var browser = $('<div>')
			.addClass('browse-widget')
			// make thie widget focusable...
			// NOTE: tabindex 0 means automatic tab indexing and -1 means 
			//		focusable bot not tabable...
			//.attr('tabindex', -1)
			.attr('tabindex', 0)
			// focus the widget if something inside is clicked...
			.click(function(){
				$(this).focus()
			})

		if(options.flat){
			browser.addClass('flat')
		}

		// path...
		var path = $('<div>')
			.addClass('v-block path')
			/*
			.click(function(){
				// XXX set contenteditable...
				// XXX set value to path...
				// XXX select all...
			})
			.on('blur', function(){
				// XXX unset contenteditable...
			})
			.keyup(function(){
				// XXX update path...
				// 		- set /../..../ to path
				// 		- use the part after the last '/' ad filter...
			})
		  	*/

		if(options.pathPrefix){
			path.attr('prefix', options.pathPrefix)
		}
		if(options.show_path == false){
			path.hide()
		}

		browser
			.append(path)
			// list...
			.append($('<div>')
				   .addClass('v-block list'))

		return browser
	},
}



// XXX Q: should we make a base list dialog and build this on that or
//		simplify this to implement a list (removing the path and disabling
//		traversal)??
// XXX might be a good idea to add a ctrl-c/copy handler...
// 		...copy path by default but overloadable with something like 
// 		.getCopyValue() which would return .strPath by default...
var BrowserPrototype = {
	dom: null,

	// option defaults and doc...
	options: {
		// Initial path...
		//path: null,

		//show_path: true,
		
		// Set the path prefix...
		//
		// XXX at this time this is used only for generating paths, need
		// 		to also use this for parsing...
		pathPrefix: '/',

		// Enable/disable user selection filtering...
		//
		// NOTE: this only affects starting the filter...
		filter: true,

		// Enable/disable full path editing...
		//
		// NOTE: as with .filter above, this only affects .startFullPathEdit(..)
		fullPathEdit: true,

		// If false will disable traversal...
		// NOTE: if false this will also disable traversal up.
		// NOTE: this will not disable manual updates or explicit path 
		// 		setting.
		// NOTE: another way to disable traversal is to set 
		// 		.not-traversable on the .browse-widget element
		// NOTE: if false this will also disable .toggleNonTraversableDrawing()
		// 		as this will essentially hide/show the whole list.
		traversable: true,

		// If true non-traversable items will be shown...
		//
		// NOTE: setting both this and .traversable to false will hide 
		// 		all elements in the list.
		showNonTraversable: true,

		// If true disabled items will be shown...
		//
		// NOTE: this will have an effect only on items disabled via list/make
		// 		items with .disabled CSS class set manually will not be 
		// 		affected...
		showDisabled: true,

		// Enable/disable disabled drawing...
		// 
		// If false these will disable the corresponding methods.
		//
		// NOTE: these are here to let the user enable/disable these 
		// 		without the need to go into the keyboard configuration...
		// NOTE: non-traversable drawing is disabled/enabled by .traversable
		// 		option above.
		// NOTE: this will have an effect only on items disabled via list/make
		// 		items with .disabled CSS class set manually will not be 
		// 		affected...
		toggleDisabledDrawing: true,

		// Group traversable elements...
		//
		// Possible values:
		// 	null | false | 'none'	- show items as-is
		// 	'first'					- group traversable items at top
		// 	'last'					- group traversable items at bottom
		sortTraversable: null,

		// Controls the display of the action button on each list item...
		//
		// Possible values:
		// 	false			- disable the action button
		// 	true			- show default action button
		// 	<text/html>		- display <text/html> in action button
		actionButton: false,

		// Controls the display of the push button on each list item...
		//
		// This has the same semantics as .actionButton so see that for 
		// more info.
		pushButton: false,

		// A set of custom buttons to add to each item.
		//
		// Format:
		itemButtons: false,

		// Handle keys that are not bound...
		// NOTE: to disable, set ot undefined.
		logKeys: function(k){ window.DEBUG && console.log(k) },

		// If set disables leading and trailing '/' on list and path 
		// elements.
		// This is mainly used for flat list selectors.
		flat: false,

		// List of events that will not get propagated outside the browser...
		//
		// NOTE: these are local events defined on the widget, so it 
		// 		would not be logical to propagate them up the DOM, but if
		// 		such behavior is desired one could always change the 
		// 		configuration ;)
		nonPropagatedEvents: [
			'push',
			'pop',
			'open',
			'update',
			'select',
			'deselect',

			//'keydown',

			'close',
		],

		// Shorthand elements...
		//
		// Format:
		// 	{
		// 		<key>: {
		// 			class: <element-class-str>,
		// 			html: <element-html-str>,
		// 		},
		// 		...
		// 	}
		//
		// If make(..) gets passed <key> it will construct and element
		// via <element-html-str> with an optional <element-class-str>
		//
		// NOTE: .class is optional...
		// NOTE: set this to null to disable shorthands...
		elementShorthand: {
			'---': {
				'class': 'separator',
				'html': '<hr>'
			},
			'...': {
				'class': 'separator',
				'html': '<center><div class="loader"/></center>',
			},
		},

		// Separator class...
		//
		// NOTE: if make(..) is passed an element with this class it will
		// 		be treated as a separator and not as a list element.
		// NOTE: to disable class checking set this to null
		elementSeparatorClass: 'separator',
	},

	// XXX TEST: this should prevent event propagation...
	// XXX should we have things like ctrl-<number> for fast selection 
	// 		in filter mode???
	keyboard: {
		// XXX this is the same as FullPathEdit, should we combine the two?
		ItemEdit: {
			pattern: '.browse-widget .list .text[contenteditable]',

			// keep text editing action from affecting the selection...
			ignore: [
					'Backspace',
					'Up',
					'Down',
					'Left',
					'Right',
					'Home',
					'End',
					'Enter',
					'Esc',
					'/',
					'A',
					'P',
					'O',
					'T', 'D',

					// let the system handle copy paste...
					'C', 'V', 'X',

					// enter numbers as-is...
					'#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
				],

			// XXX
			Enter: 'push!',
			Esc: 'update!',
		},

		FullPathEdit: {
			pattern: '.browse-widget .path[contenteditable]',

			// keep text editing action from affecting the selection...
			ignore: [
					'Backspace',
					'Up',
					'Down',
					'Left',
					'Right',
					'Home',
					'End',
					'Enter',
					'Esc',
					'/',
					'A',
					'P',
					'O',
					'T', 'D',

					// let the system handle copy paste...
					'C', 'V', 'X',

					// enter numbers as-is...
					'#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
				],

			Enter: 'stopFullPathEdit!',
			Esc: 'abortFullPathEdit!',
		},

		Filter: {
			pattern: '.browse-widget .path div.cur[contenteditable]',

			// keep text editing action from affecting the selection...
			ignore: [
					'Backspace',
					'Left',
					'Right',
					'Home',
					'End',
					'Enter',
					'Esc',
					'/',
					'A',
					'P',
					'O',
					'T', 'D',

					// let the system handle copy paste...
					'C', 'V', 'X',

					// enter numbers as-is...
					'#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
				],

			// XXX should this be an action or a push????
			//Enter: 'action!',
			Enter: 'push!',
			Esc: 'stopFilter!',
		},

		General: {
			pattern: '.browse-widget',

			Up: 'prev!',
			Down: 'next!',
			Left: {
				default: 'pop!',
				ctrl: 'update!: "/"',
			},
			Backspace: 'Left',
			Right: 'push',
			P: 'push',

			// XXX
			PgUp: 'prevPage!',
			PgDown: 'nextPage!',

			Home: 'navigate!: "first"',
			End: 'navigate!: "last"',

			Enter: 'action',
			O: 'action',
			Esc: 'close',

			'/': 'startFilter!',

			A: {
				ctrl: 'startFullPathEdit!',
			},

			D: 'toggleDisabledDrawing',
			T: 'toggleNonTraversableDrawing',

			// XXX should these use .select(..)???
			// XXX should these be relative to visible area or absolute 
			// 		to current list regardless of scroll (as is now)???
			// XXX should these work while filtering??
			'#1': 'push!: "0!"',
			'#2': 'push!: "1!"',
			'#3': 'push!: "2!"',
			'#4': 'push!: "3!"',
			'#5': 'push!: "4!"',
			'#6': 'push!: "5!"',
			'#7': 'push!: "6!"',
			'#8': 'push!: "7!"',
			'#9': 'push!: "8!"',
		},
	},


	// Call the constructor's .path2list(..)..
	//
	// See: BrowserClassPrototype.path2list(..) for docs...
	path2list: function(path){ 
		// if list is flat we do not need to split it, just format...
		if(this.options.flat && path && path.constructor !== Array){
			return path == '' || path.length == 0 ? [] : [path]
		}
		return this.constructor.path2list.apply(this, arguments) 
	},

	// Trigger jQuery events on Browser...
	//
	// This will pass the Browser instance to .source attribute of the
	// event object triggered.
	//
	// NOTE: event propagation for some events is disabled by binding 
	// 		to them handlers that stop propagation in .__init__(..).
	// 		The list of non-propagated events in defined in 
	// 		.options.nonPropagatedEvents
	//
	// XXX triggering events from here and from jQuery/dom has a 
	// 		different effect...
	//trigger: widget.triggerEventWithSource,

	// specific events...
	focus: widget.proxyToDom('focus'),
	blur: widget.proxyToDom('blur'),


	// base api...

	// XXX should these set both the options and dom???
	get flat(){
		return !this.dom.hasClass('flat') || this.options.flat
	},
	set flat(value){
		if(value){
			this.dom.addClass('flat')
		} else {
			this.dom.removeClass('flat')
		}
		this.options.flat = value
	},

	// XXX should these set both the options and dom???
	get traversable(){
		return !this.dom.hasClass('not-traversable') && this.options.traversable
	},
	set traversable(value){
		if(value){
			this.dom.removeClass('not-traversable')
		} else {
			this.dom.addClass('not-traversable')
		}
		this.options.traversable = value
	},

	// Get/set the listed path...
	//
	// On more info on setting the path see .update(..)
	//
	// NOTE: .path = <path> is equivalent to .update(<path>) 
	// NOTE: if the string path assigned does not contain a trailing '/'
	// 		the path will be loaded up to the last item and the last item
	// 		will be selected (see .update(..) for example).
	// NOTE: to avoid duplicating and syncing data, the actual path is 
	//		stored in DOM...
	// NOTE: path returned does not include the currently selected list 
	// 		element, just the path to the current list...
	// 		To get the path with selection use: .selectionPath prop
	get path(){
		var skip = false
		return this.dom.find('.path .dir:not(.cur)')
			.map(function(i, e){ return $(e).text() })
			.toArray() },
	set path(value){
		this.update(value) },

	// String path...
	//
	// This is the same as .path but returns a string result.
	//
	// NOTE: this does not include the selected element, i.e. the returned 
	// 		path always ends with a trailing '/'.
	// NOTE: the setter is just a shorthand to .path setter for uniformity...
	//
	// XXX need to append '/' only if traversable...
	get strPath(){
		return this.options.pathPrefix + this.path.join('/') + '/'
	},
	set strPath(value){
		this.path = value
	},

	// Get/set path with selection...
	//
	// NOTE: this always returns the selected element last if one is 
	// 		selected, if no element is selected this is equivalent to 
	// 		.strPath
	// NOTE: the setter is just a shorthand to .path setter for uniformity...
	get selectionPath(){
		return this.strPath + (this.selected || '')
	},
	set selectionPath(value){
		this.path = value
	},

	// Get/set current selection (text)...
	//
	// NOTE: .selected = <value> is equivalent to .select(<value>) for 
	// 		more info on accepted values see .select(..)
	get selected(){
		var e = this.select('!')
		if(e.length <= 0){
			return null
		}
		return e.find('.text').text()
	},
	set selected(value){
		return this.select(value)
	},


	// NOTE: if .options.traversable is false this will have no effect.
	// XXX might be a good idea to toggle .non-traversable-hidden CSS 
	// 		class here too...
	// 		...will need to account for 1-9 shortcut keys and hints to 
	// 		still work...
	toggleNonTraversableDrawing: function(){
		var cur = this.selected 
		if(this.options.traversable == false){
			return this
		}
		this.options.showNonTraversable = !this.options.showNonTraversable
		this.update()
		cur && this.select(cur)
		return this
	},
	// XXX this will not affect elements that were disabled via setting 
	// 		the .disabled class and not via list/make...
	// 		...is this a problem???
	// XXX might be a good idea to toggle .disabled-hidden CSS class 
	// 		here too...
	// 		...will need to account for 1-9 shortcut keys and hints to 
	// 		still work...
	toggleDisabledDrawing: function(){
		var cur = this.selected 
		if(this.options.toggleDisabledDrawing == false){
			return this
		}
		this.options.showDisabled = !this.options.showDisabled
		this.update()
		cur && this.select(cur)
		return this
	},


	/*
	// Copy/Paste actions...
	//
	// XXX use 'Text' for IE...
	copy: function(){
		var path = this.strPath

		if(NW){
			gui.Clipboard.get()
				.set(path, 'text')

		// browser...
		// XXX use 'Test' for IE...
		} else if(event != undefined){
			event.clipboardData.setData('text/plain', path)
		}

		return path
	},
	paste: function(str){
		// generic...
		if(str != null){
			this.path = str

		// nw.js
		} else if(NW){
			this.path = gui.Clipboard.get()
				.get('text')

		// browser...
		// XXX use 'Test' for IE...
		} else if(event != undefined){
			this.path = event.clipboardData.getData('text/plain')
		}

		return this
	},
	*/

	// update (load) path...
	// 	- build the path
	// 	- build the element list
	// 	- bind to control events
	// 	- return a deferred
	//
	// This will trigger the 'update' event.
	//
	// For uniformity and ease of access from DOM, this will also set the
	// 'path' html attribute on the .browse-widget element.
	//
	// If the given string path does not end with a '/' then the path
	// up to the last item will be loaded and the last item loaded.
	//
	// Examle:
	// 		Load and select...
	// 		'/some/path/there'		-> .update('/some/path/')
	// 									.select('there')
	//
	// 		Load path only...
	// 		'/some/path/there/'		-> .update('/some/path/there/')
	//
	//
	// NOTE: setting the DOM attr 'path' works one way, navigating to a
	// 		different path will overwrite the attr but setting a new 
	// 		value to the html attr will not affect the actual path.
	// NOTE: .path = <some-path> is equivalent to .update(<some-path>)
	// 		both exist at the same time to enable chaining...
	// NOTE: this will scroll the path to show the last element for paths
	// 		that do not fit in view...
	//
	//
	// Item constructor:
	// 	This is passed to the lister and can be used by the user to 
	// 	construct and extend list items.
	//
	// Make an item...
	//	make(item, options)
	//	make(item, traversable, disabled, buttons)
	//		-> item
	//
	//	item format:
	//	- str					- item text
	//								NOTE: if text is '---' then a 
	//									separator item is created, it is
	//									not selectable (default: <hr>).
	//									
	//	- [str/func, ... ]		- item elements
	//								Each of the elements is individually
	//								wrapped in a .text container.
	//								If an item is a function it is called 
	//								and the returned value is treated as
	//								the text.
	//								NOTE: empty strings will get replaced 
	//									with &nbsp;
	//	- DOM/jQuery			- an element to be used as an item
	//
	//	Both traversable and disabled are optional and can take bool 
	//	values.
	//
	//	options format:
	//	{
	//		traversable: ..,
	//		disabled: ..,
	//		buttons: ..,
	//	}
	//
	//	buttons format (optional):
	//	[ 
	//		[<html>, <func>], 
	//		... 
	//	]
	//
	// NOTE: buttons will override .options.itemButtons, if this is not
	// 		desired simply append the custom buttons to a copy of 
	// 		.itemButtons
	//
	//
	// Finalize the dialog (optional)...
	// 	- Call make.done() can optionally be called after all the itmes
	// 		are created. This will update the dialog to align the 
	// 		selected position.
	// 		This is useful for dialogs with async loading items. 
	//
	//
	// XXX need a way to handle path errors in the extension API...
	// 		...for example, if .list(..) can't list or lists a different
	// 		path due to an error, we need to be able to render the new
	// 		path both in the path and list sections...
	// 		NOTE: current behaviour is not wrong, it just not too flexible...
	//
	// XXX one use-case here would be to pass this a custom lister or a full
	// 		browser, need to make this work correctly for full set of 
	// 		events...
	// 			- custom lister -- handle all sub-paths in some way...
	// 			- full browser -- handle all sub-paths by the nested 
	// 								browser...
	// 		one way to handle nested browsers is to implement a browser 
	// 		stack which if not empty the top browser handles all the 
	// 		sub-paths
	// 		...this will also need to indicate a way to split the path 
	// 		and when to 'pop' the sub browser...
	update: function(path, list){
		path = path || this.path
		var browser = this.dom
		var that = this
		var focus = browser.find(':focus').length > 0
		list = list || this.list

		var deferred = $.Deferred()

		// string path and terminated with '/' -- no selection...
		if(typeof(path) == typeof('str') && !/[\\\/]/.test(path.trim().slice(-1))){
			path = this.path2list(path)
			var selection = path.pop()

		} else {
			path = this.path2list(path)
			var selection = null
		}

		// clear the ui...
		var p = browser.find('.path').empty()
		var l = browser.find('.list').empty()

		// set the path prefix...
		p.attr('prefix', this.options.pathPrefix)

		var c = []
		// fill the path field...
		path.forEach(function(e){
			c.push(e)
			var cur = c.slice()
			p.append($('<div>')
				.addClass('dir')
				.click(function(){
					if(that.traversable){
						that.update(cur.join('/')) 
					}
				})
				.text(e))
		})

		// add current selection indicator...
		var txt
		p.append($('<div>')
			.addClass('dir cur')
			.click(function(){
				event.stopPropagation()
				that.toggleFilter('on')
			})
			.on('blur', function(){
				that.toggleFilter('off')
			})
			/* XXX does the right thing (replaces the later .focus(..) 
			 * 		and .keyup(..)) but does not work in IE...
			.on('input', function(){
				//that.filterList(quoteWS($(this).text()))
				that.filterList($(this).text())
			})
			*/
			// only update if text changed...
			.focus(function(){
				txt = $(this).text()
			})
			.keyup(function(){
				var cur  = $(this).text()
				if(txt != cur){
					txt = cur
					that.filterList(cur)
				}
			}))


		// handle path scroll..
		var e = p.children().last()
		// scroll to the end when wider than view...
		if(e.length > 0 && p.width() < p[0].scrollWidth){
			// scroll all the way to the right...
			p.scrollLeft(p[0].scrollWidth)

		// keep left aligned...
		} else {
			p.scrollLeft(0)
		}

		var sort_traversable = this.options.sortTraversable
		var section_tail
		// fill the children list...
		// NOTE: this will be set to true if make(..) is called at least once...
		var interactive = false

		// XXX revise signature... 
		var make = function(p, traversable, disabled, buttons){
			// options passed as an object...
			if(traversable != null && typeof(traversable) == typeof({})){
				var opts = traversable
				traversable = opts.traversable
				disabled = opts.disabled
				buttons = opts.buttons
			}

			buttons = buttons
				|| (that.options.itemButtons && that.options.itemButtons.slice())

			// special case: shorthand...
			if(p && (p in (that.options.elementShorthand || {})
					|| (p.hasClass 
						&& p in that.options.elementShorthand
						&& that.options.elementShorthand[p].class
						&& p.hasClass(that.options.elementShorthand[p].class)))){
				var res = p
				var shorthand = that.options.elementShorthand[p]
				if(typeof(res) == typeof('str')){
					res = $(shorthand.html)
						.addClass(shorthand.class || '')
				}
				res.appendTo(l)
				return res
			}

			// array of str/func...
			if(p.constructor === Array){
				// resolve handlers...
				p = p.map(function(e){ 
					return typeof(e) == typeof(function(){}) ? 
						// XXX should this pass anything to the handler 
						// 		and set the context???
						e.call(that, p) 
						: e})

				var txt = p.join('')
				// XXX check if traversable...
				p = $(p.map(function(t){
					return $('<span>')
						.addClass('text')
						// here we also replace empty strings with &nbsp;...
						[t ? 'text' : 'html'](t || '&nbsp;')[0]
				}))

			// jQuery or dom...
			} else if(p instanceof jQuery){
				// XXX is this the correct way to do this???
				var txt = p.text()
				// XXX disable search???
				//console.warn('jQuery objects as browse list elements not yet fully supported.')

			// str and other stuff...
			} else {
				var txt = p = p + ''

				// trailing '/' -- dir...
				var dir = /[\\\/]\s*$/
				traversable = dir.test(p) && traversable == null ? true : traversable
				traversable = traversable == null ? false : traversable
				p = $('<span>')
						.addClass('text')
						.text(p.replace(dir, ''))
			}

			interactive = true

			// skip drawing of non-traversable or disabled elements if
			// .showNonTraversable or .showDisabled are false respectively...
			if((!traversable && !that.options.showNonTraversable)
					|| (disabled && !that.options.showDisabled)){
				return $()
			}

			// build list item...
			var res = $('<div>')
				// handle clicks ONLY when not disabled...
				.click(function(){
					if(!$(this).hasClass('disabled')){
						//that.push(quoteWS($(this).find('.text').text())) 
						that.push('"'+ $(this).find('.text').text() +'"')
					}
				})
				// append text elements... 
				.append(p)

			if(!traversable){
				res.addClass('not-traversable')
			} 
			if(disabled){
				res.addClass('disabled')
			}

			// buttons...
			// action (open)...
			if(traversable && that.options.actionButton){
				res.append($('<div>')
					.addClass('button')
					.html(that.options.actionButton === true ? 
						'&check;' 
						: that.options.actionButton)
					.click(function(evt){
						evt.stopPropagation()
						that.select('"'+ txt +'"')
						that.action()
					}))
			}
			// push...
			if(traversable && that.options.pushButton){
				res.append($('<div>')
					.addClass('button')
					.html(that.options.pushButton ?
						'p' 
						: that.options.pushButton)
					.click(function(evt){
						evt.stopPropagation()
						that.push('"'+ txt +'"')
					}))
			}

			// custom buttons...
			buttons && buttons
				// make the order consistent for the user -- first
				// in list, first in item (from left), and should
				// be added last...
				.reverse()
				.forEach(function(e){
					var html = e[0]
					var func = e[1]

					res.append($('<div>')
						.addClass('button')
						.html(html)
						.click(function(evt){
							// prevent clicks from triggering the item action...
							evt.stopPropagation()

							// action name...
							if(typeof(func) == typeof('str')){
								that[func](txt)

							// handler...
							} else {
								func.call(that, txt)
							}
						}))
				})

			// place in list...
			// as-is...
			if(!sort_traversable || sort_traversable == 'none'){
				res.appendTo(l)

			// traversable first/last...
			} else {
				if(sort_traversable == 'first' ? traversable : !traversable){
					section_tail == null ?
						l.prepend(res)
						: section_tail.after(res)
					section_tail = res

				} else {
					res.appendTo(l)
				}
			}

			return res
		}

		// align the dialog...
		make.done = function(){
			var s = l.find('.selected')			
			s.length > 0 && that.select(s)
		}

		// build the list...
		var res = list.call(this, path, make)

		// second API: make is not called and .list(..) returns an Array
		// that will get loaded as list items...
		if(!interactive && res && res.constructor == Array){
			res.forEach(make)
		} 

		// wait for the render...
		if(res && res.then){
			res.then(function(){ deferred.resolve() })

		// sync...
		} else {
			deferred.resolve()
		}

		//return this
		return deferred
			.done(function(){
				that.dom.attr('path', this.strPath)
				that.trigger('update')

				// select the item...
				if(selection){
					that.select(selection)
				}

				// maintain focus within the widget...
				if(focus && browser.find(':focus').length == 0){
					that.focus()
				}

			})
	},

	// Filter the item list...
	//
	// 	General signature...
	// 	.filter(<pattern>[, <rejected-handler>][, <ignore-disabled>])
	// 		-> elements
	// 	
	//
	// 	Get all elements...
	// 	.filter()
	// 	.filter('*')
	// 		-> all elements
	//
	// 	Get all elements containing a string...
	// 	.filter(<string>)
	// 		-> elements
	// 		NOTE: as whitespace is treated as a pattern separator, if it
	// 			is need explicitly simply quote it...
	// 				'a b c'		- three sub patterns: 'a', 'b' and 'c'
	// 				'a\ b\ c'	- single pattern
	//
	// 	Get element exactly matching a string...
	// 	.filter(<quoted-string>)
	// 		-> elements
	// 		NOTE: this supports bot single and double quotes, e.g. 
	// 			'"abc"' and "'abc'" are equivalent...
	// 		NOTE: only outer quotes are considered, so if there is a 
	// 			need to exactly match '"X"', just add a set of quotes 
	// 			around it, e.g. '""X""' or '\'"X"\''...
	//
	// 	Get all elements matching a regexp...
	// 	.filter(<regexp>)
	// 		-> elements
	//
	// 	Filter the elements via a function...
	// 	.filter(<function>)
	// 		-> elements
	// 		NOTE: the elements passed to the <function> on each iteration
	// 			are unwrapped for compatibility with jQuery API.
	//
	// 	Get specific element...
	// 	.filter(<index>)
	// 	.filter(<jQuery-obj>)
	// 		-> element
	//		-> $()
	// 		NOTE: when passing a jQuery-obj it will be returned iff it's
	// 			an element.
	// 		NOTE: unlike .select(..) index overflow will produce empty 
	// 			lists rather than to/bottom elements.
	//
	// 	Get specific absolute element...
	// 	.filter('<index>!')
	// 		-> element
	//		-> $()
	//		NOTE: this is equivalent to setting ignore_disabled tp false
	//
	// If <rejected-handler> function is passed it will get called with 
	// every element that was rejected by the predicate / not matching 
	// the pattern.
	//
	// By default, <ignore-disabled> is true, thus this will ignore 
	// disabled elements. If <ignore_disabled> is false then disabled 
	// elements will be searched too.
	//
	// NOTE: this will filter every item loaded regardless of visibility.
	//
	//
	// Extended string patterns:
	//
	// The pattern string is split by whitespace and each resulting 
	// substring is searched independently.
	// Order is not considered.
	//
	// 	Examples:
	// 		'aaa'			- matches any element containing 'aaa'
	// 							(Same as: /aaa/)
	// 		'aa bb'			- matches any element containing both 'aa'
	// 							AND 'bb' in any order.
	// 							(Same as: /aa.*bb|bb.*aa/)
	//
	// NOTE: currently there is no way to search for whitespace explicitly,
	// 		at this point this is "by-design" as an experiment on how
	// 		vital this feature is.
	//
	// TODO need to support glob / nested patterns...
	// 		..things like /**/a*/*moo/ should list all matching items in
	// 		a single list.
	//
	// XXX case sensitivity???
	// XXX invalid patterns that the user did not finish inputing???
	filter: function(pattern, a, b){
		pattern = pattern == null ? '*' : pattern
		var ignore_disabled = typeof(a) == typeof(true) ? a : b
		ignore_disabled = ignore_disabled == null ? true : ignore_disabled
		var rejected = typeof(a) == typeof(true) ? null : a

		var that = this
		var browser = this.dom

		var elems = browser.find('.list>div' 
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+ (ignore_disabled ? 
				':not(.disabled):not(.filtered-out)' 
				: ''))

		if(pattern == '*'){
			return elems 
		}

		// special case: absolute position...
		if(/\d+!/.test(pattern)){
			return this.filter(parseInt(pattern), rejected, false)
		}

		// function...
		if(typeof(pattern) == typeof(function(){})){
			var filter = function(i, e){
				e = e[0]
				if(!pattern.call(e, i, e)){
					if(rejected){
						rejected.call(e, i, e)
					}
					return false
				}
				return true
			}

		// regexp...
		} else if(pattern.constructor == RegExp
				|| (typeof(pattern) == typeof('str') 
					&& /^(['"]).*\1$/.test(pattern.trim()))){
			if(typeof(pattern) == typeof('str')){
				pattern = toRegExp(pattern.trim().slice(1, -1))
			}
			var filter = function(i, e){
				if(!pattern.test($(e).find('.text').text())){
					if(rejected){
						rejected.call(e, i, e)
					}
					return false
				}
				return true
			}

		// string...
		// NOTE: this supports several space-separated patterns.
		// NOTE: this is case-agnostic...
		// 		...for case sensitivity remove .toLowerCase()...
		// XXX support glob...
		} else if(typeof(pattern) == typeof('str')){
			//var pl = pattern.trim().split(/\s+/)
			var pl = pattern.trim()
				// split on whitespace but keep quoted chars...
				.split(/\s*((?:\\\s|[^\s])*)\s*/g)
				// remove empty strings...
				.filter(function(e){ return e.trim() != '' })
				// remove '\' -- enables direct string comparison...
				.map(function(e){ return e.replace(/\\(\s)/g, '$1').toLowerCase() })
			var filter = function(i, e){
				e = $(e)
				var t = e.find('.text').text().toLowerCase()
				for(var p=0; p < pl.length; p++){
					// NOTE: we are not using search here as it treats 
					// 		the string as a regex and we need literal
					// 		search...
					var i = t.indexOf(pl[p])
					if(!(i >= 0)){
						if(rejected){
							rejected.call(e, i, e)
						}
						return false
					}
				}
				return true
			}

		// number...
		} else if(typeof(pattern) == typeof(123)){
			return elems.eq(pattern)

		// jQuery object...
		} else if(elems.index(pattern) >= 0){
			return pattern

		// unknown pattern...
		} else {
			return $()
		}

		return elems.filter(filter)
	},

	// Filter list elements...
	//
	// This will set the .filtered-out class on all non-matching elements.
	//
	// Use .filterList('*') to clear filter and show all elements.
	//
	// NOTE: see .filter(..) for docs on actual filtering.
	// NOTE: this does not affect any UI modes, for list filtering mode
	// 		see: .toggleFilter(..)...
	// XXX should this be case insensitive???
	filterList: function(pattern){
		var that = this
		var browser = this.dom

		// show all...
		if(pattern == null || pattern.trim() == '*'){
			browser.find('.filtered-out')
				.removeClass('filtered-out')
			// clear the highlighting...
			browser.find('.list b')
				.replaceWith(function() { return this.innerHTML })

		// basic filter...
		} else {
			var p = RegExp('(' 
				+ pattern
					.trim()
					// ignore trailing '\'
					.replace(/\\+$/, '')
					.split(/(?=[^\\])\s/)
					// drop empty strings...
					.filter(function(e){ return e.trim() != '' })
					// remove escapes...
					.map(function(e){ return e.replace(/\\(\s)/, '$1') })
					.join('|') 
				+ ')', 'gi')
			// XXX should this be case insensitive???
			this.filter(pattern,
					// rejected...
					function(i, e){
						e
							.addClass('filtered-out')
							.removeClass('selected')
					},
					// NOTE: setting this to true will not remove disabled
					// 		elements from view as they will neither get 
					// 		included in the filter nor in the filtered out
					// 		thus it will require manual setting of the
					// 		.filtered-out class
					false)
				// passed...
				.removeClass('filtered-out')
				// NOTE: this will mess up (clear) any highlighting that was 
				// 		present before...
				.each(function(_, e){
					e = $(e)
						.find('.text')
						// NOTE: here we support multiple text elements per
						// 		list element...
						.each(function(i, e){
							e = $(e)
							var t = e.text()
							e.html(t.replace(p, '<b>$1</b>'))
						})
				})
		}

		return this
	},


	// internal actions...
	
	// full path editing...
	//
	// 	start ---->	edit --(enter)--> stop (accept)
	// 				  |
	// 			 	 +-------(esc)--> abort (reset)
	//
	//
	// NOTE: the event handlers for this are set in .__init__()...
	//
	// XXX should these be a toggle???
	startFullPathEdit: function(){
		if(this.options.fullPathEdit){
			var browser = this.dom
			var path = this.strPath
			var orig = this.selected
			browser
				.attr('orig-path', path)
				.attr('orig-selection', orig)

			var range = document.createRange()
			var selection = window.getSelection()

			var e = browser.find('.path')
				.text(path)
				.attr('contenteditable', true)
				.focus()

			range.selectNodeContents(e[0])
			selection.removeAllRanges()
			selection.addRange(range)
		}
		return this
	},
	abortFullPathEdit: function(){
		var browser = this.dom
		var e = browser.find('.path')

		var path = '/' + browser.attr('orig-path')
		var selection = browser.attr('orig-selection')

		this.stopFullPathEdit(path)

		if(selection != ''){
			this.select(selection)	
		}

		return this
	},
	stopFullPathEdit: function(path){
		var browser = this.dom
			.removeAttr('orig-path')
			.removeAttr('orig-selection')

		var e = browser.find('.path')
			.removeAttr('contenteditable')

		this.path = path || e.text()

		return this
			.focus()
	},
	
	// list filtering...
	//
	// 	start ---->	edit / select --(enter)--> action (use selection)
	// 					 |
	// 					 +-------(blur/esc)--> exit (clear)
	//
	//
	// NOTE: the action as a side effect exits the filter (causes blur 
	// 		on filter field)...
	// NOTE: this uses .filter(..) for actual filtering...
	// NOTE: on state change this will return this...
	toggleFilter: toggler.CSSClassToggler(
		function(){ return this.dom }, 
		'filtering',
		// do not enter filter mode if filtering is disabled...
		function(action){ return action != 'on' || this.options.filter },
		function(action){
			// on...
			if(action == 'on'){
				var range = document.createRange()
				var selection = window.getSelection()

				var that = this
				var e = this.dom.find('.path .dir.cur')
					//.text('')
					.attr('contenteditable', true)

				// place the cursor...
				//range.setStart(e[0], 0)
				//range.collapse(true)
				range.selectNodeContents(e[0])
				selection.removeAllRanges()
				selection.addRange(range)
					
			// off...
			} else {
				this.filterList('*')
				this.dom
					.find('.path .dir.cur')
						.text('')
						.removeAttr('contenteditable')

				// NOTE: we might select an item outside of the current visible
				// 		area, thus re-selecting it after we remove the filter 
				// 		will place it correctly.
				this.select(this.select('!'))

				this.focus()
			}

			return this
		}),
	// shorthands mostly for use as actions...
	startFilter: function(){ return this.toggleFilter('on') },
	stopFilter: function(){ return this.toggleFilter('off') },

	// Toggle filter view mode...
	toggleFilterViewMode: function(){
		this.dom.toggleClass('show-filtered-out')
		return this
	},

	// XXX should this be a toggler???
	disableElements: function(pattern){
		this.filter(pattern, false)
			.addClass('disabled')
			.removeClass('selected')
		return this
	},
	enableElements: function(pattern){
		this.filter(pattern, false)
			.removeClass('disabled')
		return this
	},

	// Select an element from current list...
	//
	// This is like .filter(..) but:
	// 	- adds several special case arguments (see below)
	// 	- gets it first matched element and selects it
	// 	- takes care of visual scrolling.
	//
	//	Get selected element if it exists, otherwise select and return 
	//	the first...
	//	.select()
	//		-> elem
	//
	//	Get selected element if it exists, null otherwise...
	//	.select('!')
	//		-> elem
	//		-> $()
	//
	//	Deselect
	//	.select(null)
	//		-> $()
	//
	//	Select jQuery object...
	//	.select(<elem>)
	//		-> elem
	//		-> $()
	//
	// All other call configurations are like .filter(..) so see that 
	// for more info.
	//
	// This will return a jQuery object.
	//
	// This will trigger the 'select' or 'deselect' events.
	//
	// For uniformity and ease of access from DOM, this will also set 
	// the value attr on the .browse-widget element.
	// NOTE: this is one way and setting the html attribute "value" will
	// 		not affect the selection, but changing the selection will 
	// 		overwrite the attribute.
	//
	// NOTE: if multiple matches occur this will select the first.
	// NOTE: 'none' will always return an empty jQuery object, to get 
	// 		the selection state before deselecting use .select('!')
	// NOTE: this uses .filter(..) for string and regexp matching...
	select: function(elem, filtering){
		var browser = this.dom
		var pattern = '.list>div'
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+':not(.disabled):not(.filtered-out):visible'
		var elems = browser.find(pattern)

		if(elems.length == 0){
			return $()
		}

		filtering = filtering == null ? this.toggleFilter('?') == 'on' : filtering

		// empty list/string selects none...
		elem = elem != null && elem.length == 0 ? null : elem
		// no args -> either we start with the selected or the first...
		if(elem === undefined){
			var cur = this.select('!')
			elem = cur.length == 0 ? 0 : cur
		}

		// explicit deselect...
		if(elem === null){
			if(!filtering){
				browser.find('.path .dir.cur').empty()
			}
			elems = elems
				.filter('.selected')
				.removeClass('selected')
			this.trigger('deselect', elems)
			return $()
		}

		// strict...
		if(elem == '!'){
			return elems.filter('.selected')
		}

		var item = elem instanceof $ ? elem : this.filter(elem).first()

		// we found a match or got an element...
		// NOTE: if elem was a keyword it means we have an item with the
		// 		same text on the list...
		if(item.length != 0){
			elem = $(item).first()

			// clear selection...
			this.select(null, filtering)
			if(!filtering){
				browser.find('.path .dir.cur').text(elem.find('.text').text())
			}

			// handle scroll position...
			var p = elem.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			var h = elem.height()
			var t = elem.offset().top - p.offset().top

			// XXX should this be in config???
			var D = 3 * h 

			// too low...
			if(t+h+D > H){
				p.scrollTop(S + (t+h+D) - H)

			// too high...
			} else if(t < D){
				p.scrollTop(S + t - D)
			}

			// now do the selection...
			elem.addClass('selected')
			browser.attr('value', elem.find('.text').text())

			this.trigger('select', elem)

			return elem
		}

		// nothing found...
		return $()
	},

	// Navigate relative to selection...
	//
	// 	Navigate to first/previous/next/last element...
	// 	.navigate('first')
	// 	.navigate('prev')
	// 	.navigate('next')
	// 	.navigate('last')
	// 		-> elem
	// 		NOTE: this will overflow, i.e. navigating 'next' when on the
	// 				last element will navigate to the first.
	// 		NOTE: when no element is selected, 'next' will select the 
	// 				first, while 'prev' the last element's
	//
	// 	Deselect element...
	// 	.navigate('none')
	// 		-> elem
	//
	//
	// Other arguments are compatible with .select(..) and then .filter(..)
	// but note that this will "shadow" any element with the save name as
	// a keyword, e.g. if we have an element with the text "next", 
	// .navigate('next') will simply navigate to the next element while
	// .select('next') / .filter('next') will yield that element by name.
	navigate: function(action, filtering){
		var pattern = '.list>div'
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+':not(.disabled):not(.filtered-out):visible'
		action = action || 'first'
																   
		if(action == 'none'){
			return this.select(null, filtering)

		} else if(action == 'next' || action == 'prev'){
			var to = this.select('!', filtering)[action+'All'](pattern).first()
			// range check and overflow...
			if(to.length == 0){
				action = action == 'next' ? 'first' : 'last'
			} else {
				return this.select(to, filtering)
			}
		}
		return action == 'first' ? this.select(0, filtering)
			: action == 'last' ? this.select(-1, filtering)
			// fall back to select...
			: this.select(action, filtering)
	},

	// Select next/prev element...
	next: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.navigate('next')
		return this
	},
	prev: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.navigate('prev')
		return this
	},

	getTopVisibleElem: function(){
		var elems = this.filter('*')

		var p = elems.first().scrollParent()
		var S = p.scrollTop()
		var T = p.offset().top

		if(S == 0){
			return elems.first()
		}

		return elems
			.filter(function(i, e){
				return $(e).offset().top - T >= 0
			})
			.first()
	},
	getBottomVisibleElem: function(){
		var elems = this.filter('*')

		var p = elems.first().scrollParent()
		var S = p.scrollTop()
		var T = p.offset().top
		var H = p.height()

		if(S + H == p[0].scrollHeight){
			return elems.last()
		}

		return elems
			.filter(function(i, e){
				e = $(e)
				return e.offset().top + e.height() <= T + H
			})
			.last()
	},
	// NOTE: this will not give a number greater than the number of 
	// 		elements, thus for lists without scroll, this will always
	// 		return the number of elements.
	// XXX this will not count the elements at the top if they are 
	// 		disabled...
	getHeightInElems: function(){
		var t = this.getTopVisibleElem()
		var b = this.getBottomVisibleElem()

		var res = 1
		while(!t.is(b)){
			t = t.next()
			if(t.length == 0){
				break
			}
			res += 1
		}

		return res
	},

	// XXX there are two modes of doing page travel:
	// 		1) keep relative to page position
	// 		2) travel up on top element and down on bottom (curret)
	// 		...is this the natural choice?
	// XXX merge with .select(..)???
	// XXX still not too happy with this, item sizes will throw this
	// 		off...
	prevPage: function(){
		var t = this.getTopVisibleElem()
		var cur = this.select('!')

		// nothing selected...
		if(cur.length == 0 
				// element not near the top...
				// XXX make the delta configurable (see .select(..) 
				// 		for same issue)...
				|| cur.offset().top - t.offset().top > (3 * t.height())){
			// select top...
			this.select(t)

		// make the top bottom...
		} else {
			var p = t.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			// rough scroll...
			// XXX make the delta configurable (see .select(..) 
			// 		for same issue)...
			p.scrollTop(S - (H - 4 * t.height()))

			// select the element and fix scrolling errors...
			this.select(this.getTopVisibleElem())
		}

		return this
	},
	// XXX this is essentially identical to .prevPage(..)
	nextPage: function(){
		var b = this.getBottomVisibleElem()
		var cur = this.select('!')


		// nothing selected...
		if(cur.length == 0 
				// element not near the top...
				// XXX make the delta configurable (see .select(..) 
				// 		for same issue)...
				|| b.offset().top - cur.offset().top > (3 * b.height())){
			// select bottom...
			this.select(b)

		// make the top bottom...
		} else {
			var p = b.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			// rough scroll...
			// XXX make the delta configurable (see .select(..) 
			// 		for same issue)...
			p.scrollTop(S + (H - 4 * b.height()))

			// select the element and fix scrolling errors...
			this.select(this.getBottomVisibleElem())
		}

		return this
	},
	
	// Push an element to path / go down one level...
	//
	// This will trigger the 'push' event.
	//
	// NOTE: if the element is not traversable it will be opened.
	//
	// XXX might be a good idea to add a live traversable check...
	// XXX revise event...
	push: function(pattern){
		var browser = this.dom 
		var cur = this.select('!')
		var elem = this.select(!pattern ? '!'
				: /-?[0-9]+/.test(pattern) ? pattern
				// XXX avoid keywords that .select(..) understands...
				//: '"'+pattern+'"' )
				: pattern)

		// item not found...
		if(elem.length == 0 && pattern != null){
			return this
		}

		// nothing selected, select first and exit...
		if(cur.length == 0 && elem.length == 0){
			this.select()
			return this
		}

		// if not traversable call the action...
		if(!this.traversable || elem.hasClass('not-traversable')){
			return this.action()
		}

		var path = this.path
		// XXX do we need qotes here???
		//path.push('"'+ elem.find('.text').text() +'"')
		path.push(elem.find('.text').text())

		// XXX should this be before or after the actual path update???
		// XXX can we cancel the update from a handler???
		this.trigger('push', path)

		// do the actual traverse...
		this.path = path

		this.select()

		return this
	},

	// Pop an element off the path / go up one level...
	//
	// This will trigger the 'pop' event.
	//
	// XXX revise event...
	pop: function(){
		var that = this
		var browser = this.dom

		if(!this.traversable){
			return this
		}

		var path = this.path
		var dir = path.pop()

		// XXX should this be before or after the actual path update???
		// XXX can we cancel the update from a handler???
		this
			.trigger('pop', path)
			.update(path)
				.done(function(){
					that.select('"'+dir+'"')
				})

		return this
	},

	// Pre-open action...
	//
	// This opens (.open(..)) the selected item and if none are selected
	// selects the default (.select()) and exits.
	action: function(){
		var elem = this.select('!')

		// nothing selected, select first and exit...
		if(elem.length == 0){
			this.select()
			return this
		}

		var path = this.path

		//path.push(quoteWS(elem.find('.text').text()))
		//path.push('"'+ elem.find('.text').text() +'"')
		path.push(elem.find('.text').text())

		var res = this.open(path)

		return res
	},


	// Extension methods...
	// ...these are resolved from .options

	// Open action...
	//
	// 	Open current element...
	// 	NOTE: if no element selected this will do nothing.
	// 	NOTE: this will return the return of .options.open(..) or the 
	// 		full path if null is returned...
	// 	.open()
	// 		-> this
	// 		-> object
	//
	// 	Open a path...
	// 	.open(<path>)
	// 		-> this
	// 		-> object
	//
	// 	Register an open event handler...
	// 	.open(<function>)
	// 		-> this
	//
	//
	// The following signatures are relative from current context via 
	// .select(..), see it for more details...
	// NOTE: this will also select the opened element, so to get the full
	// 		path from the handler just get the current path and value:
	// 			browser.dom.attr('path') +'/'+ browser.dom.attr('value')
	// 		or:
	// 			browser.selectionPath
	//
	// 	Open first/last element...
	// 	.open('first')
	// 	.open('last')
	// 		-> this
	//
	// 	Open next/prev element...
	// 	.open('next')
	// 	.open('prev')
	// 		-> this
	//
	// 	Open active element at index...
	// 	.open(<number>)
	// 		-> this
	//
	// 	Open element by absolute index...
	// 	.open('<number>!')
	// 		-> this
	//
	// 	Open element by full or partial text...
	//	.open('<text>')
	//	.open("'<text>'")
	//	.open('"<text>"')
	// 		-> this
	//
	//	Open first element matching a regexp...
	//	.open(<regexp>)
	// 		-> this
	//
	//	Open an element explicitly...
	//	.open(<elem>)
	// 		-> this
	//
	//
	// This will trigger the 'open' event on the opened element and the
	// widget.
	//
	// This is called when an element is selected and opened.
	//
	// By default this happens in the following situations:
	// 	- an element is selected and Enter is pressed.
	// 	- an element is not traversable and push (Left, click) is called.
	//
	// By default this only triggers the 'open' event on both the browser
	// and the selected element if one exists.
	//
	// This is signature compatible with .select(..) but adds support 
	// for full paths.
	//
	// The .options.open(..), if defined, will always get the full path 
	// as first argument.
	//
	// NOTE: if nothing is selected this will do nothing...
	// NOTE: internally this is never called directly, instead a pre-open
	// 		stage is used to execute default behavior not directly 
	// 		related to opening an item (see: .action()).
	// NOTE: unlike .list(..) this can be used directly if an item is 
	// 		selected and an actual open action is defined, either in an
	// 		instance or in .options
	open: function(path){ 
		// special case: register the open handler...
		if(typeof(path) == typeof(function(){})){
			return this.on('open', path)
		}

		var elem = this.select('!')

		// normalize and load path...
		if(path && (path.constructor == Array || /[\\\/]/.test(path))){
			path = this.path2list(path)
			var elem = path.slice(-1)[0]

			// only update path if it has changed...
			if(this.path.filter(function(e, i){ return e == path[i] }).length != path.length - 1){
				this.path = path.slice(0, -1)
			}

			elem = this.select('"'+ elem +'"')

		// get path + selection...
		} else {
			// select-compatible -- select from current context...	
			if(!path){
				// NOTE: this is select compatible thus no need to quote 
				// 		anything here...
				elem = this.select(path)
			}

			if(elem.length == 0){
				return this
			}

			path = this.path
			// NOTE: we are quoting here to get a explicit element 
			// 		selected from list...
			path.push('"'+ elem.find('.text').text() +'"')
		}

		// get the options method and call it if it exists...
		var m = this.options.open
		var args = args2array(arguments)
		args[0] = path
		var res = m ? m.apply(this, args) : this
		res = res || this

		// XXX do we strigify the path???
		// XXX should we use .strPath here???
		path = this.options.pathPrefix + path.join('/')

		// trigger the 'open' events...
		if(elem.length > 0){
			// NOTE: this will bubble up to the browser root...
			elem.trigger({
					type: 'open',
					source: this,
				}, path)

		} else {
			this.trigger('open', path)
		}

		return res
	},

	// List current path level...
	//
	// This will get passed a path and an item constructor and should 
	// return a list.
	//
	// NOTE: This is not intended for direct client use, rather it is 
	// 		designed to either be overloaded by the user in an instance 
	// 		or in the .options
	//		To re-list/re-load the view use .update()
	//
	//
	// There are two mods of operation:
	//
	// 1) interactive:
	// 		.list(path, make)
	// 			- for each item make is called with it's text
	//			- make will return a jQuery object of the item
	//
	// 		NOTE: selection is currently done based on .find('.text').text() thus the 
	// 			modification should not affect it's output...
	//
	// 2) non-interactive:
	// 		.list(path) -> list
	// 			- .list(..) should return an array
	// 			- make should never get called
	// 			- the returned list will be rendered
	//
	//
	// This can set the following classes on elements:
	//
	// 	.disabled
	// 		an element is disabled.
	//
	// 	.non-traversable
	// 		an element is not traversable/listable and will trigger the
	// 		.open(..) on push...
	//
	// XXX need a way to constructively communicate errors up...
	// XXX also need a load strategy when something bad happens...
	// 		...e.g. load up until the first error, or something like:
	// 			while(!this.list(path, make)){
	// 				path.pop()
	// 			}
	list: function(path, make){
		path = path || this.path
		var m = this.options.list
		return m ? m.apply(this, arguments) : []
	},

	// XXX need to get a container -- UI widget API....
	// XXX paste does not work on IE yet...
	// XXX handle copy...
	__init__: function(parent, options){
		var that = this

		object.superMethod(Browser, '__init__').call(this, parent, options)

		var dom = this.dom
		options = this.options

		// basic permanent interactions...
		dom.find('.path')
			// NOTE: these are used for full-path editing and are defined
			// 		here in contrast to other feature handlers as the
			// 		'.path' element is long-lived and not rewritten 
			// 		on .update(..)
			.dblclick(function(){
				that.startFullPathEdit()
			})
			.keyup(function(){
				var e = $(this)
				// clear the list on edit...
				if(e.attr('contenteditable') && e.text() != dom.attr('orig-path')){
					dom.find('.list').empty()
				}
			})
			/* XXX 
			// Handle copy/paste...
			//
			// Make the whole widget support copy/paste of current path.
			//
			// NOTE: on nw.js mode this will handle this via keyboard 
			// 		directly, skipping the events and their quirks...
			//
			// XXX does not work on IE yet...
			// XXX do we handle other types???
			// 		...try and get the path of anything, including files, dirs, etc...
			// XXX seems not to work until we cycle any of the editable
			// 		controls (filter/path), and then it still is on and 
			// 		off...
			// XXX does not work with ':not([contenteditable])' and kills
			// 		copy/paste on editable fields without...
			// XXX do we bother with these??
			.on('paste', ':not([contenteditable])', function(){
				event.preventDefault()
				that.paste()
			})
			// XXX does not work...
			.on('cut copy', function(){
				event.preventDefault()
				that.copy()
			})
			*/

		// attach to parent...
		if(parent != null){
			parent.append(dom)
		}

		// Select the default path...
		//
		// NOTE: this may not work when the dialog is loaded async...
		setTimeout(function(){ 
			// load the initial state...
			that.update(options.path || that.path || '/')

			// in case we have a manually selected item but that was 
			// not aligned...
			that.selected && that.select()
		}, 0)

	},
}


/*
// nw.js copy/paste handling...
//
// XXX not sure if we actually need these...
if(NW){
	// override copy...
	BrowserPrototype.keyboard.General.C = {
		ctrl: 'copy!',
	}
	BrowserPrototype.keyboard.General.X = 'C'

	// override paste...
	BrowserPrototype.keyboard.General.V = {
		ctrl: 'paste!',
	}
}
*/


var Browser = 
module.Browser = 
object.makeConstructor('Browser', 
		BrowserClassPrototype, 
		BrowserPrototype)


// inherit from widget...
Browser.prototype.__proto__ = widget.Widget.prototype



/*********************************************************************/

var ListerPrototype = Object.create(BrowserPrototype)
ListerPrototype.options = {
	pathPrefix: '', 
	fullPathEdit: false,
	traversable: false,
	flat: true,

	// XXX not sure if we need these...
	skipDisabledItems: false,
	// NOTE: to disable this set it to false or null
	disableItemPattern: '^- ',
}
// XXX should we inherit or copy options???
// 		...inheriting might pose problems with deleting values reverting
// 		them to default instead of nulling them and mutable options might
// 		get overwritten...
ListerPrototype.options.__proto__ = BrowserPrototype.options

var Lister = 
module.Lister = 
object.makeConstructor('Lister', 
		BrowserClassPrototype, 
		ListerPrototype)


// This is a shorthand for: new List(<elem>, { data: <list> })
var makeLister = 
module.makeLister = function(elem, lister, options){
	var opts = {}
	for(var k in options){
		opts[k] = options[k]
	}
	opts.list = lister
	return Lister(elem, opts)
}



/*********************************************************************/

// Flat list...
//
// This expects a data option set with the following format:
// 	{
// 		<option-text>: <callback>,
// 		...
// 	}
//
// or:
// 	[
// 		<option-text>,
// 		...
// 	]
//
// If <option-test> starts with a '- ' then it will be added disabled,
// to control the pattern use the .disableItemPattern option, and to 
// disable this feature set it to false|null.
// 	
// NOTE: this essentially a different default configuration of Browser...
var ListPrototype = Object.create(BrowserPrototype)
ListPrototype.options = {

	pathPrefix: '', 
	fullPathEdit: false,
	traversable: false,
	flat: true,

	// XXX not sure if we need these...
	skipDisabledItems: false,
	// NOTE: to disable this set it to false or null
	disableItemPattern: '^- ',

	list: function(path, make){
		var that = this
		var data = this.options.data
		var keys = data.constructor == Array ? data : Object.keys(data)
		var pattern = this.options.disableItemPattern 
			&& RegExp(this.options.disableItemPattern)

		return keys
			.map(function(k){
				var disable = null
				var n = k

				// XXX make this support list args as well...
				if(pattern){
					var t = typeof(n) == typeof('str') ? n : n[0]

					if(typeof(t) == typeof('str')){
						var tt = t.replace(pattern, '')
						if(t != tt){
							disable = true

							if(typeof(k) == typeof('str')){
								n = tt

							} else {
								// NOTE: here we want to avoid .data contamination
								// 		so we'll make a copy...
								n = n.slice()
								n[0] = tt
							}

							if(that.options.skipDisabledItems){
								return
							}
						}
					}
				}

				var e = make(n, null, disable)

				if(data !== keys && that.options.data[k] != null){
					e.on('open', function(){ 
						return that.options.data[k].apply(this, arguments)
					})
				}

				return k
			})
	},
}
// XXX should we inherit or copy options???
// 		...inheriting might pose problems with deleting values reverting
// 		them to default instead of nulling them and mutable options might
// 		get overwritten...
ListPrototype.options.__proto__ = BrowserPrototype.options

var List = 
module.List = 
object.makeConstructor('List', 
		BrowserClassPrototype, 
		ListPrototype)


// This is a shorthand for: new List(<elem>, { data: <list> })
var makeList = 
module.makeList = makeBrowserMaker(List)



/*********************************************************************/

// This is similar to List(..) but will parse paths in keys...
//
// Path grammar:
//
// 	PATH ::= [/]<dirs>				- simple traversable path
// 			| [/]<dirs>/<item>		- path with last item non-traversable
// 			| [/]<dirs>/*			- path to lister
//
// 	<dirs> ::= <item> 
// 			| <dirs>/<item>/
//
// 	<item> ::= <name>				- explicit path element 
// 			| <item>|<name>			- multiple path elements (a-la simlink)
//
// 	<name> ::= [^\|\\\/]*
//
// 	NOTE: <dirs> always ends with '/' or '\' and produces a set of 
// 		traversable items.
// 	NOTE: the last item is non-traversable iff:
// 		- it does not end with '/' or '\'
// 		- there is no other path defined where it is traversable
//
//
// Format:
// 	{
// 		// basic 'file' path...
// 		// NOTE: this path is non-traversable by default, but if a 
// 		//		sub-path handler is defined (e.g. 'dir/file/x') then this
// 		//		will be set traversable...
// 		'dir/file': function(evt, path){ .. },
//
// 		// file object at the tree root...
// 		// NOTE: the leading '/' is optional...
// 		'file': function(evt, path){ .. },
//
// 		// a directory handler is defined by path ending with '/', 
// 		// set traversable...
// 		'dir/dir/': function(evt, path){ .. },
//
// 		// add a file object to two dirs...
// 		'dir|other/other file': function(evt, path){ .. },
//
//		// path lister...
//		'dynamic/*': function(path, make){ .. }
// 	}
//
// The above definition will be interpreted into the following tree:
//
// 	/
// 		dir/
// 			file
// 			dir/
// 			other file
// 		file
// 		other/
// 			other file
// 		dynamic/
// 			..
//
// Here the contents of the '/dynamic/' path are generated by the matching 
// lister for that pattern path...
//
// NOTE: in the A|B|C pattern, ALL of the alternatives will be created.
// NOTE: there may be multiple matching patterns/listers or a given path
// 		the one used is the longest match.
// NOTE: if path is receded with '- ' ('- a|b/c') then the basename of 
// 		that path will be disabled, to control the pattern use
// 		.disableItemPattern and to disable this feature set it to false.
//
//
// Handler format:
// 	function(evt, path){ .. }
//
// 		This function will be called on the 'open' event for the defined 
// 		item.
//
//
// Lister format:
// 	function(path, make){ .. } -> list
//
//		This function will get called on .update(..) of the matching path.
//
//		make(text, traversable) is a list item constructor.
//		for more docs see: Browser.list(..)
//
//
// NOTE: listers take precedence over explicit path definitions, thus 
// 		if a custom lister pattern intersects with a normal path the path
// 		will be ignored and the lister called.
// NOTE: currently only trailing '*' are supported.
//
// XXX add support for '*' and '**' glob patterns...
var PathListPrototype = Object.create(BrowserPrototype)
PathListPrototype.options = {

	fullPathEdit: true,
	traversable: true,
	flat: false,

	// XXX not sure if we need these...
	skipDisabledItems: false,
	// NOTE: to disable this set it to false or null
	disableItemPattern: '^- ',

	list: function(path, make){
		var that = this
		var data = this.options.data
		var keys = data.constructor == Array ? data : Object.keys(data)
		var pattern = this.options.disableItemPattern 
			&& RegExp(this.options.disableItemPattern)

		if(pattern && this.options.skipDisabledItems){
			keys = keys.filter(function(k){ return !pattern.test(k) })
		}

		var visited = []

		// match path elements accounting for patterns...
		//
		// Supported patterns:
		// 	A		- matches A exactly
		// 	A|B		- matches either A or B
		var match = function(a, path){
			// NOTE: might be good to make this recursive when expanding
			// 		pattern support...
			return a
					.split('|')
					.filter(function(e){ 
						return e == path
					}).length > 0
		}

		// get the '*' listers...
		var lister = keys
			.filter(function(k){ 
				return k.trim().split(/[\\\/]+/g).pop() == '*' })
			.filter(function(k){
				k = k.split(/[\\\/]+/)
					// remove the trailing '*'...
					.slice(0, -1)

				// do the match...
				return k.length <= path.length 
					&& k.filter(function(e, i){ 
							return e != '*' && !match(e, path[i])
						}).length == 0 })
			.sort(function(a, b){ return a.length - b.length})
			.pop()

		// use the custom lister (defined by trailing '*')...
		if(data !== keys && lister){
			return data[lister].call(this, this.options.pathPrefix + path.join('/'), make)

		// list via provided paths...
		} else {
			return keys
				.map(function(k){
					var disable = null
					if(pattern){
						var n = k.replace(pattern, '')
						disable = n != k
						k = n
					}

					var kp = k.split(/[\\\/]+/g)
					kp[0] == '' && kp.shift()

					// see if we have a star...
					var star = kp.slice(-1)[0] == '*'
					star && kp.pop()

					// get and check current path, continue if relevant...
					var p = kp.splice(0, path.length)
					if(kp.length == 0 
							|| p.length < path.length
							|| p.filter(function(e, i){ return !match(e, path[i]) }).length > 0){
						return false
					}

					// get current path element if one exists and we did not create it already...
					cur = kp.shift()
					if(cur == undefined){
						return false
					}

					cur.split('|')
						// skip empty path items...
						// NOTE: this avoids creating empty items in cases
						// 		of paths ending with '/' or containing '//'
						.filter(function(e){ return e.trim() != '' })
						.forEach(function(cur){
							if(visited.indexOf(cur) >= 0){
								// set element to traversable if we visit it again...
								if(kp.length > 0){
									that.filter(cur, false)
										.removeClass('not-traversable')
										//.removeClass('disabled')
								}
								return false
							}
							visited.push(cur)

							// build the element....
							var e = make(cur,
								star || kp.length > 0, 
								// XXX this might still disable a dir...
								!star && kp.length == 0 && disable)

							// setup handlers...
							if(!star && data !== keys && kp.length == 0 && data[k] != null){
								e.on('open', function(){ 
									return that.options.data[k].apply(this, arguments)
								})
							}
						})

					return cur
				})
				.filter(function(e){ return e !== false })
		}
	},
}
// XXX should we inherit or copy options???
// 		...inheriting might pose problems with deleting values reverting
// 		them to default instead of nulling them and mutable options might
// 		get overwritten...
PathListPrototype.options.__proto__ = BrowserPrototype.options

var PathList = 
module.PathList = 
object.makeConstructor('PathList', 
		BrowserClassPrototype, 
		PathListPrototype)

var makePathList = 
module.makePathList = makeBrowserMaker(PathList)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
