/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// XXX add a hook to render the content of an element...
// XXX NOTE: the widget itself does not need a title, that's the job for
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


		if(options.path == null || options.show_path){
			browser
				.append($('<div>')
					   .addClass('v-block path'))
		}

		browser
			.append($('<div>')
				   .addClass('v-block list'))

		return browser
	},
}

// XXX Q: should we make a base list dialog and build this on that or
//		simplify this to implement a list (removing the path and disbling
//		traversal)??
// XXX need a search/filter field...
// XXX need base events:
//		- open
//		- update
//		- select (???)
// XXX add "current selection" to the path...
var BrowserPrototype = {
	dom: null,

	// option defaults and doc...
	//
	// XXX add enable/disable filter option...
	options: {
		//path: null,
		//show_path: null,

		// handle keys that are not bound...
		//
		// NOTE: to disable, set ot undefined.
		logKeys: function(k){ window.DEBUG && console.log(k) },
	},

	// XXX this should prevent event handler deligation...
	keyboard: {
		// filter mappings...
		Filter: {
			pattern: '.browse .path div.cur[contenteditable]',

			// keep text edeting action from affecting the seelction...
			ignore: [
					'Backspace',
					'Left',
					'Right',
					'Enter',
					'Esc',
				],

			Enter: 'action!',
			Esc: 'stopFilter!',
		},

		General: {
			pattern: '.browse',

			Up: 'prev',
			Backspace: 'Up',
			Down: 'next',
			Left: 'pop',
			Right: 'push',

			Enter: 'action',
			Esc: 'close',

			'/': 'startFilter!',
		},
	},

	// base api...
	// NOTE: to avoid duplicating and syncing data, the actual path is 
	//		stored in DOM...
	// XXX does the path includes the currently selected element?
	get path(){
		var skip = false
		return this.dom.find('.path .dir:not(.cur)')
			.map(function(i, e){ return $(e).text() })
			.toArray()
	},
	set path(value){
		// XXX normalize path...
		return this.update(value)
	},

	// update path...
	// 	- build the path
	// 	- build the element list
	//
	// XXX trigger an "update" event...
	// XXX current path click shoud make it editable and start a live 
	// 		search/filter...
	update: function(path){
		path = path || this.path
		var browser = this.dom
		var that = this

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
					that
						.update(cur.slice(0, -1)) 
						.select('"'+cur.pop()+'"')
				})
				.text(e))
		})

		// add current selction indicator...
		p.append($('<div>')
			.addClass('dir cur')
			// XXX add a filter mode...
			.click(function(){
				that.startFilter()
				//that.update(path.concat($(this).text())) 
			}))

		// fill the children list...
		this.list(path)
			.forEach(function(e){
				l.append($('<div>')
					.click(function(){
						if(!$(this).hasClass('disabled')){
							that.update(that.path.concat([$(this).text()])) 
						}
					})
					.text(e))
			})

		return this
	},

	// internal actions...

	// XXX pattern modes:
	// 		- lazy match
	// 			abc		-> *abc*		-> ^.*abc.*$
	// 			ab cd	-> *ab*cd*		-> ^.*ab.*cd.*$
	// 		- glob
	// 		- regex
	// XXX sort:
	// 		- as-is
	// 		- best match
	filter: function(pattern, non_matched, sort){
		var that = this
		var browser = this.dom

		// show all...
		if(pattern == null || pattern.trim() == '*'){
			browser.find('.filtered-out')
				.removeClass('filtered-out')
			// clear the highlighing...
			browser.find('.list b')
				.replaceWith(function() { return this.innerHTML })

		// basic filter...
		} else {
			var l = browser.find('.list>div:not(disabled)')

			l.each(function(i, e){
				e = $(e)
				var t = e.text()
				var i = t.search(pattern)
				if(i < 0){
					e
						.addClass('filtered-out')
						.removeClass('selected')

				} else {
					e.html(t.replace(pattern, pattern.bold()))
						.removeClass('filtered-out')
				}
			})
		}

		return this
	},

	// XXX start search/filter...
	// 		- set content editable
	// 		- triger filterig on modified
	// 		- disable nav in favor of editing
	// 		- enter/blur to exit edit mode
	// 		- esc to cancel and reset
	// XXX BUG: when starting with '/' key the '/' gets appended to the
	// 		field...
	startFilter: function(){
		var range = document.createRange()
		var selection = window.getSelection()

		var that = this
		var e = this.dom.find('.path .dir.cur')
			.text('')
			.attr('contenteditable', true)
			.keyup(function(){
				that.filter($(this).text())
			})
			.focus()

		// place the cursor...
		range.setStart(e[0], 0)
		range.collapse(true)
		// XXX
		selection.removeAllRanges()
		selection.addRange(range)

		return this
	},
	stopFilter: function(){
		this.filter('*')
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
	//		-> elem
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
	//	.select(<elem>)
	//		-> elem
	//
	//	.select(<elem>)
	//		-> elem
	//
	// This will return a jQuery object.
	//
	// NOTE: if multiple matches occur this will select the first.
	//
	//
	// XXX revise return values...
	// XXX Q: should this trigger a "select" event???
	// XXX on string/regexp mismatch this will select the first, is this correct???
	select: function(elem, filtering){
		var pattern = '.list div:not(.disabled):not(.filtered-out)'
		var browser = this.dom
		var elems = browser.find(pattern)

		filtering = filtering == null ? this.filtering : filtering

		if(elems.length == 0){
			return $()
		}

		elem = elem == 0 ? 'first' : elem
		elem = elem || this.select('!')
		// if none selected get the first...
		elem = elem.length == 0 ? 'first' : elem

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
			return elems
				.filter('.selected')
				.removeClass('selected')

		// strict...
		} else if(elem == '!'){
			return elems.filter('.selected')

		// number...
		// NOTE: on overflow this will get the first/last element...
		} else if(typeof(elem) == typeof(123)){
			return this.select($(elems.slice(elem)[0] || elems.slice(-1)[0] ), filtering)

		// string...
		// XXX on mismatch this will select the first, is this correct???
		} else if(typeof(elem) == typeof('str')){
			if(/^'.*'$|^".*"$/.test(elem.trim())){
				elem = elem.trim().slice(1, -1)
			}
			return this.select(browser.find(pattern)
					.filter(function(i, e){
						return $(e).text() == elem
					}), filtering)

		// regexp...
		// XXX on mismatch this will select the first, is this correct???
		} else if(elem.constructor === RegExp){
			return this.select(browser.find(pattern)
					.filter(function(i, e){
						return elem.test($(e).text())
					}), filtering)

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
		if(this.isTraversable != null 
				&& (this.isTraversable !== false
					|| ! this.isTraversable(path))){
			return this.action(path)
		}

		this.path = path

		this.select()

		return this
	},
	// Pop an element off the path / go up one level...
	pop: function(){
		var browser = this.dom
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
	// XXX this is wrong...
	// 		...need to actually open something...
	open: function(path){ 
		path = path || this.path
		var m = this.options.list
		return m ? m.call(this, path) : path
	},
	list: function(path){
		path = path || this.path
		var m = this.options.list
		return m ? m.call(this, path) : []
	},
	isTraversable: null,

	// XXX need to get a container....
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
		this.update(this.path)
	},
}


/*
var Browser = 
//module.Browser = 
object.makeConstructor('Browser', 
		BrowserClassPrototype, 
		BrowserPrototype)
*/






/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
