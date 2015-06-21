/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

define(function(require){ var module = {}


var object = require('../object')


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

// XXX need to handle long paths -- smart shortening or auto scroll...
// XXX Q: should we make a base list dialog and build this on that or
//		simplify this to implement a list (removing the path and disabling
//		traversal)??
// XXX need base events:
//		- open
//		- update
//		- select (???)
var BrowserPrototype = {
	dom: null,

	// option defaults and doc...
	options: {
		// Initial path...
		//path: null,

		//show_path: true,

		// Enable/disable user selection filtering...
		// NOTE: this only affects .stopFilter(..)
		filter: true,

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
	},

	// XXX TEST: this should prevent event handler delegation...
	keyboard: {
		// filter mappings...
		Filter: {
			pattern: '.browse .path div.cur[contenteditable]',

			// keep text editing action from affecting the seelction...
			ignore: [
					'Backspace',
					'Left',
					'Right',
					'Home',
					'End',
					'Enter',
					'Esc',
					'/',
				],

			Enter: 'action!',
			Esc: 'stopFilter!',
		},

		General: {
			pattern: '.browse',

			Up: 'prev!',
			Backspace: 'Up',
			Down: 'next!',
			Left: 'pop',
			Right: 'push',

			Home: 'select!: "first"',
			End: 'select!: "last"',

			// XXX add page up and page down...
			// XXX
			// XXX ctrl-Left to go to root/base/home
			// XXX

			Enter: 'action',
			Esc: 'close',

			'/': 'startFilter!',
		},
	},

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

	// base api...
	// NOTE: to avoid duplicating and syncing data, the actual path is 
	//		stored in DOM...
	// NOTE: path does not include the currently selected list element,
	// 		just the path to the current list...
	get path(){
		var skip = false
		return this.dom.find('.path .dir:not(.cur)')
			.map(function(i, e){ return $(e).text() })
			.toArray()
	},
	set path(value){
		return this.update(value)
	},

	// update path...
	// 	- build the path
	// 	- build the element list
	// 	- bind to control events
	//
	// XXX do we normalize path here???
	// XXX need a way to handle path errors in the extension API...
	// 		...for example, if .list(..) can't list or lists a different
	// 		path due to an error, we need to be able to render the new
	// 		path both in the path and list sections...
	// 		NOTE: current behaviour is not wrong, it just not too flexible...
	// XXX trigger an "update" event...
	update: function(path){
		path = path || this.path
		var browser = this.dom
		var that = this

		// normalize path...
		// XXX is it correct to ignore empty path elements, e.g. 'aa//cc'?
		var splitter = /[\\\/]/
		if(typeof(path) == typeof('str') && splitter.test(path)){
			path = path
				.split(splitter)
				.filter(function(e){ return e != '' })
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
		p.append($('<div>')
			.addClass('dir cur')
			.click(function(){
				that.startFilter()
				//that.update(path.concat($(this).text())) 

				// XXX HACK: prevents the field from blurring when clicked...
				// 			...need to find a better way...
				that._hold_blur = true
				setTimeout(function(){ delete that._hold_blur }, 20)
			})
			// XXX for some reason this gets triggered when clicking ano 
			// 		is not triggered when entering via '/'
			.on('blur', function(){
				// XXX HACK: prevents the field from bluring when clicked...
				// 			...need to find a better way...
				if(!that._hold_blur){
					that.stopFilter()
				}
				//that.stopFilter()
			})
			.keyup(function(){
				that.showFiltered($(this).text())
			}))

		// fill the children list...
		var interactive = false

		var make = function(p){
			interactive = true
			return $('<div>')
				.click(function(){
					// handle clicks ONLY when not disabled...
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
	//
	//
	// TODO need to support glob / nested patterns...
	// 		..things like /**/a*/*moo/
	filter: function(pattern, a, b){
		pattern = pattern == null ? '*' : pattern
		var ignore_disabled = typeof(a) == typeof(true) ? a : b
		ignore_disabled = ignore_disabled == null ? true : ignore_disabled
		var rejected = typeof(a) == typeof(true) ? null : a

		var that = this
		var browser = this.dom

		var elems = browser.find('.list>div' + (ignore_disabled ? ':not(.disabled)' : ''))

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


	// internal actions...
	
	// NOTE: this uses .filter(..) for actual filtering...
	// XXX revise API -- seems a bit overcomplicated...
	showFiltered: function(pattern){
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
				// passed...
				.removeClass('filtered-out')
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
	// XXX should this be a toggler???
	startFilter: function(){
		if(this.options.filter){
			var range = document.createRange()
			var selection = window.getSelection()

			var that = this
			var e = this.dom.find('.path .dir.cur')
				.text('')
				.attr('contenteditable', true)
				.focus()

			// place the cursor...
			range.setStart(e[0], 0)
			range.collapse(true)
			selection.removeAllRanges()
			selection.addRange(range)
		}
		return this
	},
	stopFilter: function(){
		this.showFiltered('*')
		this.dom.find('.path .dir.cur')
			.text('')
			.removeAttr('contenteditable')
		this
			.focus()

		return this
	},
	get filtering(){
		return this.dom.find('.path .dir.cur[contenteditable]').length > 0 
	},
	toggleFilterMode: function(){
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

	// Select a list element...
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
	//	Select element by its text...
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
	// NOTE: if multiple matches occur this will select the first.
	// NOTE: 'none' will always return an empty jQuery object, to get 
	// 		the selection state before deselecting use .select('!')
	// NOTE: this uses .filter(..) for string and regexp matching...
	//
	//
	// XXX Q: should this trigger a "select" event???
	select: function(elem, filtering){
		var pattern = '.list div:not(.disabled):not(.filtered-out)'
		var browser = this.dom
		var elems = browser.find(pattern)

		filtering = filtering == null ? this.filtering : filtering

		if(elems.length == 0){
			return $()
		}

		// empty list/string selects none...
		elem = elem != null && elem.length == 0 ? 'none' : elem
		// 0 or no args (null) selects first...
		elem = elem == 0 ? 'first' : elem
		// no args -> either we start with the selected or the first...
		if(elem == null){
			var cur = this.select('!')
			elem = cur.length == 0 ? 'first' : cur
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
			elems
				.filter('.selected')
				.removeClass('selected')
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

				return elem.addClass('selected')
			}
		}
	},

	// Select next element...
	next: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.select('next')
		return this
	},
	// Select previous element...
	prev: function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.select('prev')
		return this
	},

	// Push an element to path / go down one level...
	push: function(elem){
		var browser = this.dom 
		var elem = this.select(elem || '!')

		// nothing selected, select first and exit...
		if(elem.length == 0){
			this.select()
			return this
		}

		var path = this.path
		path.push(elem.text())

		// if not traversable call the action...
		if(!this.traversable || elem.hasClass('not-traversable')){
			return this.action(path)
		}

		this.path = path

		this.select()

		return this
	},
	// Pop an element off the path / go up one level...
	pop: function(){
		var browser = this.dom

		if(!this.traversable){
			return this
		}

		var path = this.path
		var dir = path.pop()

		this.update(path)

		this.select('"'+dir+'"')

		return this
	},

	focus: function(){
		this.dom.focus()
		return this
	},

	// XXX think about the API...
	// XXX trigger an "open" event...
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

	// extension methods...

	// Open action...
	//
	open: function(path){ 
		path = path || this.path
		var m = this.options.open
		return m ? m.apply(this, arguments) : path
	},

	// List the path...
	//
	// This will get passed a path and an item constructor and should 
	// return a list.
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
	// 			- .list(..) should return a list
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
	// 		.action(..) on push...
	list: function(path, make){
		path = path || this.path
		var m = this.options.list
		return m ? m.apply(this, arguments) : []
	},

	// XXX need to get a container -- UI widget API....
	// XXX setup instance events...
	__init__: function(parent, options){
		options = options || {}

		// merge options...
		var opts = Object.create(this.options)
		Object.keys(options).forEach(function(n){ opts[n] = options[n] })
		options = this.options = opts

		// build the dom...
		var dom = this.dom = this.constructor.make(options)

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
		// XXX check if this default is correct...
		this.update(options.path || this.path)
	},
}


var Browser = 
module.Browser = 
object.makeConstructor('Browser', 
		BrowserClassPrototype, 
		BrowserPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
