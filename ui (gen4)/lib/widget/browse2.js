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

// XXX
//var walk = require('lib/walk')
var walk = require('../../node_modules/generic-walk/walk').walk



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
var collectItems = function(make, items){
	items = items instanceof Array ? 
		items 
		: [items]
	var made = items
		.filter(function(e){
			return e === make })
	// constructed item list...
	// ...remove each instance from .items
	made = make.items.splice(
		make.items.length - made.length, 
		made.length)
	// get the actual item values...
	return items
		.map(function(e){
			return e === make ?
				made.shift()
				// raw item -> make(..)
				: (make(e) 
					&& make.items.pop()) }) }



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
	this.items.splice(this.items.length, 0, collectItems(this, items))
	return this
}


// Place list in a sub-list of item...
//
Items.nest = function(item, list, options){
	options = options || {}
	//options = Object.assign(Object.create(this.options || {}), options || {})
	options = Object.assign({},
		{ children: list instanceof Array ?
			collectItems(this, list)
			: list },
		options)
	return this(item, options)
}



//---------------------------------------------------------------------
// wrappers...

// this is here for uniformity...
Items.Item = function(value, options){ return this(...arguments) }

Items.Separator = function(){ return this('---') }
Items.Spinner = function(){ return this('...') }
Items.Action = function(value, options){}
Items.Heading = function(value, options){}
Items.Empty = function(value){}
Items.Selected = function(value){}
Items.Editable = function(value){}
Items.ConfirmAction = function(value){}

// lists...
Items.List = function(values){}
Items.EditableList = function(values){}
Items.EditablePinnedList = function(values){}

// Special list components...
//Items.ListPath = function(){}
//Items.ListTitle = function(){}



//---------------------------------------------------------------------
// Event system parts and helpers...
//
// XXX might be a good idea to make this a generic module...

// Base event object...
//
var BrowserEvent =
module.BrowserEvent = 
object.makeConstructor('BrowserEvent', 
{
	// event name...
	name: undefined,

	data: undefined,

	propagationStopped: false,
	stopPropagation: function(){
		this.propagationStopped = true },

	// XXX not used....
	defaultPrevented: false,
	preventDefault: function(){
		this.defaultPrevented = true },

	__init__: function(name, ...data){
		// sanity check...
		if(arguments.length < 1){
			throw new Error('new BrowserEvent(..): '
				+'at least event name must be passed as argument.') }

		this.name = name
		this.data = data.length > 0 ? 
			data 
			: undefined
	},
})


// Make a method comply with the event spec...
//
// This is mainly for use in overloading event methods.
//
// Example:
// 	someEvent: eventMethod('someEvent', function(..){
// 		// call the original handler...
// 		...
//
// 		...
// 	})
//
var eventMethod = 
module.eventMethod =
function(event, func){
	func.event = event
	return func
}


// Generate an event method...
//
// 	Make and event method...
// 	makeEventMethod(event_name)
// 	makeEventMethod(event_name, handler[, options])
// 		-> event_method
//
// This will produce an event method that supports binding handlers to the
// event (shorthand to: .on(event, handler, ...)) and triggering the 
// said event (similar to: .trigger(event, ..) )...
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
var makeEventMethod = 
module.makeEventMethod =
function(event, handler, retrigger){
	retrigger = retrigger !== false

	return eventMethod(event, function(item){
		// register handler...
		if(item instanceof Function){
			return this.on(event, item) 
		}

		var evt = new BrowserEvent(event)

		handler
			&& handler.call(this, evt, ...arguments)

		return retrigger ? 
			this.trigger(evt, ...arguments)
			: this
	}) }


// Call item event handlers...
//
// 	callItemEventHandlers(item, event_name, event_object, ...)
// 		-> null
//
var callItemEventHandlers = 
function(item, event, evt, ...args){
	evt = evt || new BrowserEvent(event)
	// get the relevant handlers...
	;(item[event] ?
			[item[event]]
			: [])
		.concat((item.events || {})[event] || [])
		// call the handlers...
		.forEach(function(handler){
			handler.call(item, evt, item, ...args) })
	// propagate the event...
	// NOTE: .parent of items in an array container is the first actual
	// 		browser container up the tree, so we do not need to skip
	// 		non-browser parents...
	item.parent
		&& item.parent.trigger
		&& item.parent.trigger(evt, item, ...args) }


// Generate item event method...
//
// 	makeItemEventMethod(event_name)
// 	makeItemEventMethod(event_name, handler[, options])
// 	makeItemEventMethod(event_name, handler, default_getter[, options])
// 	makeItemEventMethod(event_name, handler, default_getter, filter[, options])
// 		-> event_method
//
//
// This extends makeEventMethod(..) by adding an option to pass an item
// when triggering the event and if no item is passed to produce a default,
// the rest of the signature is identical...
//
// 	Trigger an event on item(s)...
// 	.event(item, ..)
// 	.event([item, ..], ..)
// 		-> this
//
//
// 	Handle event action...
// 	handler(event_object, items, ...)
//
//
// 	Get default item if none are given...
// 	default_getter()
// 		-> item
//
// 	Check item applicability...
// 	filter(item)
// 		-> bool
//
//
// NOTE: item is compatible to .search(item, ..) spec, see that for more 
// 		details...
// NOTE: triggering an event that matches several items will handle each 
// 		item-parent chain individually, and independently when propagating
// 		the event up...
// NOTE: a parent that contains multiple items will get triggered multiple 
// 		times, once per each item...
// NOTE: item events do not directly trigger the original caller's handlers
// 		those will get celled recursively when the events are propagated
// 		up the tree.
var makeItemEventMethod = 
module.makeItemEventMethod =
function(event, handler, default_item, filter, options){
	// parse args...
	var args = [...arguments].slice(2)
	default_item = args[0] instanceof Function 
		&& args.shift()
	filter = args[0] instanceof Function
		&& args.shift()
	var filterItems = function(items){
		items = items instanceof Array ? 
				items 
			: items === undefined ?
				[]
			: [items]
		return filter ? 
			items.filter(filter) 
			: items }
	options = args.shift()
	options = Object.assign(
		// NOTE: we need to be able to pass item objects, so we can not
		// 		use queries at the same time as there is not way to 
		// 		distinguish one from the other...
		{ noQueryCheck: true },
		options || {})
	var getter = options.getMode || 'search' 
	// base event method...
	// NOTE: this is not returned directly as we need to query the items
	// 		and pass those on to the handlers rather than the arguments 
	// 		as-is...
	var base = makeEventMethod(event, 
		function(evt, item, ...args){
			handler
				&& handler.call(this, evt, item.slice(), ...args)
			item.forEach(function(item){
				// NOTE: we ignore the root event here and force each 
				// 		item chain to create it's own new event object...
				// 		this will isolate each chain from the others in 
				// 		state and handling propagation...
				callItemEventHandlers(item, event, null, ...args) }) },
		false) 
	return Object.assign(
		// the actual method we return...
		function(item, ...args){
			var that = this
			return base.call(this, 
				// event handler...
				item instanceof Function ?
					item
				// array of queries...
				: item instanceof Array ?
					filterItems(item
						.map(function(e){
							return that.search(e, options) })
						.flat()
						.unique())
				// explicit item or query...
				: item != null ? 
					filterItems(this[getter](item, options))
				// item is null or undefined -- get default...
				: default_item instanceof Function ?
					[default_item.call(that) || []].flat()
				: [],
				...args) },
			// get base method attributes -- keep the event method format...
   			base) }


// Generate item event/state toggler...
//
// XXX should this make a toggler.Toggler???
// XXX BUG: the generated toggler in multi mode handles query arrays inconsistently...
// 		- [] is always returned...
// 		- .toggleSelect([1, 2, 10, 20]) -- toggles items on only, returns []
// 		- .toggleSelect([1, 2, 10, 20], 'next') -- toggles items on only, returns []
// 		- .toggleSelect([1, 2, 10, 20], 'on') -- works but returns []
// 		- .toggleSelect([1, 2, 10, 20], 'off') -- works but returns []
var makeItemEventToggler = 
module.makeItemEventToggler = 
function(get_state, set_state, unset_state, default_item, multi, options){
	var _get_state = get_state instanceof Function ?
		get_state
		: function(e){ return !!e[get_state] }
	var _set_state = set_state instanceof Function ?
		set_state
		: function(e){ return !!this[set_state](e) }
	var _unset_state = unset_state instanceof Function ?
		unset_state
		: function(e){ return !this[unset_state](e) }
	var _default_item = default_item instanceof Function ?
		default_item
		: function(){ return this[default_item] }
	// filter/multi...
	var filter = multi instanceof Function
		&& multi
	var filterItems = function(items){
		return filter ? 
			items.filter(filter) 
			: items }
	multi = multi !== false
	var getter = multi ? 'search' : 'get'
	options = Object.assign(
		// NOTE: we need to be able to pass item objects, so we can not
		// 		use queries at the same time as there is not way to 
		// 		distinguish one from the other...
		{ noQueryCheck: true },
		options || {})

	// state normalization lookup table...
	var states = {
		true: true, 
		on: true,
		false: false, 
		off: false,
		// only two states, so next/prev are the same...
		prev: 'next', 
		next: 'next',
		'?': '?', 
		'??': '??', 
		'!': '!',
	}

	return (function eventToggler(item, state){
		var that = this
		// normalize/parse args...
		state = item in states ?
			item 
			: state
		item = (state === item ? 
				null 
				: item) 
			|| _default_item.call(this)
		state = state in states ? 
			states[state] 
			: 'next'

		return [ 
				state == '??' ?
					[true, false]
				: item == null ?
					false	
				: state == '?' ?
					filterItems(
						[this[getter](item, options)]
							.flat())
							.map(_get_state)
				: state === true ?
					_set_state.call(this, item)
				: state == false ? 
					_unset_state.call(this, item)
				// 'next' or '!'...
				// NOTE: 'next' and '!' are opposites of each other...
				: filterItems(
					[this[getter](item, options)]
						.flat())
						.map(function(e){
							return (state == 'next' ? 
									_get_state(e)
									: !_get_state(e)) ?
								_unset_state.call(that, e)
								: _set_state.call(that, e) }) 
			]
			.flat()
			// normalize for single item results -> return item and array...
			.run(function(){
				return this.length == 1 ? 
					this[0] 
					: this }) })
		// support instanceof Toggler tests...
		.run(function(){
			this.__proto__ = toggler.Toggler.prototype
			this.constructor = toggler.Toggler })}
// XXX this is incomplete...
var makeItemEventToggler2 = function(get_state, set_state, unset_state, default_item, multi){
	var _get_state = get_state instanceof Function ?
		get_state
		: function(e){ return !!e[get_state] }
	var _set_state = set_state instanceof Function ?
		set_state
		: function(e){ return !!this[set_state](e) }
	var _unset_state = unset_state instanceof Function ?
		unset_state
		: function(e){ return !this[unset_state](e) }
	multi = multi !== false
	var getter = multi ? 'search' : 'get'

	return toggler.Toggler(
		default_item,
		function(item, state){
			if(item == null){
				return false
			}
			return state == null ?
				_get_state(item)
				: state
		},
		[true, false],
		function(state, item){
			// if no item focused/given return false...
			return item == null ? 
					false 
				// XXX add support for item lists...
				: state ?
	   				_set_state.call(this, item)
				: _unset_state.call(this, item) })
}



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var BaseBrowserClassPrototype = {
}

// XXX Q: should we be able to add/remove/change items outside of .__list__(..)???
// 		...only some item updates (how .collapsed is handled) make 
// 		sense at this time -- need to think about this more 
// 		carefully + strictly document the result...
// XXX can/should we make traversal simpler???
// 		...currently to get to a nested item we'd need to:
// 			dialog.flatIndex.B.children.index.C. ...
// 		on the other hand we can .get('B/C/...')
var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: {
		// If true item keys must be unique...
		uniqueKeys: false,
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
	// 		a compromise we use .index below for item identification.
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items },
	set items(value){
		this.__items = value },


	// Clear cached data...
	//
	// This will delete all attributes of the format:
	// 	.__<title>_cache
	//
	clearCache: function(){
		Object.keys(this)
			.forEach(function(key){
				if(key.startsWith('__') && key.endsWith('_cache')){
					delete this[key]
				}
			}.bind(this)) 
		return this },


	// Item index...
	//
	// Format:
	// 	{
	// 		"<path>": <item>,
	// 		// repeating path...
	// 		"<path>:<count>": <item>,
	// 		...
	// 	}
	//
	// NOTE: this will get overwritten each time .make(..) is called.
	__item_index_cache: null,
	get index(){
		return (this.__item_index_cache = 
			this.__item_index_cache 
				|| this
					.reduce(function(index, e, i, p){
						var id = p = p.join('/')
						var c = 0
						// generate a unique id...
						// NOTE: no need to check if e.id is unique as we already 
						// 		did this in make(..)...
						while(id in index){
							id = this.__id__(p, ++c)
						}
						index[id] = e
						return index
					}.bind(this), {}, {iterateAll: true})) },

	// Flat item index...
	//
	// Format:
	// 	{
	// 		"<key>": <item>,
	// 		// repeating keys...
	// 		"<key>:<count>": <item>,
	// 		...
	// 	}
	//
	// XXX should this be cached???
	get flatIndex(){
		return this
			.reduce(function(index, e, i, p){
				var id = p = this.__key__(e)
				var c = 0
				while(id in index){
					id = this.__id__(p, ++c)
				}
				index[id] = e
				return index
			}.bind(this), {}, {iterateAll: true}) },

	// Shorthands for common item queries...
	//
	// XXX should these be cached???
	get focused(){
		return this.get('focused') },
	set focused(value){
		this.focus(value) },
	get selected(){
		return this.search('selected') },
	set selected(value){
		this.deselect('selected')
		this.select(value) },


	// Length...
	//
	// visible only...
	get length(){
		return this.map().length },
	// include collapsed elements...
	get lengthTree(){
		return this.map({iterateCollapsed: true}).length },
	// include non-iterable elements...
	get lengthAll(){
		return this.map({iterateAll: true}).length },


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
	// 	.index (keyed via .id or JSONified .value)
	//
	// Each of the above structures is reset on each call to .make(..)
	//
	// options format:
	// 	{
	// 		id: <string>,
	// 		value: <string> | <array>,
	//
	// 		children: <browser> | <array>,
	//
	// 		focused: <bool>,
	// 		selected: <bool>,
	// 		disabled: <bool>,
	// 		noniterable: <bool>,
	//
	// 		// Set automatically...
	// 		parent: <browser>,
	// 		// XXX move this to the appropriate object...
	// 		dom: <dom>,
	// 	}
	//
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
	// Normalize value...
	__value2key__: function(key){
		//return JSON.stringify(key)
		return key instanceof Array ?
			key.join(' ')
			: key },

	// Key getter/generator...
	__key__: function(item){
		return item.id 
			// value is a browser -> generate an unique id...
			// XXX identify via structure...
			|| (item.value instanceof Browser 
				&& this.__id__())
			|| this.__value2key__(item.value) },

	// ID generator...
	//
	// 	.__id__()
	// 	.__id__(prefix)
	// 	.__id__(prefix, count)
	// 		-> id
	//
	// Format:
	// 	"<date>"
	// 	"<prefix>:<count>"
	// 	"<prefix>:<date>"
	//
	// XXX not sure about the logic of this, should this take an item as 
	// 		input and return an id???
	// 		...should this check for uniqueness???
	// 		think merging this with any of the actual ID generators would be best...
	__id__: function(prefix, count){
		return prefix ?
			// id prefix...
			//`${prefix} (${count || Date.now()})`
			`${prefix}:${count || Date.now()}`
			// plain id...
			: `item${Date.now()}` },


	// Walk the browser...
	//
	//	Get list of nodes in tree...
	//	.walk()
	//		-> list
	//
	//	Walk the tree passing each node to func(..)
	//	.walk(func(..)[, options])
	//		-> list
	//
	//	Walk tree passing each node to func(..) using method name to 
	//	walk nested browsers...
	//	NOTE: 'walk' is used as name if name is not present in the object...
	//	.walk(func(..), name, args(..)[, options])
	//	.walk(func(..), name, args(..), walkable(..)[, options])
	//		-> list
	//
	//	Walk tree passign each node to func(..) and handle nested browser 
	//	walking in recursion(..) optionally testing if walkable with walkable(..)
	//	.walk(func(..), recursion(..)[, options])
	//		-> list
	//
	//
	//	Item handler...
	//	func(node, index, path, next(..), stop(..), children)
	//		-> list
	//
	//	Trigger next/nested item handling...
	//	next(children)
	//		-> list
	//
	//	Stop handling...
	//	stop(result)
	//
	//
	//	Handle walkable node children (recursively)...
	//	recursion(children, index, path, options, context, func(..), stop(..), walk())
	//		-> list
	//
	//
	//	Prepare arguments for call of name function on nested browser...
	//	args(list, index, path, options, context, func(..), stop(..))
	//		-> list
	//
	//
	//	Test if node is walkable...
	//	walkable(node)
	//		-> bool
	//
	//
	// For examples see: .text(..), .paths(..) and .map(..)
	//
	//
	// options format:
	// 	{
	// 		// Partial walking...
	// 		//
	// 		// XXX not implemented yet...
	// 		start: <index> | <path>,
	// 		count: <number>,
	// 		end: <index> | <path>,
	//
	//
	// 		// Iterate ALL items...
	// 		//
	// 		// NOTE: this if true overrides all other iteration coverage 
	// 		//		options... 
	// 		iterateAll: <bool>,
	//
	// 		// If true do not skip items with .noniterable set to true...
	// 		iterateNonIterable: <bool>,
	// 		// If true do not skip item.children of items with .collapsed 
	// 		// set to true...
	// 		iterateCollapsed: <bool>,
	// 		// If true skip iterating nested items...
	// 		skipNested: <bool>,
	//
	// 		// XXX not yet supported...
	// 		skipInlined: <bool>,
	//
	// 		skipDisabled: <bool>,
	//
	// 		// Reverse iteration order...
	//		//
	//		// modes:
	//		//	false | null		- normal order (default)
	//		//	true | 'tree'		- reverse order of levels but keep 
	//		//							topology order, i.e. containers
	//		//							will precede contained elements.
	//		//	'flat'				- full flat reverse
	//		//
	//		// NOTE: in 'flat' mode the client loses control over the 
	//		//		order of processing via doNested(..) as it will be 
	//		//		called before handleItem(..)
	// 		reverse: <bool> | 'flat' | 'tree',
	//
	// 		// The value to be used if .reverse is set to true...
	// 		defaultReverse: 'tree' (default) | 'flat',
	//
	//
	// 		// If true include inlined parent id in path...
	// 		// XXX not implemented yet -- can we implement this???...
	// 		// XXX do we need this??
	// 		inlinedPaths: <bool>,
	// 	}
	//
	//
	// NOTE: if recursion(..) is not given then .walk(..) is used to 
	// 		handle all the nested elements (children)...
	// NOTE: if walkable(..) is not given then we check for .walk(..)
	// 		availability...
	// NOTE: children arrays are handled internally...
	//
	//
	// XXX which of the forms should be documented in the signature???
	// 		NOTE: it does not matter which is used as we manually
	// 		parse arguments...
	// XXX passing both index directly and context containing index 
	// 		(context.index) feels excessive...
	// 			+ this is done so as to provide the user a simpler 
	// 				.map(..)-like form...
	// 				Ex:
	// 					.walk((e, i, p, next, stop) => p.join('/'))
	// 					// vs.
	// 					.walk((e, c, next, stop) => c.path.join('/'))
	// 			- two ways to get index and one to update it...
	// 		...if this can produce errors we need to simplify...
	// XXX add options.skip(elem) function to test elements for skipping...
	// XXX add docs:
	// 		- maintaining context to implement/extend walkers...
	// 		- correctly stopping recursive calls (call root stop(..))
	// XXX can this be simpler???
	walk: function(func, recursion, walkable, options){
		var that = this

		// parse args...
		var args = [...arguments]
		func = (args[0] instanceof Function 
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		var recursion = (args[0] instanceof Function 
				|| typeof(args[0]) == typeof('str')
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		var formArgs = (typeof(recursion) == typeof('str')
				&& args[0] instanceof Function) ?
			args.shift()
			: null
		// sanity check...
		if(formArgs == null && typeof(recursion) == typeof('str')){
			throw new Error(`.walk(func, name, formArgs, ..): `
				+`expected function as third argument, got: ${formArgs}.`) }
		var walkable = (!formArgs 
				&& (args[0] instanceof Function 
					|| args[0] == null)) ?
			args.shift() 
			: null 
		options = args.shift() || {} 

		// get/build context...
		var context = args.shift()
		context = context instanceof Array ? 
			{ path: context } 
			: (context || {})
		context.root = context.root || this
		context.index = context.index || 0

		// options specifics...
		var iterateNonIterable = options.iterateAll || options.iterateNonIterable
		var iterateCollapsed = options.iterateAll || options.iterateCollapsed
		var skipNested = !options.iterateAll && options.skipNested
		var skipInlined = !options.iterateAll && options.skipInlined
		var skipDisabled = !options.iterateAll && options.skipDisabled
		var reverse = options.reverse === true ?
			(options.defaultReverse || 'tree')
			: options.reverse

		var isWalkable = walkable ?
			function(node){
				return node instanceof Array || walkable(node) }
			: function(node){
				return node 
					&& (node instanceof Array 
						// requested method name is available...
						|| (typeof(recursion) == typeof('str') 
							&& node[recursion])
						|| node.walk ) }

		return walk(
			function(state, node, next, stop){
				// keep only the root stop(..) -> stop the entire call tree...
				stop = context.stop = context.stop || stop

				// skip non-iterable items...
				if(!iterateNonIterable && node.noniterable){
					return state }
				// skip disabled...
				if(skipDisabled && node.disabled){
					return state }

				var nested = false
				var doNested = function(list){
					// this can be called only once -> return cached results...
					if(nested !== false){
						return nested }
					// calling this on a node without .children is a no-op...
					if(children == null){
						return [] }

					// normalize...
					list = list === true ?
							children	
						: (!iterateCollapsed && node.collapsed) ?
							[]
						: list == null ?
							children
						: list

					// call .walk(..) recursively...
					var useWalk = function(){
						return list.walk(
							func, 
							recursion, 
							...(formArgs instanceof Function ? 
								[formArgs] 
								: [walkable]), 
							options, context) }

					return (list === false ?
								[]	
							// handle arrays internally...
							: list instanceof Array ?
								// NOTE: this gets the path and i from context...
								next('do', [], 
									...(reverse ? 
										list.slice().reverse() 
										: list))
							// user-defined recursion...
							: recursion instanceof Function ?
								recursion.call(that, 
									list, context.index, p, 
									options, context, 
									func, useWalk)
							// method with arg forming...
							: formArgs instanceof Function 
									&& list[recursion] ?
								list[recursion](
									...(formArgs(
										list, context.index, p, 
										options, context, 
										func, useWalk) || []))
							// .walk(..)
							: useWalk())
						// normalize and merge to state...
						.run(function(){
							return (nested = this instanceof Array ?
								this
								: [this]) }) }

				// prepare context...
				var id = node.id || node.value
				var path = context.path = context.path || []
				var [inline, p, children] = 
					// inline...
					isWalkable(node) ?
						[true, path, node]
					// nested...
					: (!skipNested && isWalkable(node.children)) ?
						[false, 
							// update context for nested items...
							path.push(id) 
								&& path, 
							node.children]
					// leaf...
					: [false, path.concat([id]), undefined]

				if(inline && skipInlined){
					return state }

				// go through the elements...
				state.splice(state.length, 0,
					...[
						// reverse -> do children...
						reverse == 'flat' 
							&& children
							&& doNested() 
							|| [],
						// do element...
						func ? 
							(func.call(that, 
								...(inline ? 
									[null, context.index] 
									: [node, context.index++]),
								p, 
								// NOTE: when calling this it is the 
								// 		responsibility of the caller to return
								// 		the result to be added to state...
								doNested, 
								stop,
								children) || []) 
							: [node],
						// normal order -> do children...
						children
							&& nested === false
							&& doNested() 
							|| [],
				   	].flat())

				// restore path context...
				children
					&& context.path.pop()

				return state
			}, 
			[], 
			// input items...
			...(reverse ? 
				this.items
					.slice()
					.reverse() 
				: this.items)) },


	// Test/Example Text renders...
	//
	//	Recursively render the browser as text tree...
	//	._test_texttree(..)
	//		-> string
	//
	//	Recursively render the browser as text tree with manual nesting...
	//	._test_texttree_manual(..)
	//		-> string
	//
	//	Build a nested object tree from the browser...
	//	._test_tree(..)
	//		-> object
	//
	_test_texttree: function(options, context){
		// NOTE: here we do not care about the topology (other than path 
		// 		depth) and just handle items...
		return this
			.walk(
				function(node, i, path){
					return node ? 
						path.slice(1)
							.map(e => '  ')
							.join('') + (node.value || node)
						: [] },
				'_test_texttree',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			.join('\n') },
	_test_texttree_manual: function(options, context){
		// NOTE: here we do basic topology -- append children to their 
		// 		respective node...
		return this
			.walk(
				function(node, i, path, next){
					return node == null ? 
							[]
						// make a node...
						: [path.slice(1)
							.map(e => '  ')
							.join('') + (node.value || node)]
							// append child nodes if present...
			   				.concat(node.children ?
								next()
								: []) },
				'_test_texttree_manual',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			.join('\n') },
	// XXX need to check for output key uniqueness per level...
	_test_tree: function(options, context){
		var toObject = function(res, e){
			if(e == null || e[0] == null){
				return res
			}
			res[e[0]] = e[1] instanceof Array ? 
				// handle nested arrays...
				// NOTE: these did not get through the .reduce(..) below
				// 		as they are simple arrays that do not implement
				// 		either .walk(..) or ._test_tree(..)
				e.slice(1).reduce(toObject, {}) 
				: e[1]
			return res
		}
		return this
			// build [key, children] pairs...
			.walk(
				function(node, i, path, next){
					return node == null ? 
							[]
						// make a node...
						: [[(node.value || node)]
							// append child nodes if present...
			   				.concat(node.children ?
								next()
								: null) ] },
				'_test_tree',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			// construct the object...
   			.reduce(toObject, {}) },
	// XXX we do not need this any more, as we got paths in the index...
	_test_paths: function(options, context){
		return this.walk(
			function(n, i, p){
				return n 
					&& [(options || {}).joinPaths !== false ? 
						p.join('/') 
						: p] }, 
			'_test_paths',
			function(_, i, path, options, context){
				// NOTE: for paths and indexes to be consistent between
				// 		levels we need to thread the context on, here and
				// 		into the base .walk(..) call below...
				return [options, context] },
			options, context) },


	// Extended map...
	//
	//	Get all items...
	//	.map([options])
	//		-> items
	//
	//	Map func to items...
	//	.map(func[, options])
	//		-> items
	//
	//
	//
	//	func(item, index, path, browser)
	//		-> result
	//
	//
	//
	// options format:
	// 	{
	// 		// The value used if .reverse is set to true...
	// 		//
	// 		// NOTE: the default is different from .walk(..)
	// 		defaultReverse: 'flat' (default) | 'tree',
	//
	// 		// For other supported options see docs for .walk(..)
	// 		...
	// 	}
	//
	//
	// By default this will not iterate items that are:
	// 	- non-iterable (item.noniterable is true)
	// 	- collapsed sub-items (item.collapsed is true)
	//
	// This extends the Array .map(..) by adding:
	// 	- ability to run without arguments
	// 	- support for options
	//
	//
	// XXX should we move the defaults to .config???
	// XXX Q: should we have an option to treat groups as elements???
	map: function(func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		func = (args[0] instanceof Function 
				|| args[0] === undefined) ? 
			args.shift() 
			: undefined
		options = args.shift() || {}
		options = !options.defaultReverse ?
			Object.assign({},
				options, 
				{ defaultReverse: 'flat' })
			: options
		var context = args.shift()

		return this.walk(
			function(elem, i, path){
				return elem != null ?
					[func === undefined ?
						elem
						// XXX should this pass the current or the root 
						// 		container to func???
						: func.call(that, elem, i, path, that)]
					: [] }, 
			'map',
			function(_, i, p, options, context){
				return [func, options, context] },
			options, context) },


	// Search items...
	//
	// 	Get list of matching elements...
	// 	NOTE: this is similar to .filter(..)
	// 	.search(test[, options])
	// 		-> items
	//
	// 	Map func to list of matching elements and return results...
	// 	NOTE: this is similar to .filter(..).map(func)
	// 	.search(test, func[, options])
	// 		-> items
	//
	//
	// test can be:
	// 	predicate(..)	- function returning true or false
	// 	index			- element index
	// 						NOTE: index can be positive or negative to 
	// 							access items from the end.
	// 	path			- array of path elements or '*' (matches any element)
	// 	regexp			- regexp object to test item path
	// 	query			- object to test against the element 
	// 	keyword			- 
	//
	//
	// 	predicate(elem, i, path)
	// 		-> bool
	//
	//
	// query format:
	// 	{
	// 		// match if <attr-name> exists and is true...
	// 		// XXX revise...
	// 		<attr-name>: true,
	//
	// 		// match if <attr-name> does not exist or is false...
	// 		// XXX revise...
	// 		<attr-name>: false,
	//
	// 		// match if <attr-name> equals value...
	// 		<attr-name>: <value>,
	//
	// 		// match if func(<attr-value>) return true...
	// 		<attr-name>: <func>,
	//
	// 		...
	// 	}
	//
	//
	// supported keywords:
	// 	'first'		- get first item (same as 0)
	// 	'last'		- get last item (same as -1)
	// 	'selected'	- get selected items (shorthand to {selected: true})
	// 	'focused'	- get focused items (shorthand to {focused: true})
	//
	//
	// options format:
	// 	{
	// 		noIdentityCheck: <bool>,
	//
	// 		noQueryCheck: <bool>,
	//
	// 		...
	// 	}
	//
	//
	//
	// __search_test_generators__ format:
	// 	{
	// 		// NOTE: generator order is significant as patterns are testen 
	// 		//		in order the generators are defined...
	// 		// NOTE: testGenerator(..) is called in the context of 
	// 		//		__search_test_generators__ (XXX ???)
	// 		// NOTE: <key> is only used for documentation...
	// 		<key>: testGenerator(..),
	//
	// 		...
	// 	}
	//
	//	testGenerator(pattern)
	//		-> test(elem, i, path)
	//		-> false
	//
	//
	// XXX add support for 'next'/'prev', ... keywords... (here or in .get(..)???)
	// XXX add support for fuzzy match search -- match substring by default 
	// 		and exact title if using quotes...
	// XXX do we actually need to stop this as soon as we find something, 
	// 		i.e. options.firstOnly???
	// XXX add diff support...
	// XXX should this check hidden items when doing an identity check???
	__search_test_generators__: {
		// regexp path test...
		regexp: function(pattern){
			return pattern instanceof RegExp
				&& function(elem, i, path){
					return pattern.test(elem.value)
						|| pattern.test('/'+ path.join('/')) } },
		// string path test...
		// XXX should 'B' be equivalent to '/B' or should it be more like '**/B'?
		strPath: function(pattern){
			if(typeof(pattern) == typeof('str')){
				pattern = pattern instanceof Array ?
					pattern
					: pattern
						.split(/[\\\/]/g)
						.filter(function(e){ return e.trim().length > 0 })
				return this.path(pattern)
			}
			return false
		},
		// path test...
		// NOTE: this does not go down branches that do not match the path...
		path: function(pattern){
			if(pattern instanceof Array){
				// XXX add support for '**' ???
				var cmp = function(a, b){
					return a.length == b.length
						&& !a
							.reduce(function(res, e, i){
								return res || !(
									e == '*' 
										|| (e instanceof RegExp 
											&& e.test(b[i]))
										|| e == b[i]) }, false) }
				var onPath = function(path){
					return pattern.length >= path.length 
						&& cmp(
							pattern.slice(0, path.length), 
							path) }

				return function(elem, i, path, next){
					// do not go down branches beyond pattern length or 
					// ones that are not on path...
					;(pattern.length == path.length
							|| !onPath(path))
						&& next(false)
					// do the test...
					return path.length > 0
						&& pattern.length == path.length
						&& cmp(pattern, path) } 
			}
			return false
		},
		// item index test...
		index: function(pattern){
			return typeof(pattern) == typeof(123)
				&& function(elem, i, path){
					return i == pattern } },
		// XXX add diff support...
		// object query..
		// NOTE: this must be last as it will return a test unconditionally...
		query: function(pattern){ 
			var that = this
			return function(elem){
				return Object.entries(pattern)
					.reduce(function(res, [key, pattern]){
						return res 
							&& (elem[key] == pattern
								// bool...
								|| ((pattern === true || pattern === false)
									&& pattern === !!elem[key])
								// predicate...
								|| (pattern instanceof Function 
									&& pattern.call(that, elem[key]))
								// regexp...
								|| (pattern instanceof RegExp
									&& pattern.test(elem[key]))
								// type...
								// XXX problem, we can't distinguish this 
								// 		and a predicate...
								// 		...so for now use:
								// 			.search(v => v instanceof Array)
								//|| (typeof(pattern) == typeof({})
								//	&& pattern instanceof Function
								//	&& elem[key] instanceof pattern)
							) }, true) } },
	},
	search: function(pattern, func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		pattern = args.length == 0 ? 
			true 
			: args.shift() 
		func = (args[0] instanceof Function 
				|| args[0] === undefined) ? 
			args.shift() 
			: undefined
		options = args.shift() || {}
		var context = args.shift()

		// pattern -- normalize and do pattern keywords...
		pattern = options.ignoreKeywords ?
				pattern
			: typeof(pattern) == typeof('str') ?
				((pattern === 'all' || pattern == '*') ?
					true
				: pattern == 'first' ?
					0
				: pattern == 'last' ?
					-1
				: pattern == 'selected' ?
					{selected: true}
				: pattern == 'focused' ?
					{focused: true}
				: pattern)
			: pattern
		// normalize negative index...
		if(typeof(pattern) == typeof(123) && pattern < 0){
			pattern = -pattern - 1
			options = Object.assign({},
				options,
				{reverse: 'flat'})
		}
		// normalize/build the test predicate...
		var test = (
			// all...
			pattern === true ?
				pattern
			// predicate...
			: pattern instanceof Function ?
				pattern
			// other -> get a compatible test function...
			: Object.entries(this.__search_test_generators__)
				.filter(function([key, _]){
					return !(options.noQueryCheck 
						&& key == 'query') })
				.reduce(function(res, [_, get]){
					return res 
						|| get.call(that.__search_test_generators__, pattern) }, false) )

		return this.walk(
			function(elem, i, path, next, stop){
				// match...
				var res = (elem
						&& (test === true 
							// identity check...
							|| (!options.noIdentityCheck 
								&& pattern === elem)
							// test...
							|| (test 
								// NOTE: we pass next here to provide the 
								// 		test with the option to filter out
								// 		branches that it knows will not 
								// 		match...
								&& test.call(this, elem, i, path, next)))) ?
					// handle the passed items...
					[ func ?
						func.call(this, elem, i, path, stop)
						: elem ]
					: [] 
				return ((options.firstMatch 
							|| typeof(pattern) == typeof(123)) 
						&& res.length > 0) ? 
					stop(res)
					: res },
			'search',
			function(_, i, p, options, context){
				return [pattern, func, options, context] },
			options, context) },


	// Get item... 
	//
	// 	Get focused item...
	// 	.get()
	// 	.get('focused'[, func])
	// 		-> item
	// 		-> undefined
	//
	// 	Get next/prev item relative to focused...
	// 	.get('prev'[, offset][, func][, options])
	// 	.get('next'[, offset][, func][, options])
	// 		-> item
	// 		-> undefined
	//
	// 	Get first item matching pattern...
	// 	.get(pattern[, func][, options])
	// 		-> item
	// 		-> undefined
	//
	// pattern mostly follows the same scheme as in .select(..) so see 
	// docs for that for more info.
	//
	//
	// NOTE: this is just like a lazy .search(..) that will return the 
	// 		first result only.
	//
	// XXX should we be able to get offset values relative to any match?
	// XXX should next/prev wrap around??? ...option???
	get: function(pattern, options){
		var args = [...arguments]
		pattern = args.shift()
		pattern = pattern === undefined ? 
			'focused' 
			: pattern
		var offset = (pattern == 'next' || pattern == 'prev')
				&& typeof(args[0]) == typeof(123) ?
			args.shift() + 1
			: 1
		var func = args[0] instanceof Function ?
			args.shift() 
			// XXX return format...
			: function(e, i, p){ return e }
		options = args.pop() || {}

		// sanity checks...
		if(offset <= 0){
			throw new Error(`.get(..): offset must be a positive number, got: ${offset}.`) }

		// NOTE: we do not care about return values here as we'll return 
		// 		via stop(..)...
		var b = pattern == 'prev' ? [] : null
		return [
			// next + offset...
			pattern == 'next' ?
				this.search(true, 
					function(elem, i, path, stop){
						if(elem.focused == true){
							b = offset

						// get the offset item...
						} else if(b != null && b <= 0){
							stop([func(elem, i, path)])
						}
						// countdown to offset...
						b = typeof(b) == typeof(123) ? 
							b - 1 
							: b },
					options)
			// prev + offset...
			: pattern == 'prev' ?
				this.search(true, 
					function(elem, i, path, stop){
						elem.focused == true
							&& stop([func(...(b.length >= offset ? 
								b[0]
								: [undefined]))])
						// buffer the previous offset items...
						b.push([elem, i, path])
						b.length > offset
							&& b.shift() },
					options)
			// base case -> get first match...
			: this.search(pattern, 
				function(elem, i, path, stop){
					stop([func(elem, i, path)]) }, 
				options) ].flat()[0] },


	// Sublist map functions...
	// XXX this does not include inlined sections, should it???
	sublists: function(func, options){
		return this.search({children: true}, func, options) },

	// XXX should these return an array or a .constructor(..) instance??
	// XXX should this call .forEach(..) on nested stuff or just fall 
	// 		back to .map(..)???
	forEach: function(func, options){
		this.map(...arguments)
		return this },
	filter: function(func, options, context){
		return this.walk(
			function(e, i, p){
				return e && func.call(this, e, i, p) ? [e] : [] },
			'filter',
			function(_, i, p, options, context){
				return [func, options, context] },
			options, context) },
	reduce: function(func, start, options){
		var that = this
		var context = arguments[3] || {result: start}
		this.walk(
			function(e, i, p){
				context.result = e ? 
					func.call(that, context.result, e, i, p) 
					: context.result
				return context.result 
			},
			'reduce',
			function(_, i, p, options, context){
				return [func, context.result, options, context]
			},
			options, context)
		return context.result
	},

	// XXX should this return a path or a <path>:<count> ad in .index ???
	positionOf: function(item, options){
		return this.search(item, 
			function(_, i, p){ 
				return [i, p] }, 
			Object.assign(
				{
					firstMatch: true, 
					noQueryCheck: true,
				},
				options || {})).concat([[-1, undefined]]).shift() },
	indexOf: function(item, options){
		return this.positionOf(item, options)[0] },
	pathOf: function(item, options){
		return this.positionOf(item, options)[1] },

	// Like .select(.., {iterateCollapsed: true}) but will expand all the 
	// path items to reveal the target...
	// XXX should this return the matched item(s), expanded item(s) or this???
	// XXX need a universal item name/value comparison / getter...
	reveal: function(key, options){
		var that = this
		var seen = new Set()
		var nodes = new Set()
		return this.search(key, 
				function(e, i, path){
					return [path, e] }, 
				Object.assign(
					{ iterateCollapsed: true }, 
					options || {}))
			// NOTE: we expand individual items so the order here is not relevant...
			.map(function([path, e]){
				// skip paths we have already seen...
				// XXX do we actually need this???
				if(seen.has(e.id)){
					return e
				}
				seen.add(e.id)

				var cur = that
				path.length > 1
					&& path
						.slice(0, -1)
						.forEach(function(n){
							// array children...
							if(cur instanceof Array){
								var e = cur
									.filter(function(e){ 
										// XXX need a universal item name test...
										return n == (e.value || e.id) })
									.pop()
								nodes.add(e)
								cur = e.children

							// browser children...
							} else {
								nodes.add(cur.index[n])
								cur = cur.index[n].children
							}
						})
				return e })
			// do the actual expansion...
			.run(function(){
				//return that.expand([...nodes]) }) },
				that.expand([...nodes]) }) },



	// XXX do we need edit ability here? 
	// 		i.e. .set(..), .remove(..), .sort(..), ...
	// 		...if we are going to implement editing then we'll need to 
	// 		callback the user code or update the user state...



	// Make .items and .index...
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
	// NOTE: each call to this will reset both .items and .index
	// NOTE: for items with repeating values there is no way to correctly 
	// 		identify an item thus no state is maintained between .make(..)
	// 		calls for such items...
	//
	// XXX revise options handling for .__list__(..)
	// XXX might be a good idea to enable the used to merge the state 
	// 		manually...
	// 		one way to do:
	// 			- get the previous item via an index, 
	// 			- update it
	// 			- pass it to make(..)
	make: function(options){
		options = Object.assign(Object.create(this.options || {}), options || {})

		var items = this.items = []

		// item constructor...
		//
		// 	Make an item...
		// 	make(value[, options])
		// 	make(value, func[, options])
		// 		-> make
		//
		// 	Inline a browser instance...
		// 	make(browser)
		// 		-> make
		//
		//
		// NOTE: when inlining a browser, options are ignored.
		// NOTE: when inlining a browser it's .parent will be set this 
		// 		reusing the inlined object browser may mess up this 
		// 		property...
		//
		// XXX problem: make(Browser(..), ..) and make.group(...) produce 
		// 		different formats -- the first stores {value: browser, ...}
		// 		while the latter stores a list of items.
		// 		...would be more logical to store the object (i.e. browser/list)
		// 		directly as the element...
		var keys = options.uniqueKeys ? 
			new Set() 
			: null
		var ids = new Set()
		var make_called = false
		var make = function(value, opts){
			make_called = true

			// special-case: inlined browser...
			//
			// NOTE: we ignore opts here...
			// XXX not sure if this is the right way to go...
			// 		...for removal just remove the if statement and its
			// 		first branch...
			if(value instanceof Browser){
				var item = value
				item.parent = this

			// normal item...
			} else {
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

				// duplicate keys (if .options.uniqueKeys is set)...
				if(keys){
				   	if(keys.has(key)){
						throw new Error(`make(..): duplicate key "${key}": `
							+`can't create multiple items with the same key `
							+`when .options.uniqueKeys is set.`) 
					}
					keys.add(key)
				}
				// duplicate ids...
				if(opts.id && ids.has(opts.id)){
					throw new Error(`make(..): duplicate id "${opts.id}": `
						+`can't create multiple items with the same id.`) }

				// build the item...
				var item = Object.assign(
					Object.create(options || {}), 
					opts,
					{ parent: this })

				// XXX do we need both this and the above ref???
				item.children instanceof Browser
					&& (item.children.parent = this)
			}

			// store the item...
			items.push(item)
			ids.add(key)

			return make
		}.bind(this)
		make.__proto__ = Items
		make.dialog = this
		make.items = items

		//var res = this.__list__(make)
		// XXX not sure about this -- revise options handling...
		var res = this.__list__(make, 
			options ? 
				Object.assign(
					Object.create(this.options || {}), 
					options || {}) 
				: null)

		// reset the index/cache...
		var old_index = this.__item_index_cache || {}
		this.clearCache()

		// 2'nd pass -> make item index (unique id's)...
		// NOTE: we are doing this in a separate pass as items can get 
		// 		rearranged during the make phase (Items.nest(..) ...),
		// 		thus avoiding odd duplicate index numbering...
		var index = this.__item_index_cache = this.index

		// merge old item state...
		Object.entries(index)
			.forEach(function([id, e]){
				id in old_index
					// XXX this is not very elegant(???), revise... 
					&& Object.assign(e,
						old_index[id],
						e) })

		// if make was not called use the .__list__(..) return value...
		this.items = make_called ? 
			this.items 
			: res

		return this
	},


	// Renderers...
	//
	// 	.renderFinalize(items, context)
	// 	.renderList(items, context)
	// 	.renderNested(header, children, item, context)
	// 	.renderNestedHeader(item, i, context)
	// 	.renderItem(item, i, context)
	// 	.renderGroup(items, context)
	//
	//
	renderFinalize: function(items, context){
		return this.renderList(items, context) },
	renderList: function(items, context){
		return items },
	// NOTE: to skip rendering an item/list return null...
	// XXX should this take an empty children???
	// 		...this would make it simpler to expand/collapse without 
	// 		re-rendering the whole list...
	renderNested: function(header, children, item, context){
		return header ? 
			this.renderGroup([
				header, 
				children,
			])
   			: children },
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
	//	.render(options[, renderer[, context]])
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
	// options:
	// 	{
	// 		nonFinalized: <bool>,
	//
	//		// for more supported options see: .walk(..)
	// 		...
	// 	}
	//
	//
	// NOTE: there is no need to explicitly .make(..) the state before
	// 		calling this as first access to .items will do so automatically...
	// NOTE: calling this will re-render the existing state. to re-make 
	// 		the state anew that use .update(..)...
	// NOTE: it is not recommended to extend this. all the responsibility
	// 		of actual rendering should lay on the renderer methods...
	// NOTE: currently options and context are distinguished only via 
	// 		the .options attribute...
	render: function(options, renderer, context){
		context = context || {}
		renderer = renderer || this
		options = context.options 
			|| Object.assign(
				Object.create(this.options || {}),
				{ iterateNonIterable: true }, 
				options || {})
		context.options = context.options || options

		// do the walk...
		var elems = this.walk(
			function(elem, i, path, nested){
				return (
					// inline...
					elem == null ?
						// NOTE: here we are forcing rendering of the 
						// 		inline browser/list, i.e. ignoring 
						// 		options.skipNested for inline stuff...
						[ renderer.renderGroup(nested(true), context) ]
					// nested...
					: elem.children ?
						[ renderer.renderNested(
							renderer.renderNestedHeader(elem, i, context),
							nested(),
							elem, 
							context) ]
					// normal elem...
					: [ renderer.renderItem(elem, i, context) ] ) },
			'render',
			function(_, i, p, options, context){
				return [options, renderer, context] },
			options, context)

		// finalize depending on render mode...
		return (!options.nonFinalized && context.root === this) ?
			// root context -> render list and return this...
			renderer.renderFinalize(elems, context)
			// nested context -> return item list...
			: elems
	},
	

	// Events...
	//
	// Format:
	// 	{
	// 		<event-name>: [
	// 			<handler>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	//
	// NOTE: event handlers may have a .tag attribute that stores the tag
	// 		it was created with, this is used by .off(..) to unbind handlers
	// 		tagged with specific tags...
	__event_handlers: null,

	// List events...
	get events(){
		var that = this
		// props to skip...
		// XXX should we just skip any prop???
		var skip = new Set([
			'events'
		])
		return Object.deepKeys(this)
			.map(function(key){
				return (!skip.has(key) 
						&& that[key] instanceof Function 
						&& that[key].event) ? 
					that[key].event 
					: [] })
			.flat() },

	// Generic event infrastructure...
	//
	//	Bind a handler to an event...
	// 	.on(event, func)
	// 	.on(event, func, tag)
	// 		-> this
	//
	// tag can be used to unregister several handlers in a single operation,
	// see .off(..) for more info...
	//
	//
	// NOTE: .one(..) has the same signature as .on(..) but will unregister 
	// 		the handler as soon as it is done...
	//
	// XXX should we be able to trigger events from the item directly???
	// 		i.e. .get(42).on('open', ...) instead of .get(42).open = ...
	// 		...might be a good idea to create an item wrapper object...
	on: function(evt, handler, tag){
		var handlers = this.__event_handlers = this.__event_handlers || {}
		handlers = handlers[evt] = handlers[evt] || []
		handlers.push(handler)
		tag
			&& (handler.tag = tag)
		return this
	},
	one: function(evt, handler, tag){
		var func = function(...args){
			handler.call(this, ...args)
			this.off(evt, func)
		}
		this.on(evt, func, tag)
		return this
	},
	//
	//	Clear all event handlers...
	//	.off('*')
	//
	//	Clear all event handlers from evt(s)...
	//	.off(evt)
	//	.off([evt, ..])
	//	.off(evt, '*')
	//	.off([evt, ..], '*')
	//
	//	Clear handler of evt(s)...
	//	.off(evt, handler)
	//	.off([evt, ..], handler)
	//
	//	Clear all handlers tagged with tag of evt(s)...
	//	.off(evt, tag)
	//	.off([evt, ..], tag)
	//
	// NOTE: evt can be '*' or 'all' to indicate all events.
	off: function(evt, handler){
		if(arguments.length == 0){
			return
		}

		var handlers = this.__event_handlers || {}

		// parse args...
		handler = handler || '*'
		evt = 
			// all events / direct handler...
			(!(evt in handlers) 
					|| evt == '*' 
					|| evt == 'all') ? 
				Object.keys(handlers) 
			// list of events...
			: evt instanceof Array ?
				evt
			// explicit event...
			: [evt]

		// remove all handlers
		handler == '*' || handler == 'all' ?
			evt
				.forEach(function(evt){
					delete handlers[evt] })

		// remove tagged handlers...
		: typeof(handler) == typeof('str') ?
			evt
				.forEach(function(evt){
					var h = handlers[evt] || []
					var l = h.length
					h
						.slice()
						.reverse()
						.forEach(function(e, i){ 
							e.tag == handler
								&& h.splice(l-i-1, 1) }) })

		// remove only the specific handler...
		: evt
			.forEach(function(evt){
				var h = handlers[evt] || []
				do{
					var i = h.indexOf(handler)
					i > -1
						&& h.splice(i, 1)
				} while(i > -1) })
		return this
	},
	// 
	// 	Trigger an event by name...
	// 	.trigger(<event-name>, ..)
	// 		-> this
	//
	// 	Trigger an event...
	// 	.trigger(<event-object>, ..)
	// 		-> this
	//
	//
	// Passing an <event-name> will do the following:
	// 	- if an <event-name> handler is available call it and return
	// 		- the handler should:
	// 			- do any specifics that it needs
	// 			- create an <event-object>
	// 			- call trigger with <event-object>
	//  - if <event-name> has no handler:
	//  	- create an <event-object>
	//  	- call the event handlers passing them <event-object> and args
	//  	- call parent's .trigger(<event-name>, ..)
	//
	// for docs on <event-object> see BrowserEvent(..)
	trigger: function(evt, ...args){
		var that = this

		// trigger the appropriate event handler if available...
		// NOTE: this makes .someEvent(..) and .trigger('someEvent', ..)
		// 		do the same thing by always triggering .someEvent(..) 
		// 		first and letting it decide how to call .trigger(..)...
		// NOTE: the event method should pass a fully formed event object
		// 		into trigger when it requires to call the handlers...
		if(typeof(evt) == typeof('str') 
				&& this[evt] instanceof Function
				&& this[evt].event == evt){
			this[evt](...args)
			return this
		}
		// propagation is stopped...
		// XXX expand this check to support DOM events...
		if(evt.propagationStopped || evt.cancelBubble){
			return this
		}

		var evt = typeof(evt) == typeof('str') ?
			new BrowserEvent(evt)
			: evt

		// call the main set of handlers...
		;((this.__event_handlers || {})[evt.name] || [])
			// prevent .off(..) from affecting the call loop...
			.slice()
			.forEach(function(handler){
				handler.call(that, evt, ...args) })

		// trigger the parent's event...
		!(evt.propagationStopped || evt.cancelBubble)
			&& this.parent
			&& this.parent.trigger instanceof Function
			// XXX should we pass trigger and event object or event name???
			&& this.parent.trigger(evt, ...args)

		return this
	},


	// domain events/actions...
	//
	// 	Bind a handler to an event...
	// 	.focus(func)
	// 		-> this
	//
	// 	Trigger an event...
	// 	.focus(query[, ...])
	// 		-> this
	//
	//
	// NOTE: this will ignore disabled items.
	// NOTE: .focus('next') / .focus('prev') will not wrap around the 
	// 		first last elements...
	focus: makeItemEventMethod('focus', 
		function(evt, items){
			// blur .focused...
			this.focused
				&& this.blur(this.focused)
			// NOTE: if we got multiple matches we care only about the first one...
			var item = items.shift()
			item != null
				&& (item.focused = true)
		},
		function(){ return this.get(0) },
		{ 
			getMode: 'get', 
			skipDisabled: true,
		}),
	blur: makeItemEventMethod('blur', function(evt, items){
		items.forEach(function(item){
			delete item.focused }) }),
	// NOTE: .next() / .prev() will wrap around the first/last elements...
	next: function(){ 
		this.focus('next').focused || this.focus('first') 
		return this },
	prev: function(){ 
		this.focus('prev').focused || this.focus('last') 
		return this },
	toggleFocus: makeItemEventToggler(
		'focused', 
		'focus', 'blur', 
		function(){ return this.focused || 0 }, 
		false),

	select: makeItemEventMethod('select', 
		function(evt, items){
			items.forEach(function(item){
				item.selected = true }) },
		// XXX is this a good default???
		function(){ return this.focused }),
	deselect: makeItemEventMethod('deselect', 
		function(evt, items){
			items.forEach(function(item){
				delete item.selected }) },
		function(){ return this.focused }),
	toggleSelect: makeItemEventToggler('selected', 'select', 'deselect', 'focused'),
	// XXX use a real toggler or just emulate toggler API???
	// 		...meke these two the same and select the simpler version...
	//toggleSelect2: makeItemEventToggler2('selected', 'select', 'deselect', 'focused'),

	// NOTE: .expand(..) / .collapse(..) / .toggleCollapse(..) ignore 
	// 		item.collapsed state....
	collapse: makeItemEventMethod('collapse', 
		function(evt, item){
			item.forEach(function(e){ e.collapsed = true }) 
			this.update()
		},
		function(){ return this.focused },
		function(elem){ return elem.value && elem.children },
		{iterateCollapsed: true}),
	expand: makeItemEventMethod('expand', 
		function(evt, item){
			item.forEach(function(e){ delete e.collapsed }) 
			this.update()
		},
		function(){ return this.focused },
		function(elem){ return elem.value && elem.children },
		{iterateCollapsed: true}),
	toggleCollapse: makeItemEventToggler(
		'collapsed', 
		'collapse', 'expand', 
		'focused',
		function(elem){ return elem.value && elem.children },
		{iterateCollapsed: true}),

	// XXX need to make primary/secondary item actions more obvious...
	open: makeItemEventMethod('open', 
		function(evt, item){},
		function(){ return this.focused }),
	enter: makeItemEventMethod('enter', 
		function(evt, item){},
		function(){ return this.focused }),

	// Update state (make then render)...
	//
	// 	Update (re-render) the current state...
	// 	.update()
	// 	.update(options)
	// 		-> state
	//
	// 	Force re-make the state and re-render...
	// 	.update(true[, options])
	// 		-> state
	//
	//
	// NOTE: .update() is the same as .render()
	//
	// XXX calling this on a nested browser should update the whole thing...
	// 		...can we restore the context via .parent???
	update: makeEventMethod('update', function(evt, full, options){
		options = (full && full !== true && full !== false) ? 
			full 
			: options
		full = full === options ? 
			false 
			: full
		this
			.run(function(){
				full && this.make(options) })
			.render(options) }),
	
	// XXX target can be item or path...
	load: makeEventMethod('load', function(evt, target){}),

	close: makeEventMethod('close', function(evt, reason){}),
	

	// XXX should we update on init....
	__init__: function(func, options){
		this.__list__ = func
		this.options = Object.assign(
			Object.create(this.options || {}), 
			options || {})
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
// XXX add a left button type/option -- expand/collapse and friends...
var BrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
		__proto__: BaseBrowser.prototype.options,

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
		// NOTE: currently the options in the template will override 
		// 		anything explicitly given by item options... (XXX revise)
		elementShorthand: {
			'---': {
				'class': 'separator',
				'html': '<hr>',
				noniterable: true,
			},
			'...': {
				'class': 'separator',
				'html': '<center><div class="loader"/></center>',
				noniterable: true,
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
	// This does tow additional things:
	// 	- save the rendered state to .dom 
	// 	- wrap a list of nodes (nested list) in a div
	//
	// Format:
	// 	if list of items passed:
	// 		<div>
	// 			<!-- items -->
	// 			...
	// 		</div>
	// 	or same as .renderList(..)
	//
	// XXX revise...
	renderFinalize: function(items, context){
		var d = this.renderList(items, context)

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
	// 		<!-- children (optional) -->
	// 		...
	// 	</div>
	//
	// XXX register event handlers...
	renderNested: function(header, children, item, context){
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
		children instanceof Node ?
			e.appendChild(children)
		// XXX should this add the items to a container???
		: children instanceof Array ?
			children
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
	// XXX use item.events...
	renderNestedHeader: function(item, i, context){
		var that = this
		return this.renderItem(item, i, context)
			// update dom...
			.run(function(){
				// class...
				// XXX should be done here or in the config???
				this.classList.add('sub-list-header', 'traversable')
				item.collapsed
					&& this.classList.add('collapsed')

				// collapse action handler...
				// XXX make this overloadable...
				// XXX use item.events...
				$(this).on('open', function(evt){
					that.toggleCollapse(item) })
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
	// XXX should we trigger the DOM event or the browser event???
	renderItem: function(item, i, context){
		var that = this
		var options = context.options || this.options
		if(options.hidden && !options.renderHidden){
			return null
		}

		// special-case: item shorthands...
		if(item.value in options.elementShorthand){
			// XXX need to merge and not overwrite -- revise...
			Object.assign(item, options.elementShorthand[item.value])

			// NOTE: this is a bit of a cheat, but it saves us from either 
			// 		parsing or restricting the format...
			var elem = item.dom = $(item.html)[0]
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

		// system events...
		elem.addEventListener('click', 
			// XXX revise signature...
			// XXX should we trigger the DOM event or the browser event???
			function(){ $(elem).trigger('open', [text, item, elem]) })
		//elem.addEventListener('tap', 
		//	function(){ $(elem).trigger('open', [text, item, elem]) })
		elem.addEventListener('focus', 
			function(){ that.focus(item) })
		// user events...
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


	// Custom events...
	// XXX do we use jQuery event handling or vanilla?
	// 		...feels like jQuery here wins as it provides a far simpler
	// 		API + it's a not time critical area...
	// 		....another idea is to force the user to use the provided API
	// 		by not implementing ANY direct functionality in DOM -- I do
	// 		not like this idea at this point as it violates POLS...
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

	//next: function(){},
	//prev: function(){},

	//collapse: function(){},
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
		valueSeparator: ' ',
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
		value = value instanceof Array ? 
			value.join(this.options.valueSeparator || ' ')
			: value
		return item.current ?
			`[ ${value} ]`
   			: value },
	renderNested: function(header, children, context, item, options){
		var that = this
		var nested = children 
			&& children
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
