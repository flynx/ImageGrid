/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('../keyboard')
var object = require('../object')




/*********************************************************************/
// helpers...

var proxyToDom =
module.proxyToDom = 
function(name){
	return function(){ 
		this.dom[name].apply(this.dom, arguments)
		return this 
	}
}


// XXX triggering events from here and from jQuery/dom has a 
// 		different effect...
var triggerEventWithSource =
module.triggerEventWithSource = 
function(){
	var args = args2array(arguments)
	var evt = args.shift()
	
	if(typeof(evt) == typeof('str')){
		evt = $.Event(evt)
	}

	evt.source = this

	args.splice(0, 0, evt)

	this.dom.trigger.apply(this.dom, args)
	return this 
}



/*********************************************************************/

var WidgetClassPrototype = {
	make: function(obj, client, options){
		console.error('Widget must define a .make method.')
	},
}


var WidgetPrototype = {
	dom: null,
	client: null,

	options: {
		nonPropagatedEvents: [
			'click',
			'keydown',

			'close',
		],
	},

	keyboard: null,

	// XXX triggering events from here and from jQuery/dom has a 
	// 		different effect...
	trigger: triggerEventWithSource,

	// proxy event api...
	on: proxyToDom('on'),
	one: proxyToDom('one'),
	off: proxyToDom('off'),
	bind: proxyToDom('bind'),
	unbind: proxyToDom('unbind'),
	deligate: proxyToDom('deligate'),
	undeligate: proxyToDom('undeligate'),


	// XXX this will not:
	// 		- attach dom to parent... (???)
	// 		- handle focus... (???)
	// XXX same as ContainerPrototype.__init__ but skips client...
	__init__: function(parent, options){
		var that = this

		parent = this.parent = $(parent || 'body')
		options = options || {}

		// merge options...
		var opts = Object.create(this.options)
		Object.keys(options).forEach(function(n){ opts[n] = options[n] })
		options = this.options = opts

		// build the dom...
		if(this.constructor.make){
			this.dom = this.constructor.make(this, options)
		}

		// XXX do we do this here???
		/*
		if(parent && this.dom){
			parent.append(this.dom)
		}
		*/

		// add keyboard handler...
		if(this.keyboard && this.dom){
			this.dom.keydown(
				keyboard.makeKeyboardHandler(
					this.keyboard,
					options.logKeys,
					this))
		}

		if(this.options.nonPropagatedEvents != null){
			this.on(this.options.nonPropagatedEvents.join(' '), 
				function(evt){ evt.stopPropagation() })
		}

		return this
	},
}


var Widget = 
module.Widget = 
object.makeConstructor('Widget', 
		WidgetClassPrototype, 
		WidgetPrototype)



/*********************************************************************/

var ContainerClassPrototype = {
}


var ContainerPrototype = {

	focus: function(handler){
		if(handler != null){
			this.on('focus', handler)

		} else {
			this.dom.focus()
			this.client
				&& this.client.focus 
				&& this.client.focus()
		}
		return this
	},

	// XXX this is the same as WidgetPrototype.__init__ but also handles
	// 		the client...
	__init__: function(parent, client, options){
		var that = this
		parent = this.parent = $(parent || 'body')
		options = options || {}

		this.client = client
		client.parent = this

		// merge options...
		var opts = Object.create(this.options)
		Object.keys(options).forEach(function(n){ opts[n] = options[n] })
		options = this.options = opts

		// build the dom...
		if(this.constructor.make){
			this.dom = this.constructor
				.make(this, client.dom || client, options)
		}

		// add keyboard handler...
		if(this.keyboard && this.dom){
			this.dom.keydown(
				keyboard.makeKeyboardHandler(
					this.keyboard,
					options.logKeys,
					this))
		}

		if(this.options.nonPropagatedEvents != null){
			this.on(this.options.nonPropagatedEvents.join(' '), 
				function(evt){ evt.stopPropagation() })
		}

		return this
	},
}


var Container = 
module.Container = 
object.makeConstructor('Container', 
		ContainerClassPrototype, 
		ContainerPrototype)

Container.prototype.__proto__ = Widget.prototype



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
