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

// Generate an event method...
//
//	Trigger an event
//	.event()
//	.event(arg, ..)
//		-> this
//
//	Bind an event handler...
//	.event(func)
//		-> this
//
//
// XXX should this be simply a shorthand to .trigger(..) ???
var makeEventMethod = function(event, handler){
	return function(item){
		// register handler...
		if(item instanceof Function){
			return this.on(event, item) 
		}

		// XXX STUG: event object...
		// XXX can we generate this in one spot???
		// 		...currently it is generated here and in .trigger(..)
		var evt = {
		 	name: event,
			// XXX
			//stopPropagation: function(){
			//},
		}

		// XXX handle more of the API???
		handler
			&& handler.call(this, evt, ...arguments)

		// XXX we should get the actual item and pass it on...
		this.trigger(evt, ...arguments)

		return this
	}
}

var callItemEventHandlers = function(item, event, ...args){
	;(item[event] ?
			[item[event]]
			: [])
		.concat((item.events || {})[event] || [])
		.forEach(function(handler){
			// XXX revise call signature...
			handler.call(item, evt, item, ...args) }) }

var makeItemEventMethod = function(event, handler){
	return makeEventMethod(event, function(evt, item, ...args){
		item = item ? 
			// XXX
			this.get(item) 
			: []
		item = item instanceof Array ? item : [item]

		handler
			&& handler.call(this, evt, item, ...args)

		item.forEach(function(item){
			callItemEventHandlers(item, event) })
	}) }



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var BaseBrowserClassPrototype = {
}

// XXX need a way to identify items...
var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: {
		noDuplicateValues: false,
	},

	// parent widget object...
	//
	// NOTE: this may or may not be a Browser object.
	parent: null,

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
	// 		a compromise we use .item_index below for item identification.
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
	// NOTE: this will get overwritten each tume .make(..) is called.
	//
	// XXX need to maintain this over item add/remove/change...
	// XXX Q: should we be able to add/remove/change items outside of .__list__(..)???
	// 		...only some item updates (how .collapsed is handled) make 
	// 		sense at this time -- need to think about this more 
	// 		carefully + strictly document the result...
	// XXX can we make the format here simpler with less level 
	// 		of indirection??
	// 		...currently to go down a path we need to:
	//			this.item_index.A.sublist.item_index.B.sublist...
	//		would be nice to be closer to:
	//			this.A.B...
	__item_index: null,
	get item_index(){
		this.__item_index
			|| this.make()
		return this.__item_index },
	set item_index(value){
		this.__item_index = value },


	// XXX what should these return??? (item, id, ...)
	__focused: undefined,
	get focused(){
		return this.__focused 
			|| (this.__focused = this
				// XXX should we simple bailout when we find an item???
				.filter(function(e){
					return e.focused })[0]) },
	set focused(value){
		// XXX
	},

	__selected: null,
	get selected(){
		return this.__selected 
			|| (this.__selected = this
				.filter(function(e){
					return e.selected })) },
	set selected(value){
		// XXX
	},


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



	// XXX need a better key/path API...
	//
	__value2key__: function(key){
		//return JSON.stringify(key)
		return key instanceof Array ?
			key.join(' ')
			: key },

	// Key getter/generator...
	//
	// XXX should these include the path???
	// XXX is JSON the best key format???
	__key__: function(item){
		return item.id 
			// value is a browser -> generate an unique id...
			// XXX identify via structure...
			|| (item.value instanceof Browser 
				&& this.__id__())
			|| this.__value2key__(item.value) },

	// ID generator...
	//
	// Format:
	// 	"<date>"
	// 	"<prefix> <date>"
	//
	// XXX do a better id...
	// 		repetition count would be logical as a suffix...
	// XXX not sure about the logic of this, should this take an item as 
	// 		input and return an id???
	// 		...should this check for uniqueness???
	// 		think merging this with any of the actual ID generators would be best...
	__id__: function(prefix){
		// id prefix...
		return (prefix || '') 
			// separator...
			+ (prefix ? ' ' : '') 
			// date...
			+ Date.now() },



	// Make .items and .item_index...
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
	// NOTE: for items with repeating values there is no way to correctly 
	// 		identify an item thus no state is maintained between .make(..)
	// 		calls for such items...
	//
	// XXX revise options handling for .__list__(..)
	make: function(options){
		// XXX
		options = options || this.options || {}

		var items = this.items = []
		var old_index = this.__item_index || {}
		var new_index = this.__item_index = {} 

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
			opts = Object.assign(
				{},
				opts, 
				{value: value})

			// item id...
			var key = this.__key__(opts)
			var id_changed = (old_index[key] || {}).id_changed

			// handle duplicate ids -> err if found...
			if(opts.id && opts.id in new_index){
				throw new Error(`make(..): duplicate id "${key}": `
					+`can't create multiple items with the same key.`) }
			// handle duplicate keys...
			// NOTE: we can't reuse an old copy when re-making the list
			// 		because there is now way to correctly identify an 
			// 		object when it's id is tweaked (and we can not rely
			// 		on item order)...
			// 		...for this reason all "persistent" state for such 
			// 		an element will be lost when calling .make(..) again
			// 		and re-making the list...
			// 		a solution to this would be to manually assign an .id 
			// 		to such elements in .__list__(..)...
			// 		XXX can we go around this without requiring the user 
			// 			to manage ids???
			var k = key
			while(k in new_index){
				// duplicate keys disabled...
				if(options.noDuplicateValues){
					throw new Error(`make(..): duplicate key "${key}": `
						+`can't create multiple items with the same key.`) }

				// mark both the current and the first items as id-mutated...
				opts.id_changed = true
				new_index[key].id_changed = true

				// create a new key...
				k = this.__id__(key)
			}
			key = opts.id = k

			// build the item...
			var item = Object.assign({}, 
				// get the old item values (only for non duplicate items)...
				id_changed ?
					{}
					: old_index[key] || {},
				options || {},
				opts,
				{
					parent: this,
				})

			// XXX do we need both this and the above ref???
			item.sublist instanceof Browser
				&& (item.sublist.parent = this)

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
	//
	// 	.get()
	// 	.get(id)
	// 	.get(index)
	// 	.get(path)
	// 		-> item
	// 		-> undefined
	//
	// XXX add path support...
	get: function(key){
		key = key == null ? 0 : key

		// index...
		if(typeof(key) == typeof(123)){
			// XXX need to account for nesting browsers and groups...
			throw new Error('Not implemented.')

		// key...
		// XXX account for paths...
		} else {
			// XXX
			var k = this.__value2key__(key)

			// direct match...
			if(k in this.item_index){
				return this.item_index[k]
			}

			// query nested...
			var nested = Object.values(this.item_index)
				.filter(function(e){ 
					return e.sublist instanceof Browser })
			while(nested.length > 0){
				var n = nested.shift().sublist
				var res = n.get(key)
				if(res !== undefined){
					return res
				}
			}
		}
		return undefined
	},

	//
	//	.find(id)
	//	.find(index)
	//	.find(path)
	//	.find(query)
	//		-> list
	//
	find: function(){
	},

	// XXX do we need edit ability here? 
	// 		i.e. .set(..), .remove(..), .sort(..), ...
	// 		...if we are going to implement editing then we'll need to 
	// 		callback the user code or update the user state...


	// Events...
	//
	// Format:
	// 	{
	// 		// XXX add tagged event support...
	// 		<event-name>: [
	// 			<handler>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	// XXX
	__event_handlers: null,

	// generic event infrastructure...
	// XXX add support for tagged events...
	// XXX should these be defined on this level or should we use DOM???
	// XXX add support for item events...
	// 		e.g. item.focus(..) -> root.focus(..)
	// XXX also need to design a means for this system to interact both 
	// 		ways with DOM events...
	// XXX need to bubble the event up through the nested browsers...
	on: function(evt, handler){
		var handlers = this.__event_handlers = this.__event_handlers || {}
		handlers = handlers[evt] = handlers[evt] || []
		handlers.push(handler)
		return this
	},
	one: function(evt, handler){
		var func = function(...args){
			handler.call(this, ...args)
			this.off(evt, func)
		}
		this.on(evt, func)
		return this
	},
	off: function(evt, handler){
		// remove all handlers
		if(handler == '*' || handler == 'all'){
			delete (this.__event_handlers || {})[evt]

		// remove only the specific handler...
		} else {
			var handlers = (this.__event_handlers || {})[evt] || []
			do{
				var i = handlers.indexOf(handler)
				i > -1
					&& handlers.splice(i, 1)
			} while(i > -1)
		}
		return this
	},
	trigger: function(evt, ...args){
		var that = this
		var stopPropagation = false
		var evt = typeof(evt) == typeof('str') ?
			// XXX construct this in one place...
			// 		...currently it is constructed here and in makeEventMethod(..)
			{
				name: evt,
				stopPropagation: function(){
					stopPropagation = true },
			}
			: evt

		// call the main set of handlers...
		;((this.__event_handlers || {})[evt.name] || [])
			// prevent .off(..) from affecting the call loop...
			.slice()
			.forEach(function(handler){
				handler.call(that, evt, ...args) })

		// trigger the parent's event...
		!stopPropagation
			&& this.parent
			&& this.parent.trigger(evt, ...args)

		return this
	},

	// domain events/actions...
	// XXX need a way to extend these to:
	// 		- be able to trigger an external (DOM) event...
	// 		- be able to be triggered from an external (DOM) event...
	focus: makeItemEventMethod('focus', function(evt, items){
		// NOTE: if we got multiple matches we care only about the last one...
		var item = items.pop()

		if(!item){
			return
		}

		// blur .focused...
		this.focused
			&& this.blur(this.focused)

		item.focused = true
	}),
	blur: makeItemEventMethod('blur', function(evt, items){
		items.forEach(function(item){
			delete item.focused }) }),
	// XXX update this.selected in a more granular way...
	select: makeItemEventMethod('select', function(evt, items){
		items.forEach(function(item){
			item.selected = true
			// XXX update this.selected in a more granular way...
			delete this.__selected
		}) }),
	deselect: makeItemEventMethod('deselect', function(evt, item){
		items.forEach(function(item){
			delete item.selected
			// XXX update this.selected in a more granular way...
			delete this.__selected
		}) }),

	open: makeItemEventMethod('open', function(evt, item){}),
	enter: makeItemEventMethod('enter', function(evt, item){}),
	// XXX can/should we unify these???
	collapse: makeItemEventMethod('collapse', function(evt, item){}),
	expand: makeItemEventMethod('expand', function(evt, item){}),

	// XXX target can be item or path...
	load: makeEventMethod('load', function(evt, item){}),

	close: makeEventMethod('close', function(evt, reason){}),
	
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
	},

	// parent element (optional)...
	// XXX rename???
	// 		... should this be .containerDom or .parentDom???
	get container(){
		return this.__container 
			|| (this.__dom ? 
				this.__dom.parentElement 
				: undefined) },
	set container(value){
		var dom = this.dom
		this.__container = value
		// transfer the dom to the new parent...
		dom && (this.dom = dom)
	},

	// browser dom...
	get dom(){
		return this.__dom },
	set dom(value){
		this.container 
			&& (this.__dom ?
				this.container.replaceChild(value, this.__dom) 
				: this.container.appendChild(value))
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

		// special-case: item shorthands...
		if(item.value in options.elementShorthand){
			item = options.elementShorthand[item.value]

			// NOTE: this is a bit of a cheat, but it saves us from either 
			// 		parsing or restricting the format...
			var elem = $(item.html)[0]
			elem.classList.add(
				...(item['class'] instanceof Array ?
					item['class']
					: item['class'].split(/\s+/g)))

			return elem 
		}

		// Base DOM...
		var elem = document.createElement('div')
		var text = this.__value2key__(item.value || item)

		// classes...
		elem.classList.add(...['item']
			// user classes...
			.concat(item['class'] || item.cls || [])
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
		text
			&& (item.value instanceof Array ? item.value : [item.value])
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
	//open: function(func){},

	//filter: function(){},

	//select: function(){},
	//get: function(){},
	//focus: function(){},

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
