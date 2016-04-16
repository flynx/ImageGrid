/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

String.prototype.capitalize = function(){
	return this[0].toUpperCase() + this.slice(1)
}


// XXX not sure if this has to be a utility or a method...
Object.get = function(obj, name, dfl){
	var val = obj[name]
	if(val === undefined && dfl != null){
		return dfl
	}
	return val
}


// Compact a sparse array...
//
// NOTE: this will not compact in-place.
Array.prototype.compact = function(){
	return this.filter(function(){ return true })
}
/*
Array.prototype.compact = function(){
	var res = []
	for(var i in res){
		res.push(this[i])
	}
	return res
}
*/


// return an array with duplicate elements removed...
//
Array.prototype.unique = function(normalize){
	if(normalize){
		var cache = this.map(function(e){ return normalize(e) })
		return this.filter(function(e, i, a){ return cache.indexOf(cache[i]) == i })

	} else {
		return this.filter(function(e, i, a){ return a.indexOf(e) == i })
	}
}


// Compare two arrays...
//
Array.prototype.cmp = function(other){
	if(this === other){
		return true
	}
	if(this.length != other.length){
		return false
	}
	for(var i=0; i<this.length; i++){
		if(this[i] != other[i]){
			return false
		}
	}
	return true
}

// Compare two Arrays as sets...
//
// This will ignore order
Array.prototype.setCmp = function(other){
	return this === other 
		|| this.unique().sort().cmp(other.unique().sort())
}



// like .length but for sparse arrays will return the element count...
// XXX make this a prop...
/*
Array.prototype.len = function(){
	//return this.compact().length
	return Object.keys(this).length
}
*/

Object.defineProperty(Array.prototype, 'len', {
	get : function () {
		return Object.keys(this).length
	},
	set : function(val){},
});



// convert JS arguments to Array...
var args2array =
module.args2array =
function(args){
	//return Array.apply(null, args)
	return [].slice.call(args)
}

// Quote a string and convert to RegExp to match self literally.
var quoteRegExp =
module.quoteRegExp =
function(str){
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
}


// XXX do we need to quote anything else???
var path2url =
module.path2url =
function(path){
	// test if we have a schema, and if yes return as-is...
	if(/^(http|https|file|[\w-]*):[\\\/]{2}/.test(path)){
		return path
	}
	// skip encoding windows drives...
	var drive = path.split(/^([a-z]:[\\\/])/i)
	path = drive.pop()
	drive = drive.pop() || ''
	return drive + (path
		.split(/[\\\/]/g)
		// XXX these are too aggressive...
		//.map(encodeURI)
		//.map(encodeURIComponent)
		.join('/')
		// NOTE: keep '%' the first...
		//.replace(/%/g, '%25')
		.replace(/#/g, '%23')
		.replace(/&/g, '%26'))
}


// NOTE: we are not using node's path module as we need this to work in
// 		all contexts, not only node... (???)
var normalizePath = 
module.normalizePath =
function(path){
	return typeof(path) == typeof('str') ? path
			// normalize the slashes...
			.replace(/(\/)/g, '/')
			// remove duplicate '/'
			.replace(/(\/)\1+/g, '/')
			// remove trailing '/'
			.replace(/\/+$/, '')
			// take care of .
			.replace(/\/\.\//g, '/')
			.replace(/\/\.$/, '')
			// take care of ..
			.replace(/\/[^\/]+\/\.\.\//g, '/')
			.replace(/\/[^\/]+\/\.\.$/, '')
		: path
}



/*********************************************************************/

module.selectElemText = function(elem){
	var range = document.createRange()
	range.selectNodeContents(elem)
	var sel = window.getSelection()
	sel.removeAllRanges()
	sel.addRange(range)
}



/*********************************************************************/

// XXX experiment
if(typeof(jQuery) != typeof(undefined)){
	jQuery.fn._drag = function(){
		var dragging = false
		var s, 
			px, py

		var elem = $(this)
			.on('mousedown touchstart', function(evt){
				dragging = true
				px = evt.clientX
				px = evt.clientY

				s = elem.rscale()
			})
			.on('mousemove touchmove', function(evt){
				if(!dragging){
					return
				}

				var x = evt.clientX 
				var dx = px - x
				px = x

				var y = evt.clientY 
				var dy = py - y
				py = y

				elem
					.velocity('stop')
					.velocity({
						translateX: '-=' + (dx / s),
						translateY: '-=' + (dy / s),
					}, 0)
			})
			.on('mouseup touchend', function(evt){
				dragging = false
				elem.velocity('stop')
			})
	}


	jQuery.fn.selectText = function(){
		var range = document.createRange()

		this.each(function(){
			range.selectNodeContents(this)
		})

		var sel = window.getSelection()
		sel.removeAllRanges()
		sel.addRange(range)

		return this
	}


	var keyboard = require('lib/keyboard')

	// Make element editable...
	//
	// Options format:
	// 	{
	// 		multiline: false,
	//
	// 		reset_on_abort: true,
	// 		clear_on_edit: true,
	//
	// 		abort_keys: [
	// 			'Esc',
	// 			...
	// 		],
	// 	}
	//
	// XXX should we just use form elements???
	// 		...it's a trade-off, here we add editing functionality and fight
	// 		a bit the original function, in an input we'll need to fight part
	// 		of the editing functionality and add our own navigation...
	// XXX move this to a more generic spot...
	jQuery.fn.makeEditable = function(options){
		options = options || {}
		var that = this

		var original = this.text()

		if(options.clear_on_edit == null || options.clear_on_edit){
			this.text('')
		}

		this
			.prop('contenteditable', true)
			// make the element focusable and selectable...
			.attr('tabindex', '0')
			// NOTE: this will also focus the element...
			.selectText()
			.keydown(function(){ 
				if(!that.prop('contenteditable')){
					return
				}

				event.stopPropagation() 

				var n = keyboard.toKeyName(event.keyCode)

				// abort...
				if((options.abort_keys || ['Esc']).indexOf(n) >= 0){
					// reset original value...
					(options.reset_on_abort == null || options.reset_on_abort) 
						&& that.text(original)

					that
						.trigger('edit-aborted', original)

				// done -- single line...
				} else if(n == 'Enter' 
						&& !options.multiline){
					event.preventDefault()

					that.trigger('edit-done', that.text())

				// done -- multiline...
				} else if(n == 'Enter' 
						&& (event.ctrlKey || event.metaKey) 
						&& options.multiline){
					event.preventDefault()

					that.trigger('edit-done', that.text())
				}
			})

		return this
	}



}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
