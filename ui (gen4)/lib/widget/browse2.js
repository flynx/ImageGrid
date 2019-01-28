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
var Items = module.items = function(){}


Items.dialog = null
Items.items = null



// Focus last created item...
// XXX also would be nice to set the last created items to .last or 
// 		similar in the context...
Items.focus = function(){
}


//
//	.group(make(..), ..)
//		-> make
//
// Example:
// 	make.group(
// 		make(1),
// 		make(2),
// 		make(3),
// 		// literal item...
// 		4)
//
// XXX revise...
// XXX do we need to pass options to groups???
Items.group = function(...items){
	var that = this
	var made = items
		.filter(function(e){
			return e === that })
	var l = this.items.length - items.length
	// constructed item list...
	made = this.items.slice(l)
	// get the actual item values...
	items = items
		.map(function(e){
			return e === that ?
				made.shift()
				: e })

	// replace the items with the group...
	this.items.splice(l, items.length, items)

	return this
}

Items.nest = function(item, list, options){
	options = options || {}
	options.sublist = list
	return this(item, options)
}


// singular items...
// 
// 	.Item(value[, make][, options])
// 		-> ???
// 	
Items.Item = function(value, make, options){
	// XXX check if we are in a container -> create if needed and update context...
	// XXX ???

	// create item...
	return make(value, make, options)
}

Items.Action = function(value, make, options){
	options = Object.create(options || {})
	options.cls = (options.cls || '') + ' action'
	return this.Item(value, make, options)
}
Items.Heading = function(value, make, options){
	options = Object.create(options || {})
	options.cls = (options.cls || '') + ' heading'
	var attrs = options.doc ? {doc: options.doc} : {}
	attrs.__proto__ = options.attrs || {}
	options.attrs = attrs
	return this.Item(value, make, options)
}
Items.Empty = function(value){}
Items.Separator = function(value){}
Items.Spinner = function(value){}
Items.Selected = function(value){}
Items.Editable = function(value){}
Items.ConfirmAction = function(value){}

// groups...
Items.Group = function(items){}

// lists...
// 
// 	.List(values[, make][, options])
// 		-> ???
// 		
// XXX how do we indicate the selected item???
// 		- options.path / options.selected?
// 		- path argument?
Items.List = function(values){
	// XXX STUB...
	return this.embed(List(values))
}
Items.EditableList = function(values){}
Items.EditablePinnedList = function(values){}


// Special list components...
//
// XXX these should be normal items...
Items.ListPath = function(){}
Items.ListTitle = function(){}



//---------------------------------------------------------------------

var BaseBrowserClassPrototype = {
}

var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: null,

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
	// XXX format doc...
	// XXX should this be a list or a Map/Object????
	// 		...we do not need ultra fast traversal but we do need a way 
	// 		to identify and select items in a unique way...
	// XXX how do we handler nested lists???
	// 		...feels like a sub-list should be part of an item, i.e. 
	// 		create an item and place a list "into" it...
	// 		the question is whether this item should be:
	// 			- first item of sub-list
	// 			- connected to the sub-list but part of the parent list
	// 		...I'm leaning to the later...
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items
	},
	set items(value){
		this.__items = value },


	//
	// 	.__list__(make, options)
	// 		-> undefined
	// 		-> list
	//
	//
	// 	make(value, options)
	// 		-> make
	//
	//
	// There are two modes of operation:
	// 	1) call make(..) to create items
	// 	2) return a list of items
	//
	// The if make is called at least once the return value is ignored.
	//
	//
	// Example:
	// 	XXX
	//
	//
	// NOTE: this is not designed to be called directly...
	//
	// XXX not sure how to handle options in here -- see .make(..) and its notes...
	__list__: function(make, options){
		throw new Error('.__list__(..): Not implemented.') },


	// Make .items...
	//
	// 	.make()
	// 		-> this
	//
	// XXX revise options handling for .__list__(..)
	make: function(options){
		var items = this.items = []

		var make_called = false
		var make = function(value, opts){
			make_called = true
			items.push(Object.assign(
				{}, 
				options || {},
				opts || {}, 
				{value: value}))
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
	// Render main list...
	renderList: function(items, options){
		return items },
	// Render nested list...
	// NOTE: to skip rendering an item/list return null...
	renderSubList: function(sublist, item, options){
		return sublist },
	// Render group...
	renderGroup: function(items, options){
		return items },
	// Render list item...
	// NOTE: to skip rendering an item/list return null...
	renderItem: function(item, i, options){
		return item },

	// Render state...
	//
	//	.render()
	//	.render(options)
	//	.render(context)
	//		-> state
	//
	//
	// NOTE: currently options and context are distinguished only via 
	// 		the .options attribute... (XXX)
	//
	render: function(options){
		var that = this
		// XXX revise -- should options and context be distinguished only
		// 		via the .options attr???
		var context = (options == null || options.options == null) ?
				{
					root: this,
					// NOTE: we are not combining this with .options as nested 
					// 		lists can have their own unique sets of options 
					// 		independently of the root list...
					options: options || {},
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
		// 			- render context
		var items = this.items
			.map(_render = function(item, i){
				return (
					// group...
					item instanceof Array ?
						that.renderGroup(
							item.map(_render), options)
					// renderable item...
					: item.render instanceof Function ?
						that.renderSubList(
							item.render(context), 
							item, 
							options)
					// renderable value -- embedded list...
					: (item.value || {}).render instanceof Function ?
						that.renderSubList(
							item.value.render(context), 
							item, 
							options)
					// .sublist -- nested list...
					: item.sublist ?
						(item.collapsed ?
							// collapsed item...
							that.renderItem(item, i, options)
							// expanded item (grouped)...
							: that.renderGroup([ 
								that.renderItem(item, i, options),
								that.renderSubList(
									item.sublist.render instanceof Function ?
										// renderable...
										item.sublist.render(context)
										// list of items...
										: item.sublist.map(_render),
									item, 
									options) ], options))
					// basic item...
					: that.renderItem(item, i, options)) }) 
			.filter(function(e){
				return e != null })

		// determine the render mode...
		return context.root === this ?
			// root context -> render list and return this...
			this.renderList(items, options)
			// non-root context -> return items as-is...
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
			.render(this, options) },


	// XXX item API...
	get: function(){},
	set: function(){},
	remove: function(){},
	sort: function(){},
	splice: function(){},

	// XXX should there return an array or a .constructor(..) instance??
	forEach: function(){},
	map: function(){},
	filter: function(){},
	reduce: function(){},


	__init__: function(func, options){
		this.__list__ = func
		this.options = Object.assign(
			{}, 
			this.options || {}, 
			options || {})

		this.update()
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

// XXX maintain expand/collapse state of nested lists in a natural way...
var BrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {

	},
	
	dom: null,

	// Render main list...
	// XXX update dom...
	renderList: function(items, options){
		// XXX maintain header...
		return items },
	// Render nested list...
	// XXX list header
	// 		...is it the responsibility of sub-list or the parent list???
	// XXX save link to dom (???)
	renderSubList: function(sublist, item, options){
		// XXX expand/collapse state???
		return sublist },
	// Render group...
	renderGroup: function(items, options){
		return items },
	// Render list item...
	// XXX save link to dom in item.dom (???)
	renderItem: function(item, i, options){
		return item },

	// save the rendered state to .dom
	render: function(context, options){
		this.dom = object.parent(BrowserPrototype.render, this).call(this, ...arguments)
		return this.dom
	},


	filter: function(){},

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
// XXX how the header item and it's sublist should be linked???

var TextBrowserClassPrototype = {
	__proto__: BaseBrowser,
}

var TextBrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
		renderIndent: '\t',
	},
	
	renderList: function(items, options){
		var that = this
		return this.renderSubList(items, null, options)
			.join('\n') },
	renderSubList: function(sublist, item, options){
		var that = this
		return sublist
			.flat()
			.map(function(e){
				return e instanceof Array ?
					e.map(function(e){ return (that.options.renderIndent || '  ') + e })
					: e })
			.flat() },
	//renderGroup: function(items, options){
	//	return items },
	renderItem: function(item, i, options){
		var value = item.value || item
		return item.current ?
			`[ ${value} ]`
   			: value },
}


var TextBrowser = 
module.TextBrowser = 
object.makeConstructor('TextBrowser', 
		TextBrowserClassPrototype, 
		TextBrowserPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
