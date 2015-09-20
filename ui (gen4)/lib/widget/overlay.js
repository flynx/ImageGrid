/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> overlay')

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('../keyboard')
var object = require('../../object')
var widget = require('./widget')


/*********************************************************************/

var OverlayClassPrototype = {
	make: function(client, options){
		var that = this
		var overlay = $('<div>')
			.addClass('overlay-widget')
			.on(options.nonPropagatedEvents.join(' '), function(){
				event.stopPropagation()
			})
			.append($('<div>')
				.addClass('content')
				.click(function(){
					event.stopPropagation()
				})
				.append(client))

		return overlay
	},
}


var OverlayPrototype = {
	dom: null,
	client: null,

	options: {
		nonPropagatedEvents: [
			'click',
			'keydown',
		],
	},

	keyboard: {
		General: {
			pattern: '.browse-widget',

			Esc: 'close',
		},
	},

	// custom events...
	close: function(handler){
		// trigger the event...
		if(handler == null){
			this.dom.detach()
			if(this.parent.children('.overlay-widget').length == 0){
				this.parent.removeClass('blur')
			}
			this.trigger('close')

		// register a handler...
		} else {
			this.on('close', handler)
		}
	},

	__init__: function(parent, client, options){
		var that = this

		object.superMethod(Overlay, '__init__').call(this, parent, client, options)

		this.dom
			.click(function(){
				that.close()
			})

		this.parent
			.addClass('blur')
			.append(this.dom)

		// focus the client...
		if(client.focus){
			client.focus()
		}

		return this
	},
}



var Overlay = 
module.Overlay = 
object.makeConstructor('Overlay', 
		OverlayClassPrototype, 
		OverlayPrototype)


// inherit from widget...
Overlay.prototype.__proto__ = widget.Container.prototype



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
