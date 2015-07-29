/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

if(typeof(module) !== 'undefined' && module.exports){
	var NW = true
	var gui = require('nw.gui')

} else {
	var NW = false
}


define(function(require){ var module = {}


var object = require('../object')



/*********************************************************************/
// helpers...

function proxyToDom(name){
	return function(){ 
		this.dom[name].apply(this.dom, arguments)
		return this 
	}
}



/*********************************************************************/

// NOTE: the widget itself does not need a title, that's the job for
//		a container widget (dialog, field, ...)
//		...it can be implemented trivially via an attribute and a :before
//		CSS class...
var BrowserClassPrototype = {
	// construct the dom...
	make: function(options){
		var browser = $('<div>')
			.addClass('browse')
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
var BrowserPrototype = {
	dom: null,

	// option defaults and doc...
	options: {
		// Initial path...
		//path: null,

		//show_path: true,

		// Enable/disable user selection filtering...
		// NOTE: this only affects starting the filter...
		filter: true,

		// Enable/disable full path editing...
		// NOTE: as with .filter above, this only affects .startFullPathEdit(..)
		fullPathEdit: true,

		// If false will disable traversal...
		// NOTE: if false this will also disable traversal up.
		// NOTE: this will not disable manual updates or explicit path 
		// 		setting.
		// NOTE: another way to disable traversal is to set 
		// 		.not-traversable on the .browse element
		traversable: true,

		// Handle keys that are not bound...
		// NOTE: to disable, set ot undefined.
		logKeys: function(k){ window.DEBUG && console.log(k) },

		// If set disables leading and trailing '/' on list and path 
		// elements.
		// This is mainly used for flat list selectors.
		flat: false,

		// List of events that will not get propagated outside the browser...
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
		],
	},

	// XXX TEST: this should prevent event propagation...
	// XXX should we have things like ctrl-<number> for fast selection 
	// 		in filter mode???
	keyboard: {
		FullPathEdit: {
			pattern: '.browse .path[contenteditable]',

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

					// let the system handle copy paste...
					'C', 'V', 'X',

					// enter numbers as-is...
					'#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9',
				],

			Enter: 'stopFullPathEdit!',
			Esc: 'abortFullPathEdit!',
		},

		Filter: {
			pattern: '.browse .path div.cur[contenteditable]',

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
			pattern: '.browse',

			Up: 'prev!',
			Down: 'next!',
			Left: {
				default: 'pop!',
				ctrl: 'update!: "/"',
			},
			Backspace: 'Left',
			Right: 'push',

			Home: 'select!: "first"',
			End: 'select!: "last"',

			// XXX add page up and page down...
			// XXX

			Enter: 'action',
			Esc: 'close',

			'/': 'startFilter!',

			A: {
				ctrl: 'startFullPathEdit!',
			},

			// XXX should these be select???
			// XXX should these be relative to visible area or absolute 
			// 		to current list regardless of scroll (as is now)???
			// XXX should these work while filtering??
			'#1': 'push: "0!"',
			'#2': 'push: "1!"',
			'#3': 'push: "2!"',
			'#4': 'push: "3!"',
			'#5': 'push: "4!"',
			'#6': 'push: "5!"',
			'#7': 'push: "6!"',
			'#8': 'push: "7!"',
			'#9': 'push: "8!"',
		},
	},


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

	// Trigger jQuery events on Browser...
	//
	// This will pass the Browser instance to .source attribute of the
	// event object triggered.
	//
	// NOTE: event propagation for some events is disabled by binding 
	// 		to them handlers that stop propagation in .__init__(..).
	// 		The list of non-propagated events in defined in 
	// 		.options.nonPropagatedEvents
	trigger: function(){
		var args = args2array(arguments)
		var evt = args.shift()
		
		if(typeof(evt) == typeof('str')){
			evt = $.Event(evt)
		}

		evt.source = this

		args.splice(0, 0, evt)

		this.dom.trigger.apply(this.dom, args)
		return this 
	},

	// proxy event api...
	on: proxyToDom('on'),
	one: proxyToDom('one'),
	off: proxyToDom('off'),
	bind: proxyToDom('bind'),
	unbind: proxyToDom('unbind'),
	deligate: proxyToDom('deligate'),
	undeligate: proxyToDom('undeligate'),

	// specific events...
	focus: proxyToDom('focus'),
	blur: proxyToDom('blur'),


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
			.toArray()
	},
	set path(value){
		return this.update(value)
	},

	// String path...
	//
	// This is the same as .path but returns a string result.
	//
	// NOTE: this does not include the selected element, i.e. the returned 
	// 		path always ends with a trailing '/'.
	// NOTE: the setter is just a shorthand to .path setter for uniformity...
	get strPath(){
		return '/' + this.path.join('/') + '/'
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
		return this.strPath +'/'+ (this.selected || '')
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
		return e.text()
	},
	set selected(value){
		return this.select(value)
	},

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

	// update (load) path...
	// 	- build the path
	// 	- build the element list
	// 	- bind to control events
	//
	// This will trigger the 'update' event.
	//
	// For uniformity and ease of access from DOM, this will also set the
	// 'path' html attribute on the .browse element.
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
	// XXX need a way to handle path errors in the extension API...
	// 		...for example, if .list(..) can't list or lists a different
	// 		path due to an error, we need to be able to render the new
	// 		path both in the path and list sections...
	// 		NOTE: current behaviour is not wrong, it just not too flexible...
	update: function(path){
		path = path || this.path
		var browser = this.dom
		var that = this
		var focus = browser.find(':focus').length > 0

		// string path and terminated with '/' -- no selection...
		if(typeof(path) == typeof('str') && !/[\\\/]/.test(path.trim().slice(-1))){
			path = this.path2list(path)
			var selection = path.pop()

		} else {
			path = this.path2list(path)
			var selection = null
		}


		var p = browser.find('.path').empty()
		var l = browser.find('.list').empty()

		var c = []
		// fill the path field...
		path.forEach(function(e){
			c.push(e)
			var cur = c.slice()
			p.append($('<div>')
				.addClass('dir')
				.click(function(){
					if(that.traversable){
						that
							.update(cur.slice(0, -1)) 
							.select('"'+cur.pop()+'"')
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

		// fill the children list...
		var interactive = false

		var make = function(p){
			interactive = true
			return $('<div>')
				// handle clicks ONLY when not disabled...
				.click(function(){
					if(!$(this).hasClass('disabled')){
						that.push($(this).text()) 
					}
				})
				.text(p)
				.appendTo(l)
		}

		var res = this.list(path, make)

		if(!interactive){
			res.forEach(make)
		}

		this.dom.attr('path', this.strPath)
		this.trigger('update')

		// select the item...
		if(selection){
			this.select(selection)
		}

		// maintain focus within the widget...
		if(focus && browser.find(':focus').length == 0){
			this.focus()
		}

		return this
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
	// If <rejected-handler> function is passed it will get called with 
	// every element that was rejected by the predicate / not matching 
	// the pattern.
	//
	// By default, <ignore-disabled> is false, thus this will ignore 
	// disabled elements. If <ignore_disabled> is false then disabled 
	// elements will be searched too.
	//
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
	// NOTE: this will ignore items that are not visible.
	//
	// TODO need to support glob / nested patterns...
	// 		..things like /**/a*/*moo/ should list all matching items in
	// 		a single list.
	filter: function(pattern, a, b){
		pattern = pattern == null ? '*' : pattern
		var ignore_disabled = typeof(a) == typeof(true) ? a : b
		ignore_disabled = ignore_disabled == null ? true : ignore_disabled
		var rejected = typeof(a) == typeof(true) ? null : a

		var that = this
		var browser = this.dom

		var elems = browser.find('.list>div:visible' + (ignore_disabled ? ':not(.disabled)' : ''))

		if(pattern == '*'){
			return elems 
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
		} else if(pattern.constructor == RegExp){
			var filter = function(i, e){
				if(!pattern.test($(e).text())){
					if(rejected){
						rejected.call(e, i, e)
					}
					return false
				}
				return true
			}

		// string...
		// NOTE: this supports several space-separated patterns.
		// XXX support glob...
		} else if(typeof(pattern) == typeof('str')){
			var pl = pattern.trim().split(/\s+/)
			var filter = function(i, e){
				e = $(e)
				var t = e.text()
				for(var p=0; p < pl.length; p++){
					var i = t.search(pl[p])
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
	filterList: function(pattern){
		var that = this
		var browser = this.dom

		// show all...
		browser.find('.filtered-out')
			.removeClass('filtered-out')

		// clear match highlighting...
		if(pattern == null || pattern.trim() == '*'){
			// clear the highlighting...
			browser.find('.list b')
				.replaceWith(function() { return this.innerHTML })

		// basic filter...
		} else {
			var p = RegExp('(' + pattern.trim().split(/\s+/).join('|') + ')', 'g')
			this.filter(pattern,
					// rejected...
					function(i, e){
						e
							.addClass('filtered-out')
							.removeClass('selected')
					},
					// NOTE: setting this to true will not remove disabled
					// 		elements from view as they will neither get 
					// 		included in the filter not in the filtered out
					// 		thus it will require manual setting of the
					// 		.filtered-out class
					false)
				// NOTE: as .filter(..) ignores non visible elements including
				// 		filtered out stuff, we remove the class unconditionally
				// 		above and do not need to do it here...
				//// passed...
				//.removeClass('filtered-out')
				// NOTE: this will mess up (clear) any highlighting that was 
				// 		present before...
				.each(function(_, e){
					e = $(e)
					var t = e.text()
					e.html(t.replace(p, '<b>$1</b>'))
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
	toggleFilter: CSSClassToggler(
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
	//	Select first/last child
	//	.select('first')
	//	.select('last')
	//		-> elem
	//
	//	Select previous/next child
	//	.select('prev')
	//	.select('next')
	//		-> elem
	//
	//	Deselect
	//	.select('none')
	//		-> $()
	//
	//	Select element by sequence number
	//	NOTE: negative numbers count from the tail.
	//	NOTE: overflowing selects the first/last element.
	//	.select(<number>)
	//		-> elem
	//
	//	Select element by absolute sequence number
	//	This is the same as above but will count disabled elements...
	//	NOTE: this will not select unselectable (disabled) elements.
	//	.select('<number>!')
	//		-> elem
	//
	//	Select element by its full or partial text...
	//	NOTE: if text matches one of the reserved commands above use 
	//		quotes to escape it...
	//	.select('<text>')
	//	.select("'<text>'")
	//	.select('"<text>"')
	//		-> elem
	//
	//	Select element via a regular expression...
	//	.select(<regexp>)
	//		-> elem
	//		-> $()
	//
	//	Select jQuery object...
	//	.select(<elem>)
	//		-> elem
	//		-> $()
	//
	// This will return a jQuery object.
	//
	// This will trigger the 'select' or 'deselect' events.
	//
	// For uniformity and ease of access from DOM, this will also set 
	// the value attr on the .browse element.
	// NOTE: this is one way and setting the html attribute "value" will
	// 		not affect the selection, but changing the selection will 
	// 		overwrite the attribute.
	//
	// NOTE: if multiple matches occur this will select the first.
	// NOTE: 'none' will always return an empty jQuery object, to get 
	// 		the selection state before deselecting use .select('!')
	// NOTE: this uses .filter(..) for string and regexp matching...
	//
	// XXX should we unconditionally clear string quotes or can an item 
	// 		contain '"' or "'"?
	// 		...currently the outer quotes are cleared.
	select: function(elem, filtering){
		var browser = this.dom
		var pattern = '.list>div:not(.disabled):not(.filtered-out):visible'
		var elems = browser.find(pattern)

		if(elems.length == 0){
			return $()
		}

		filtering = filtering == null ? this.toggleFilter('?') == 'on' : filtering

		// empty list/string selects none...
		elem = elem != null && elem.length == 0 ? 'none' : elem
		// 0 or no args (null) selects first...
		elem = elem == 0 ? 'first' : elem
		// no args -> either we start with the selected or the first...
		if(elem == null){
			var cur = this.select('!')
			elem = cur.length == 0 ? 'first' : cur
		}

		// special case: absolute position...
		if(/\d+!/.test(elem)){
			elem = this.filter(parseInt(elem), false)

			if(elems.index(elem) < 0){
				return this.select('none')
			}

			return this.select(elem)
		}

		// first/last...
		if(elem == 'first' || elem == 'last'){
			return this.select(elems[elem](), filtering)
		
		// prev/next...
		} else if(elem == 'prev' || elem == 'next'){
			var to = this.select('!', filtering)[elem + 'All'](pattern).first()
			if(to.length == 0){
				return this.select(elem == 'prev' ? 'last' : 'first', filtering)
			}
			this.select('none', filtering)
			return this.select(to, filtering)

		// deselect...
		} else if(elem == 'none'){
			if(!filtering){
				browser.find('.path .dir.cur').empty()
			}
			elems = elems
				.filter('.selected')
				.removeClass('selected')
			this.trigger('deselect', elems)
			return $()

		// strict...
		} else if(elem == '!'){
			return elems.filter('.selected')

		// number...
		// NOTE: on overflow this will get the first/last element...
		} else if(typeof(elem) == typeof(123)){
			return this.select($(elems.slice(elem)[0] || elems.slice(-1)[0] ), filtering)

		// string...
		} else if(typeof(elem) == typeof('str')){
			// clear quotes...
			// XXX can an item contain '"' or "'"???
			if(/^'.*'$|^".*"$/.test(elem.trim())){
				elem = elem.trim().slice(1, -1)
			}
			return this.select(this.filter(elem).first(), filtering)

		// regexp...
		} else if(elem.constructor === RegExp){
			return this.select(this.filter(elem).first(), filtering)

		// element...
		} else {
			elem = $(elem).first()

			if(elem.length == 0){
				this.select(null, filtering)

			} else {
				// clear selection...
				this.select('none', filtering)
				if(!filtering){
					browser.find('.path .dir.cur').text(elem.text())
				}


				// handle scroll position...
				var p = elem.scrollParent()
				var S = p.scrollTop()
				var H = p.height()

				var h = elem.height()
				var t = elem.offset().top - p.offset().top

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
				browser.attr('value', elem.text())

				this.trigger('select', elem)

				return elem
			}
		}
	},

	// Select next/prev element...
	next: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.select('next')
		return this
	},
	prev: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.select('prev')
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
		var elem = this.select(pattern || '!')

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
		var txt = elem.text()
		path.push(elem.text())

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
		var browser = this.dom

		if(!this.traversable){
			return this
		}

		var path = this.path
		var dir = path.pop()

		// XXX should this be before or after the actual path update???
		// XXX can we cancel the update from a handler???
		this.trigger('pop', path)

		this.update(path)

		this.select('"'+dir+'"')

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

		path.push(elem.text())

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

		// get path + selection...
		if(!path){
			// nothing selected, select first and exit...
			if(elem.length == 0){
				//this.select()
				return this
			}

			// load the current path + selection...
			path = this.path
			path.push(elem.text())

		// normalize and load path...
		//} else {
		} else if(path.constructor == Array || /[\\\/]/.test(path)) {
			path = this.path2list(path)
			var elem = path.slice(-1)[0]
			this.path = path.slice(0, -1)
			elem = this.select(elem)

		// select-compatible -- select from current context...	
		// XXX this is semilar to the first branch, should we merge them???
		} else {
			elem = this.select(path)

			if(elem.length == 0){
				return this
			}

			path = this.path
			path.push(elem.text())
		}

		// get the options method and call it if it exists...
		var m = this.options.open
		var args = args2array(arguments)
		args[0] = path
		var res = m ? m.apply(this, args) : this
		res = res || this

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
	// 		NOTE: selection is currently done based on .text() thus the 
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
		options = options || {}

		// merge options...
		var opts = Object.create(this.options)
		Object.keys(options).forEach(function(n){ opts[n] = options[n] })
		options = this.options = opts

		// build the dom...
		var dom = this.dom = this.constructor.make(options)

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

		// add keyboard handler...
		dom.keydown(
			keyboard.makeKeyboardHandler(
				this.keyboard,
				options.logKeys,
				this))

		// attach to parent...
		if(parent != null){
			parent.append(dom)
		}

		// load the initial state...
		this.update(options.path || this.path || '/')

		if(this.options.nonPropagatedEvents != null){
			this.on(this.options.nonPropagatedEvents.join(''), 
				function(evt){ evt.stopPropagation() })
		}
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
// NOTE: this essentially a different default configuration of Browser...
var ListPrototype = Object.create(BrowserPrototype)
ListPrototype.options = {

	fullPathEdit: false,
	traversable: false,
	flat: true,

	list: function(path, make){
		var that = this
		var data = this.options.data
		var keys = data.constructor == Array ? data : Object.keys(data)
		return keys
			.map(function(k){
				var e = make(k)

				if(data !== keys){
					e.on('open', function(){ 
						return that.options.data[k].apply(this, arguments)
					})
				}

				return k
			})
	},
}
ListPrototype.options.__proto__ = BrowserPrototype.options

var List = 
module.List = 
object.makeConstructor('List', 
		BrowserClassPrototype, 
		ListPrototype)


// This is a shorthand for: new List(<elem>, { data: <list> })
var makeList = 
module.makeList = function(elem, list){
	return List(elem, { data: list })
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
