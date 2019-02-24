/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('../toggler')
var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')



/*********************************************************************/
// Helpers...

// Collect a list of literal values and "make(..) calls" into an array...
//
//	collectItems(context, items)
//		-> values
//
//
// items format:
// 	[
// 		// explicit value...
// 		value,
//
// 		// literal make call...
// 		make(..),
//
// 		...
// 	]
//
// NOTE: this will remove the made via make(..) items from .items thus the
// 		caller is responsible for adding them back...
// NOTE: this uses the make(..) return value to implicitly infer the items
// 		to collect, thus the items must already be constructed and in 
// 		the same order as they are present in .items
// 		...also, considering that this implicitly identifies the items 
// 		passing the make function without calling it can trick the system
// 		and lead to unexpected results.
//
// XXX would be nice to have a better check/test...
// 		...this could be done by chaining instances of make instead of 
// 		returning an actual function, i.e. each make call would return 
// 		a "new" function that would reference the actual item (.item())
// 		and the previous item created (.prevItem()), ... etc.
// 		...this would enable us to uniquely identify the actual items 
// 		and prevent allot of specific errors...
var collectItems = function(context, items){
	var made = items
		.filter(function(e){
			return e === context })
	// constructed item list...
	// ...remove each instance from .items
	made = context.items.splice(
		context.items.length - made.length, 
		made.length)
	// get the actual item values...
	return items
		.map(function(e){
			return e === context ?
				made.shift()
				: e }) }



//---------------------------------------------------------------------
// XXX general design:
// 		- each of these can take either a value or a function (constructor)
//		- the function has access to Items.* and context
//		- the constructor can be called from two contexts:
//			- external
//				called from the module or as a function...
//				calls the passed constructor (passing context)
//				builds the container
//			- nested
//				called from constructor function...
//				calls constructor (if applicable)
//				builds item(s)
// XXX need a way to pass container constructors (a-la ui-widgets dialog containers)
// 		- passing through the context (this) makes this more flexible...
// 		- passing via args fixes the signature which is a good thing...
//		
//

// XXX
// XXX can't use Object.assign(..) here as it will not copy props...
var Items = module.items = function(){}


// placeholders...
Items.dialog = null
Items.items = null


// Last item created...
// XXX not sure about this...
// XXX should this be a prop???
Items.last = function(){
	return (this.items || [])[this.items.length - 1] }


// Focus last created item...
Items.focus = function(){
	this.last().current = true }




// Group a set of items...
//
//	.group(make(..), ..)
//	.group([make(..), ..])
//		-> make
//
//
// Example:
// 	make.group(
// 		make('made item'),
// 		'literal item',
// 		...)
//
//
// NOTE: see notes to collectItems(..) for more info...
//
// XXX do we need to pass options to groups???
Items.group = function(...items){
	var that = this
	items = items.length == 1 && items[0] instanceof Array ?
		items[0]
		: items
	// replace the items with the group...
	this.items.splice(this.items.length, 0, ...collectItems(this, items))
	return this
}


// Place list in a sub-list of item...
//
Items.nest = function(item, list, options){
	options = options || {}
	options.sublist = list instanceof Array ?
		collectItems(this, list)
		: list
	return this(item, options)
}



//---------------------------------------------------------------------
// wrappers...

Items.Item = function(value, options){}
Items.Action = function(value, options){}
Items.Heading = function(value, options){}
Items.Empty = function(value){}
Items.Separator = function(value){}
Items.Spinner = function(value){}
Items.Selected = function(value){}
Items.Editable = function(value){}
Items.ConfirmAction = function(value){}

// lists...
Items.List = function(values){}
Items.EditableList = function(values){}
Items.EditablePinnedList = function(values){}

// Special list components...
Items.ListPath = function(){}
Items.ListTitle = function(){}



//---------------------------------------------------------------------

var makeEventMethod = function(event, handler){
	return function(item){
		if(item instanceof Function){
			return this.on(event, item) 
		}

		// XXX handle more of the API???
		handler.call(this, ...arguments)

		return this
	}
}

var BaseBrowserClassPrototype = {
}

// XXX need a way to identify items...
var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: null,

	//
	// Format:
	// 	[
	// 		<item> | <browser>,
	// 		...
	// 	]
	//
	// <item> format:
	// 	{
	// 		value: ...,
	//
	// 		...
	// 	}
	//
	// NOTE: this can't be a map/dict as we need both order manipulation 
	// 		and nested structures which would overcomplicate things, as 
	// 		a compromise we use .item_index blow for item identification.
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items },
	set items(value){
		this.__items = value },

	//
	// Format:
	// 	{
	// 		<key>: <item>,
	// 		...
	// 	}
	//
	// XXX need to maintain this over item add/remove/change...
	// XXX Q: should we be able to add/remove/change items outside of .__list__(..)???
	// 		...only some item updates (how .collapsed is handled) make 
	// 		sense at this time -- need to think about this more 
	// 		carefully + strictly document the result...
	item_index: null,


	// Item list constructor...
	//
	// 	.__list__(make, options)
	// 		-> undefined
	// 		-> list
	//
	//
	// 	Item constructor:
	// 		make(value)
	// 		make(value, options)
	// 			-> make
	//
	//
	// There are two modes of operation:
	// 	1) call make(..) to create items
	// 	2) return a list of items
	//
	//
	// The if make(..) is called at least once the return value is 
	// ignored (mode #1), otherwise, the returned list is used as the 
	// .items structure.
	//
	//
	// When calling make(..) (mode #1) the item is built by combining 
	// the following in order:
	// 	- original item (.items[key]) if present,
	// 	- options passed to .make(<options>) method calling .__list__(..),
	// 	- options passed to make(.., <options>) constructing the item,
	// 	- {value: <value>} where <value> passed to make(<value>, ..)
	//
	// Each of the above will override values of the previous sections.
	//
	// The resulting item is stored in:
	// 	.items
	// 	.item_index (keyed via .id or JSONified .value)
	//
	// Each of the above structures is reset on each call to .make(..)
	//
	// Example:
	// 	XXX
	//
	//
	// In mode #2 XXX
	//
	//
	// NOTE: this is not designed to be called directly...
	__list__: function(make, options){
		throw new Error('.__list__(..): Not implemented.') },


	// Make .items...
	//
	// 	.make()
	// 	.make(options)
	// 		-> this
	//
	// The items are constructed by passing a make function to .__list__(..)
	// which in turn will call this make(..) per item created.
	//
	// For more doc on item construction see: .__init__(..)
	//
	//
	// NOTE: each call to this will reset both .items and .item_index
	//
	// XXX revise options handling for .__list__(..)
	make: function(options){
		var items = this.items = []
		var old_index = this.item_index || {}
		var new_index = this.item_index = {} 

		// item constructor...
		//
		// 	make(value[, options])
		// 	make(value, func[, options])
		// 		-> make
		//
		var make_called = false
		var make = function(value, opts){
			make_called = true
			var args = [...arguments]

			opts = opts || {}
			// handle: make(.., func, ..)
			opts = opts instanceof Function ?
				{open: opts}
				: opts
			// handle trailing options...
			opts = args.length > 2 ?
				Object.assign({},
					args.pop(),
					opts)
				: opts

			// item id...
			// XXX do a better id...
			// XXX should these include the path???
			var key = opts.id 
				// value is a browser -> generate an unique id...
				// XXX identify via structure...
				|| (value instanceof Browser 
					&& Date.now())
				|| JSON.stringify(value)

			// no duplicate keys...
			if(key in new_index){
				throw new Error(`make(..): duplicate key "${key}": `
					+`can't create multiple items with the same key.`) }

			// build the item...
			var item = Object.assign({}, 
				// get the old item values...
				old_index[key] || {},
				options || {},
				opts, 
				{value: value})

			// store the item...
			items.push(item)
			new_index[key] = item

			return make
		}.bind(this)
		make.__proto__ = Items
		make.dialog = this
		make.items = items

		//var res = this.__list__(make)
		// XXX not sure about this -- options handling...
		var res = this.__list__(make, 
			options ? 
				Object.assign(
					Object.create(this.options || {}), 
					options || {}) 
				: null)

		// if make was not called use the .__list__(..) return value...
		this.items = make_called ? 
			this.items 
			: res

		return this
	},


	// Renderers...
	//
	// 	.renderList(items, context)
	// 	.renderNested(header, sublist, item, context)
	// 	.renderNestedHeader(item, i, context)
	// 	.renderItem(item, i, context)
	// 	.renderGroup(items, context)
	//
	//
	renderList: function(items, context){
		return items },
	// NOTE: to skip rendering an item/list return null...
	// XXX should this take an empty sublist???
	// 		...this would make it simpler to expand/collapse without 
	// 		re-rendering the whole list...
	renderNested: function(header, sublist, item, context){
		return header ? 
			this.renderGroup([
				header, 
				sublist,
			])
   			: sublist },
	renderNestedHeader: function(item, i, context){
		return this.renderItem(item, i, context) },
	// NOTE: to skip rendering an item/list return null...
	renderItem: function(item, i, context){
		return item },
	renderGroup: function(items, context){
		return items },

	// Render state...
	//
	//	.render()
	//	.render(options)
	//	.render(context)
	//		-> state
	//
	//
	// context format:
	// 	{
	// 		root: <root-browser>,
	// 		options: <options>,
	// 	}
	//
	//
	// NOTE: currently options and context are distinguished only via 
	// 		the .options attribute...
	render: function(options){
		var that = this
		// XXX Q: should options and context be distinguished only via 
		// 		the .options attr as is the case now???
		var context = (options == null || options.options == null) ?
				{
					root: this,
					// NOTE: we are not combining this with .options as nested 
					// 		lists can have their own unique sets of options 
					// 		independently of the root list...
					options: options || this.options || {},
				}
			: options
		options = context.options

		// render the items...
		var _render
		// XXX should we control render parameters (range, start, end, ...)
		// 		from outside render and pass this info down to nested lists???
		// 		...if yes how??
		// 			- options
		// 			- arg threading
		var items = this.items
			.map(_render = function(item, i){
				return (
					// group...
					item instanceof Array ?
						that.renderGroup(
							item.map(_render), context)
					// renderable item...
					: item.render instanceof Function ?
						item.render(context) 
					// renderable value -- embedded list...
					: (item.value || {}).render instanceof Function ?
						item.value.render(context) 
					// .sublist -- nested list...
					: item.sublist ?
						that.renderNested(
							that.renderNestedHeader(item, i, context),
							// collapsed...
							(item.collapsed ?
									null
							// renderable...
							:item.sublist.render instanceof Function ?
								item.sublist.render(context)
							// list of items...
							: item.sublist.map(_render)),
							item, 
							context)
					// basic item...
					: that.renderItem(item, i, context)) }) 
			.filter(function(e){
				return e != null })

		// determine the render mode...
		return context.root === this ?
			// root context -> render list and return this...
			this.renderList(items, context)
			// non-root context -> return items as-is...
			// XXX should this be a list of the return value of a 
			// 		renderer like .renderNested(..) ???
			: items
	},


	// Update state (make then render)...
	//
	// 	.update()
	// 		-> state
	//
	//
	// XXX options here are a relatively blunt means of overriding options
	// 		in the tree...
	// 		...do we need this???
	update: function(options){
		return this
			.make(options)
			.render(options) },


	// XXX item API...
	get: function(){},
	set: function(){},
	remove: function(){},
	sort: function(){},
	splice: function(){},

	// XXX should these be defined on this level or should we use DOM???
	on: function(evt, handler){
		return this
	},
	one: function(evt, handler){
		return this
	},
	off: function(evt, handler){
		return this
	},
	trigger: function(evt, ...args){
		return this
	},

	// events / actions...
	focus: makeEventMethod('focus', function(item){
		// XXX exclusively set item.focus...
	}),
	select: makeEventMethod('select', function(item){
		// XXX set item.selected...
	},
	open: makeEventMethod('open', function(item){}),
	enter: makeEventMethod('enter', function(item){}),
	// XXX can we unify these???
	collapse: makeEventMethod('collapse', function(item){}),
	expand: makeEventMethod('expand', function(item){}),
	// XXX target can be item or path...
	load: makeEventMethod('load', function(item){}),
	close: makeEventMethod('close', function(reason){}),
	
	// XXX should there return an array or a .constructor(..) instance??
	forEach: function(){},
	map: function(){},
	filter: function(){},
	reduce: function(){},


	// XXX should we update on on init....
	__init__: function(func, options){
		this.__list__ = func
		this.options = Object.assign(
			{}, 
			this.options || {}, 
			options || {})

		// XXX should this be here or should this be optional???
		//this.update()
	},
}


var BaseBrowser = 
module.BaseBrowser = 
object.makeConstructor('BaseBrowser', 
		BaseBrowserClassPrototype, 
		BaseBrowserPrototype)



//---------------------------------------------------------------------

var BrowserClassPrototype = {
	__proto__: BaseBrowser,
}

// XXX TODO:
// 		- need a way to update some stuff on .update() / .make() -- a way 
// 			to selectively merge the old state with the new...
// 		- event handler signature -- pass the item + optionally render...
// 		- keyboard handling...
// XXX render of nested lists does not affect the parent list(s)...
// 		...need to render lists and items both as a whole or independently...
// XXX should this use vanilla DOM or jQuery???
var BrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
		hideListHeader: false,

		renderHidden: false,

		localEvents: [
			// XXX STUB???
			'click',

			// XXX keyboard stuff...
			// XXX

			// XXX custom events...
			// XXX
		],
		//buttonLocalEvents: [
		//],

		// Format:
		// 	[
		// 		['html', <handler>],
		// 		...
		// 	]
		itemButtons: [
		],
		// XXX need to mix these into the header only...
		headerItemButtons: [
		],
	},

	// parent element (optional)...
	get parent(){
		return this.__parent 
			|| (this.__dom ? 
				this.__dom.parentElement 
				: undefined) },
	set parent(value){
		var dom = this.dom
		this.__parent = value
		// transfer the dom to the new parent...
		dom && (this.dom = dom)
	},

	// browser dom...
	get dom(){
		return this.__dom },
	set dom(value){
		this.parent 
			&& (this.__dom ?
				this.parent.replaceChild(value, this.__dom) 
				: this.parent.appendChild(value))
		this.__dom = value },


	// Element renderers...
	//
	// Foramt:
	// 	<div class="browse-widget" tabindex="0">
	// 		<!-- header -->
	// 		...
	//
	// 		<!-- list -->
	// 		<div class="list v-block">
	// 			<!-- items -->
	// 			...
	// 		</div>
	// 	</div>
	//
	// XXX instrument interactions...
	// XXX register event handlers...
	renderList: function(items, context){
		var that = this
		var options = context.options || this.options

		// dialog (container)...
		var dialog = document.createElement('div')
		dialog.classList.add('browse-widget')
		dialog.setAttribute('tabindex', '0')

		// header...
		options.hideListHeader
			|| dialog.appendChild(this.renderListHeader(context))

		// list...
		var list = document.createElement('div')
		list.classList.add('list', 'v-block')
		items
			.forEach(function(item){
				list.appendChild(item instanceof Array ? 
					that.renderGroup(item) 
					: item) })
		dialog.appendChild(list)

		// XXX event handlers...
		// XXX

		return dialog 
	},
	//
	// Foramt:
	//	<div class="path v-block">
	//		<div class="dir" tabindex="0">dir</div>
	//		...
	//		<div class="dir cur" tabindex="0">dir</div>
	//	</div>
	// 	
	// XXX populate this...
	// XXX make this an item???
	renderListHeader: function(context){
		var header = document.createElement('div')
		header.classList.add('path', 'v-block')

		// XXX path/search...
		var dir = document.createElement('div')
		dir.classList.add('dir', 'cur')
		dir.setAttribute('tabindex', '0')
		header.appendChild(dir)

		return header
	},
	//
	// Format:
	// 	<div class="list">
	// 		<!-- header (optional) -->
	// 		...
	//
	// 		<!-- sublist (optional) -->
	// 		...
	// 	</div>
	//
	// XXX register event handlers...
	renderNested: function(header, sublist, item, context){
		var that = this
		var options = context.options || this.options

		// container...
		var e = document.createElement('div')
		e.classList.add('list')

		// localize events...
		var stopPropagation = function(evt){ evt.stopPropagation() }
		;(options.localEvents || [])
			.forEach(function(evt){
				e.addEventListener(evt, stopPropagation) })

		// header...
		header
			&& e.appendChild(header)

		// items...
		sublist instanceof Node ?
			e.appendChild(sublist)
		// XXX should this add the items to a container???
		: sublist instanceof Array ?
			sublist
				.forEach(function(item){
					e.appendChild(item) })
		: null

		// XXX event handlers... (???)
		// XXX

		item.dom = e

		return e
	},
	// NOTE: this is the similar to .renderItem(..)
	// XXX make collapse action overloadable....
	renderNestedHeader: function(item, i, context){
		var that = this
		return this.renderItem(item, i, context)
			// update dom...
			.run(function(){
				// class...
				// XXX should be done here or in the config???
				this.classList.add('sub-list-header')
				item.collapsed
					&& this.classList.add('collapsed')

				// collapse action handler...
				// XXX make this overloadable...
				$(this).on('open', function(evt){
					item.collapsed = !item.collapsed
					that.render(context)
				})
			}) },
	//
	// Format:
	// 	<div class="group">
	// 		..
	// 	</div>
	//
	// XXX this does not seem to get called by .render(..)...
	renderGroup: function(items, context){
		var e = document.createElement('div')
		e.classList.add('group')
		items
			// XXX is this wrong???
			.flat(Infinity)
			.forEach(function(item){
				e.appendChild(item) })
		return e },
	//
	// Format:
	// 	<div value="value_json" class="item .." tabindex="0" ..>
	// 		<!-- value -->
	// 		<div class="text">value_a</div>
	// 		<div class="text">value_b</div>
	// 		...
	//
	// 		<!-- buttons (optional) -->
	// 		<div class="button">button_a_html</div>
	// 		<div class="button">button_b_html</div>
	// 		...
	// 	</div>
	//
	// XXX add custom events:
	// 		- open
	// 		- select
	// 		- update
	renderItem: function(item, i, context){
		var options = context.options || this.options
		if(options.hidden && !options.renderHidden){
			return null
		}
		var text = JSON.stringify(item.value)
		var elem = document.createElement('div')

		// classes...
		elem.classList.add(...['item']
			// user classes...
			.concat(item.cls || [])
			// special classes...
			.concat([
				'selected',
				'disabled',
				'hidden',
			].filter(function(cls){ 
				return !!item[cls] })))

		// attrs...
		item.disabled
			|| elem.setAttribute('tabindex', '0')
		Object.entries(item.attrs || {})
			.forEach(function([key, value]){
				elem.setAttribute(key, value) })
		elem.setAttribute('value', text)

		// values...
		;(item.value instanceof Array ? item.value : [item.value])
			// XXX handle $keys and other stuff...
			.map(function(v){
				var value = document.createElement('span')
				value.classList.add('text')
				value.innerHTML = v || item || ''
				elem.appendChild(value)
			})

		// events...
		// XXX revise signature...
		elem.addEventListener('click', 
			function(){ $(elem).trigger('open', [text, item, elem]) })
		//elem.addEventListener('tap', function(){ $(elem).trigger('open', [text, item, elem]) })
		Object.entries(item.events || {})
			// shorthand events...
			.concat([
					'click',
				].map(function(evt){ 
					return [evt, item[evt]] }))
			// setup the handlers...
			.forEach(function([evt, handler]){
				handler
					&& elem.addEventListener(evt, handler) })

		// buttons...
		// XXX migrate the default buttons functionality and button inheritance...
		var buttons = (item.buttons || options.itemButtons || [])
			.slice()
			// NOTE: keep the order unsurprising...
			.reverse()
		var stopPropagation = function(evt){ evt.stopPropagation() }
		buttons
			.forEach(function([html, handler]){
				var button = document.createElement('div')
				button.classList.add('button')
				button.innerHTML = html
				if(!item.disabled){
					button.setAttribute('tabindex', '0')
					;(options.buttonLocalEvents || options.localEvents || [])
						.forEach(function(evt){
							button.addEventListener(evt, stopPropagation) })
					handler
						&& button.addEventListener('click', handler)
				}
				elem.appendChild(button)
			})
		
		item.dom = elem

		return elem 
	},

	// This does tow additional things:
	// 	- save the rendered state to .dom 
	// 	- wrap a list of nodes (nested list) in a div
	render: function(options){
		var d = object.parent(BrowserPrototype.render, this).call(this, ...arguments)

		// wrap the list (nested list) of nodes in a div...
		if(d instanceof Array){
			var c = document.createElement('div')
			d.forEach(function(e){
				c.appendChild(e) })
			d = c
		}

		this.dom = d
		return this.dom
	},

	// Custom events...
	// XXX do we use jQuery event handling or vanilla?
	// 		...feels like jQuery here wins as it provides a far simpler
	// 		API + it's a not time critical area...
	open: function(func){
	},

	filter: function(){},

	select: function(){},
	get: function(){},
	focus: function(){},

	// Navigation...
	//
	up: function(){},
	down: function(){},
	left: function(){},
	right: function(){},

	next: function(){},
	prev: function(){},

	collapse: function(){},
	// XXX scroll...


}


// XXX should this be a Widget too???
var Browser = 
module.Browser = 
object.makeConstructor('Browser', 
		BrowserClassPrototype, 
		BrowserPrototype)



//---------------------------------------------------------------------
// Text tree renderer...
//
// This is mainly designed for testing.
//
// XXX Q: how should the header item and it's sub-list be linked???

var TextBrowserClassPrototype = {
	__proto__: BaseBrowser,
}

var TextBrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
		renderIndent: '\t',
	},
	
	// NOTE: we do not need .renderGroup(..) here as a group is not 
	// 		visible in text...
	renderList: function(items, options){
		var that = this
		return this.renderNested(null, items, null, null, options)
			.join('\n') },
	renderItem: function(item, i, options){
		var value = item.value || item
		return item.current ?
			`[ ${value} ]`
   			: value },
	renderNested: function(header, sublist, context, item, options){
		var that = this
		var nested = sublist 
			&& sublist
				.flat()
				.map(function(e){
					return e instanceof Array ?
						e.map(function(e){ 
							return (that.options.renderIndent || '  ') + e })
						: e })
				.flat() 
		return (
			// expanded...
			header && nested ?
				[
					'- ' + header,
					nested,
				]
			// collapsed...
			: header ?
				[ '+ ' + header ]
			// headerless...
			: nested )},
}

var TextBrowser = 
module.TextBrowser = 
object.makeConstructor('TextBrowser', 
		TextBrowserClassPrototype, 
		TextBrowserPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
