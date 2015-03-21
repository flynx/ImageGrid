/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

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
//		- opne
//		- update
//		- select (???)
// XXX add "current selection" to the path...
var BrowserPrototype = {
	dom: null,

	options: {
		//path: null,
		//show_path: null,
	},

	// XXX this should prevent event handler deligation...
	keyboard: {
		'.browse':{
			Up: 'prev',
			Backspace: 'Up',
			Down: 'next',
			Left: 'pop',
			Right: 'push',

			Enter: 'action',
			Esc: 'close',
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
		console.log('!!!', value)
		// XXX normalize path...
		return this.update(value)
	},

	// update path...
	// XXX trigger an "update" event...
	update: function(path){
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
			.click(function(){
				that
					.update(path.concat($(this).text())) 
			}))

		// fill the children list...
		this.list(path)
			.forEach(function(e){
				l.append($('<div>')
					.click(function(){
						that.update(that.path.concat([$(this).text()])) 
					})
					.text(e))
			})

		return this
	},

	// internal actions...

	// Select a list element...
	//
	//	Select first/last child
	//	.select('first')
	//	.select('last')
	//		-> elem
	//
	//	Select previous/lext child
	//	.select('prev')
	//	.select('next')
	//		-> elem
	//
	//	Deselect
	//	.select('none')
	//		-> elem
	//
	//	Get selected element if it exists, null otherwise...
	//	.select('!')
	//		-> elem
	//		-> $()
	//
	//	Select element by sequence number
	//	.select(<number>)
	//		-> elem
	//
	//	Select element by its text...
	//	.select('"<text>"')
	//		-> elem
	//
	//	.select(<elem>)
	//		-> elem
	//
	// This will return a jQuery object.
	//
	//
	// XXX revise return values...
	// XXX Q: should this trigger a "select" event???
	select: function(elem){
		var browser = this.dom
		var elems = browser.find('.list div')

		if(elems.length == 0){
			return $()
		}

		elem = elem || this.select('!')
		// if none selected get the first...
		elem = elem.length == 0 ? 'first' : elem

		// first/last...
		if(elem == 'first' || elem == 'last'){
			return this.select(elems[elem]())
		
		// prev/next...
		} else if(elem == 'prev' || elem == 'next'){
			var to = this.select('!', browser)[elem]('.list div')
			if(to.length == 0){
				return this.select(elem == 'prev' ? 'last' : 'first', browser)
			}
			this.select('none')
			return this.select(to)

		// deselect...
		} else if(elem == 'none'){
			return elems
				.filter('.selected')
				.removeClass('selected')

		// strict...
		} else if(elem == '!'){
			return elems.filter('.selected')

		// number...
		} else if(typeof(elem) == typeof(123)){
			return this.select($(elems[elem]))

		// string...
		} else if(typeof(elem) == typeof('str') 
				&& /^'.*'$|^".*"$/.test(elem.trim())){
			elem = elem.trim().slice(1, -1)
			return this.select(browser.find('.list div')
					.filter(function(i, e){
						return $(e).text() == elem
					}))

		// element...
		} else {
			this.select('none')
			browser.find('.path .dir.cur').text(elem.text())
			return elem.addClass('selected')
		}
	},

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
	// pop an element off the path / go up one level...
	pop: function(){
		var browser = this.dom
		var path = this.path
		var dir = path.pop()

		this.update(path)

		this.select('"'+dir+'"')

		return this
	},
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

		var path = this.path.push(elem.text())

		var res = this.open(path)

		return res
	},

	// extension methods...
	open: function(path){ 
		var m = this.options.list
		return m ? m.call(this, path) : path
	},
	list: function(path){
		var m = this.options.list
		return m ? m.call(this, path) : path
	},
	isTraversable: null,

	// XXX need to get a container....
	// XXX prepare/merge options...
	// XXX setup instance events...
	__init__: function(parent, options){
		// XXX merge options...
		// XXX
		this.options = options

		// build the dom...
		var dom = this.dom = this.constructor.make(options)

		// add keyboard handler...
		dom.keydown(
			keyboard.makeKeyboardHandler(
				this.keyboard,
				// XXX
				function(k){ window.DEBUG && console.log(k) },
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
