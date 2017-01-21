/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/



/*********************************************************************/

String.prototype.capitalize = function(){
	return this == '' ? 
		this 
		: this[0].toUpperCase() + this.slice(1) }


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


var args2array =
module.args2array =
Array.fromArgs = 
	function(args){ return [].slice.call(args) }


module.chainCmp = function(cmp_chain){
	return function(a, b, get, data){
		var res
		for(var i=0; i < cmp_chain.length; i++){
			res = cmp_chain[i](a, b, get, data)
			if(res != 0){
				return res
			}
		}
		return res
	}
} 


// Get all the accessible keys...
//
// This is different to Object.keys(..) in that this will return keys
// from all the prototypes while .keys(..) will only return the keys
// defined in the last layer.
Object.deepKeys = function(obj){
	var res = []
	while(obj != null){
		res = res.concat(Object.keys(obj))
		obj = obj.__proto__
	}
	return res.unique()
}

// Make a full key set copy of an object...
//
// NOTE: this will not deep-copy the values...
Object.flatCopy = function(obj){
	var res = {}
	Object.deepKeys(obj).forEach(function(key){
		res[key] = obj[key]
	})
	return res
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



// Quote a string and convert to RegExp to match self literally.
var quoteRegExp =
RegExp.quoteRegExp =
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
			.replace(/\\/g, '/')
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
// NOTE: repatching a date should not lead to any side effects as this
// 		does not add any state...
var patchDate =
module.patchDate = function(date){
	date = date || Date

	date.prototype.toShortDate = function(){
		var y = this.getFullYear()
		var M = this.getMonth()+1
		M = M < 10 ? '0'+M : M
		var D = this.getDate()
		D = D < 10 ? '0'+D : D
		var H = this.getHours()
		H = H < 10 ? '0'+H : H
		var m = this.getMinutes()
		m = m < 10 ? '0'+m : m
		var s = this.getSeconds()
		s = s < 10 ? '0'+s : s

		return ''+y+'-'+M+'-'+D+' '+H+':'+m+':'+s
	}
	date.prototype.getTimeStamp = function(no_seconds){
		var y = this.getFullYear()
		var M = this.getMonth()+1
		M = M < 10 ? '0'+M : M
		var D = this.getDate()
		D = D < 10 ? '0'+D : D
		var H = this.getHours()
		H = H < 10 ? '0'+H : H
		var m = this.getMinutes()
		m = m < 10 ? '0'+m : m
		var s = this.getSeconds()
		s = s < 10 ? '0'+s : s

		return ''+y+M+D+H+m+s
	}
	date.prototype.setTimeStamp = function(ts){
		ts = ts.replace(/[^0-9]*/g, '')
		this.setFullYear(ts.slice(0, 4))
		this.setMonth(ts.slice(4, 6)*1-1)
		this.setDate(ts.slice(6, 8))
		this.setHours(ts.slice(8, 10))
		this.setMinutes(ts.slice(10, 12))
		this.setSeconds(ts.slice(12, 14))
		return this
	}
	date.timeStamp = function(){
		return (new this()).getTimeStamp()
	}
	date.fromTimeStamp = function(ts){
		return (new this()).setTimeStamp(ts)
	}
	// convert string time period to milliseconds...
	date.str2ms = function(str, dfl){
		dfl = dfl || 'ms'

		if(typeof(str) == typeof(123)){
			var val = str
			str = dfl

		} else {
			var val = parseFloat(str)
			str = str.trim()

			// check if a unit is given...
			str = str == val ? dfl : str
		}
		
		var c = /(m(illi)?(-)?s(ec(ond(s)?)?)?)$/i.test(str) ? 1
			: /s(ec(ond(s)?)?)?$/i.test(str) ? 1000
			: /m(in(ute(s)?)?)?$/i.test(str) ? 1000*60
			: /h(our(s)?)?$/i.test(str) ? 1000*60*60
			: /d(ay(s)?)?$/i.test(str) ? 1000*60*60*24
			: null

		return c ? val * c : NaN
	}

	return date
}
// patch the root date...
patchDate()



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
	// 		// activate (focus) element...
	// 		//
	// 		// NOTE: this will also select the element text...
	// 		activate: false,
	//
	// 		// set multi line edit mode...
	// 		multiline: false,
	//
	// 		// clear element value on edit...
	// 		clear_on_edit: false,
	//
	// 		// reset value on abort...
	// 		reset_on_abort: true,
	//
	// 		// blur element on abort/commit...
	// 		blur_on_abort: false,
	// 		blur_on_commit: false,
	//
	// 		// restore focus before disabling the editor...
	// 		keep_focus_on_parent: true,
	//
	// 		// clear selection on abort/commit...
	// 		clear_selection_on_abort: true,
	// 		clear_selection_on_commit: true,
	//
	// 		// Keys that will abort the edit...
	// 		abort_keys: [
	// 			'Esc',
	// 		],
	// 	}
	//
	// This listens to these events triggerable by user:
	// 	'edit-commit'		- will commit changes, this is passed the 
	// 							new text just edited.
	// 	'edit-abort'		- will reset field, this is passed the 
	// 							original text before the edit.
	//
	//
	// NOTE: removing tabindex will reset focus, so this will attempt to 
	// 		focus the first [tabindex] element up the tree...
	//
	// XXX add option to select the element on start or just focus it...
	// XXX multiline fields need to retain original function of arrows 
	// 		until we are at last line, then pass it through...
	// XXX should we just use form elements???
	// 		...it's a trade-off, here we add editing functionality and fight
	// 		a bit the original function, in an input we'll need to fight part
	// 		of the editing functionality and add our own navigation...
	// XXX move this to a more generic spot...
	jQuery.fn.makeEditable = function(options){
		var that = this

		if(options == false){
			this
				.removeAttr('contenteditable')
				.removeAttr('tabindex')
				.removeClass('editable-field')

			var events = this.data('editable-field-events')
			for(var e in events){
				this.off(e, events[e])
			}
			this.removeData('editable-field-events')

			return this
		}

		options = options || {}

		var original = this.text()

		this.prop('contenteditable', true)

		options.activate 
			&& options.clear_on_edit 
			&& this.text('')

		// NOTE: this will also focus the element...
		options.activate 
			&& this.selectText()

		// do not setup handlers more than once...
		if(!this.hasClass('editable-field')){
			var events = {}
			this
				// make the element focusable and selectable...
				.attr('tabindex', '0')
				.addClass('editable-field')
				.keydown(events.keydown = function(evt){ 
					if(!that.prop('contenteditable')){
						return
					}

					event.stopPropagation() 

					var n = keyboard.code2key(event.keyCode)

					// abort...
					if((options.abort_keys || ['Esc']).indexOf(n) >= 0){
						that.trigger('edit-abort', original)

					// done -- single line...
					} else if(n == 'Enter' 
							&& !options.multiline){
						event.preventDefault()

						that.trigger('edit-commit', that.text())

					// done -- multiline...
					} else if(n == 'Enter' 
							&& (event.ctrlKey || event.metaKey) 
							&& options.multiline){
						event.preventDefault()

						that.trigger('edit-commit', that.text())

					// continue handling...
					} else {
						$(this).parent().trigger(evt)
					}
				})
				.blur(events.blur = function(){
					window.getSelection().removeAllRanges()
				})
				.on('focus click', events['focus click'] = function(evt){
					evt.stopPropagation()
					options.clear_on_edit 
						&& $(this)
							.text('')
							.selectText()
				})
				// user triggerable events...
				.on('edit-abort', events['edit-abort'] = function(){
					options.clear_selection_on_abort !== false 
						&& window.getSelection().removeAllRanges()

					// reset original value...
					options.reset_on_abort !== false
						&& that.text(original)

					options.blur_on_abort !== false 
						&& this.blur() 

					// restore focus on parent...
					options.keep_focus_on_parent !== false
						&& that.parents('[tabindex]').first().focus()

					that.makeEditable(false)
				})
				.on('edit-commit', events['edit-commit'] = function(){
					options.clear_selection_on_commit !== false 
						&& window.getSelection().removeAllRanges()

					// reset original value...
					options.reset_on_commit !== false
						&& that.text(original)

					options.blur_on_commit !== false 
						&& this.blur() 

					// restore focus on parent...
					options.keep_focus_on_parent !== false
						&& that.parents('[tabindex]').first().focus()

					that.makeEditable(false)
				})

			this.data('editable-field-events', events)
		}

		return this
	}



}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
