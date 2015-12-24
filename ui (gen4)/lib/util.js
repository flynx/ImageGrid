/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var object = require('lib/object')


/*********************************************************************/

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



// convert a transform string to an object...
//
// Format:
// 	{
// 		<func>: [<arg>, ...],
// 		...
// 	}
//
// NOTE: this does not care about the semantics of the format, just the 
// 		general structure...
var transform2obj = function(str){
	var res = {}
	str = str || ''
	// parse the string...
	str
		// split functions...
		.split(/(\w+\([^\)]*)\)/)
		// remove empty strings...
		.filter(function(e){ return e.trim().length > 0})
		// split each function...
		.map(function(e){ return e
			// split args...
			.split(/\s*[\(,\s]\s*/)
			// cleanup...
			.filter(function(e){ return e.trim().length > 0 }) })
		// build the structure...
		.forEach(function(data){
			var func = data.shift() 
			var args = data

			res[func] = data
		})
	return res
}

// Convert the object similar in structure to the produced by 
// transform2obj(..) to a transform string...
//
// NOTE: this does not care about the actual semantics of the format, 
// 		e.g. argument units or function names...
var obj2transform = function(obj, filter){
	// build the filters...
	filter = filter || []
	var keep = filter
		.filter(function(f){ return f[0] != '-' }) 
	var remove = filter
		.filter(function(f){ return f[0] == '-' })
		.map(function(f){ return f.slice(1) })

	return Object.keys(obj)
		// keep...
		.filter(function(func){ 
			return keep.length == 0 || keep.indexOf(func) >= 0 })
		// remove...
		.filter(function(func){ 
			return remove.indexOf(func) < 0 })
		.map(function(func){
			return func +'('+ obj[func].join(', ') + ')'
		})
		.join(' ')
} 


// XXX BUG: passing '' to an alias will clear ALL the aliased functions...
// 		...should clear only full matches...
// XXX BUG: passing '' to a multi-arg function will clear the args but 
// 		still keep the function...
// XXX BUG: setting a single arg alias will return string results...
// 			.x(123)		-> ['123px']	-> must be [123]
// 			.x()		-> [123]
// 			.translate3d(1,2,3)
// 						-> [1, 2, 3]
// 		NOTE: both set data correctly...
// XXX move the grammar out of this...
// XXX need:
// 		- a way to minimize this, i.e. get only full and minimal functions...
// 		- a way to get what was defined as-is...
// XXX STUB: .simplify(..) should be rewritten and be configurable...
// 		...preferable work on write -- set the alias that already esists
// 		and ignore the rest...
// XXX make aliases collect and merge data, e.g. asking for scale with 
// 		scaleX and scaleY set should return the combination of the two 
// 		results...
// XXX not critical yet but will need to support for completeness...
//		- transformStyle 
//		- prespective 
//		- prespectiveOrigin 
//		- backfaceVisibility
// XXX add transitions...
// XXX add support for vendor tags...
var transformEditor = function(){
	var editor = {
		// data set...
		data: {},

		// function that directly edit the data...
		__direct: {},


		// methods...
		// XXX generate this...
		simplify: function(filter){
			data = this.data

			// scale...
			if(data.scale 
					&& data.scale[0] == 1 
					&& data.scale[1] == 1){ delete data.scale }
			if((data.scaleX||[1])[0] == 1){ delete data.scaleX }
			if((data.scaleY||[1])[0] == 1){ delete data.scaleY }

			// translate...
			if(data.translate 
					&& data.translate.len == 2 
					&& parseFloat(data.translate[0]) == 0 
					&& parseFloat(data.translate[1]) == 0){ delete data.translate }
			if(data.translate3d
					&& data.translate3d.len == 3 
					&& parseFloat(data.translate3d[0]) == 0 
					&& parseFloat(data.translate3d[1]) == 1
					&& parseFloat(data.translate3d[2]) == 1){ delete data.translate3d }
			if(parseFloat((data.translateX||[1])[0]) == 0){ delete data.translateX }
			if(parseFloat((data.translateY||[1])[0]) == 0){ delete data.translateY }
			if(parseFloat((data.translateZ||[1])[0]) == 0){ delete data.translateZ }

			// XXX rotate...

			// XXX skew...

			return this.data
		},

		toString: function(){ 
			//return obj2transform(this.data, args2array(arguments)) 
			var args = args2array(arguments)
			return obj2transform(this.simplify(args), args) 
		},
		// NOTE: this will not build the alias data...
		fromString: function(str){ 
			this.data = transform2obj(str) 
			return this
		},
		// XXX use vendor prefix...
		toElem: function(elem){
			var origin = this.data.origin || ''
			var transform = this.toString('-origin')

			elem = elem instanceof jQuery ? elem.toArray() 
				: elem instanceof Array ? elem
				: [elem]

			elem.forEach(function(e){
				e.style.transformOrigin = origin.join ? origin.join(' ') : origin
				e.style.transform = transform
			})

			return this
		},

		// get data by attr names...
		get: function(){
			var that = this
			var attrs = arguments[0] instanceof Array ?
				arguments[0] 
				: args2array(arguments)
			var res = {}

			attrs.forEach(function(a){
				if(!(a in that)){
					return
				}
				var v = that[a]()
				v = v.length == 1 ? v.pop() 
					: v.length == 0 ? undefined
					: v
				res[a] = v
			})

			if(attrs.length == 1){
				return res[attrs[0]]
			}

			return res
		},

		// XXX use vendor prefix...
		__init__: function(str){
			this.data = {}

			if(str != null){
				if(str instanceof jQuery){
					str = str[0]
				}
				if(str instanceof HTMLElement){
					var origin = str.style.transformOrigin
					origin = origin.length > 0 ? ' origin('+ origin +')' : ''

					str = str.style.transform + origin
				}
				this.fromString(str)
			}
		},
	}

	var func = function(name, args){
		args = args || []
		editor.__direct[name] = function(val){
			var that = this
			// set...
			if(val != null && val != ''){
				val = val instanceof Array ? val : [val]
				var data = this.data[name] = this.data[name] || []
				var res = []
				// add units and general processing...
				val.map(function(arg, i){
					// special case, if an arg is undefined do not change it...
					if(arg === undefined){
						return 
					}
					var unit = args[i] || ''
					data[i] = typeof(arg) == typeof(123) 
							|| (typeof(arg) == typeof('str') 
								&& /^[0-9\.]+$/.test(arg)) ?
						arg + unit
						: arg
					res[i] = arg
				})
				return res

			// delete...
			} else if(val == ''){
				delete this.data[name]

			// get...
			} else {
				var res = (this.data[name] || [])
					// remove default unit...
					.map(function(arg, i){
						var unit = args[i] || ''
						return arg.slice(-unit.length) == unit 
								|| /^[0-9\.]+$/.test(arg)?
							parseFloat(arg)
							: arg
					})
				return res
			}
		}
	}
	
	var alias = function(spec, reduce, mode){
		reduce = reduce || 'last'
		// can be:
		// 	'first'
		// 	'last'
		// 	'all'
		mode = mode || 'first'
		// alias runner...
		var handler = function(alias, args){
			var that = this
			// we only care for the source argument and only it will get
			// passed next...
			// NOTE: this is the name of the called alias...
			var arg = args[spec[alias]]

			var aliases = Object.keys(spec)

			return aliases.map(function(k, j){
					var i = spec[k]

					// get state...
					if(args.length == 0){
						var res = k in that.__direct ? 
							that.__direct[k].call(that) 
							: null
						return res != null ? res[i] : res
					}

					// prepare arguments...
					var a = []
					a[i] = mode == 'first' && j == 0 ? arg
						: mode == 'last' && j == aliases.length - 1 ? arg
						: reduce == 'sum' ? 0
						: reduce == 'mul' ? 1
						: arg

					// do the call...
					var res = k in that.__direct ?
						that.__direct[k].call(that, a) 
						: null
					return res != null ? res[i] : res
				})
				.filter(function(e){ return e != null })
				.reduce(reduce == 'sum' ? function(a, b){ return a + b }
					: reduce == 'mul' ? function(a, b){ return a * b }
					: reduce == 'last' ? function(a, b){ return b != null ? b : a }
					: reduce)
		}

		// setup the aliases...
		var aliases = Object.keys(spec)

		mode == 'last' && aliases.reverse()

		aliases.forEach(function(k){
			var i = spec[k]

			var func = i instanceof Function ? i : handler

			// NOTE: we will pass the called alias name to the handler 
			// 		via 'this'...
			var f = editor[k]
			var alias = editor[k] = f ? 
				// wrap the original alias...
				// NOTE: this will iterate the overloaded aliases... 
				// 		i.e. this will iterate the arguments (width) while 
				// 		the handler(..) will iterate the aliases...
				function(){
					var args = args2array(arguments)
					// XXX do a full search through the alias values and merge results...
					if(args.length == 0 && k in this.__direct){
						return this.__direct[k].call(this)
					}

					var a = f.apply(this, args)
					var b = func.call(this, k, args)

					if(k in this.__direct){
						return this.__direct[k].call(this)
					}
					return b
				} 
				: function(){ 
					var args = args2array(arguments)
					return func.call(this, k, args) 
				}

			alias.isAlias = true
			alias.reduce = reduce
		})
	}

	// XXX get these from grammar...
	func('translate', ['px', 'px'])
	func('translate3d', ['px', 'px', 'px'])
	func('translateX', ['px'])
	func('translateY', ['px'])
	func('translateZ', ['px'])
	alias({ translate3d: 0, translate: 0, translateX: 0, x: 0 }, 'sum')
	alias({ translate3d: 1, translate: 1, translateY: 0, y: 0, }, 'sum')
	alias({ translate3d: 2, translateZ: 0, z: 0, }, 'sum') 

	func('scale', ['', ''])
	//func('scale3d', ['', '', ''])
	func('scaleX')
	func('scaleY')
	//func('scaleZ')
	alias({ scale: 0, /*scale3d: 0,*/ scaleX: 0, }, 'mul')
	alias({ scale: 1, /*scale3d: 1,*/ scaleY: 0, }, 'mul')
	//alias({ scale3d: 2, scaleZ: 0, }, 'mul')

	// special case: single arg scale: scale(n) -> scale(n, n)
	editor._scale = editor.scale
	editor.scale = function(){
		if(arguments.length == 1 
				&& arguments[0] != '' 
				&& arguments[0] != '='){
			return this._scale.call(this, arguments[0], arguments[0])
		}
		var res = this._scale.apply(this, arguments)
		// is this correct here???
		return res.length == 2 && res[0] == res[1] ? res[0] : res
	}

	func('rotate', ['deg'])
	func('rotate3d', ['px', 'px', 'px', 'deg'])
	func('rotateX', ['deg'])
	func('rotateY', ['deg'])
	func('rotateZ', ['deg'])

	func('matrix') // XXX ???
	func('matrix3d', [
		'', '', '', '',
		'', '', '', '',
		'', '', '', '',
		'', '', '', '',
	])

	func('skew', ['', ''])
	func('skewX')
	func('skewY')
	alias({skewX: 0, skew: 0})
	alias({skewY: 0, skew: 1})

	func('perspective')


	// non-transform functions...
	func('origin', ['px', 'px', 'px'])


	// proxy the undefined in aliases functions...
	Object.keys(editor.__direct).forEach(function(k){
		if(!(k in editor)){
			editor[k] = function(){ 
				var args = args2array(arguments)
				editor.__direct[k].apply(this, args.length > 0 ? [args]: [])
				return editor.__direct[k].call(this)
			}
		}
	})

	return editor
}


var TransformEditor = 
module.TransformEditor =
object.makeConstructor('TransformEditor', transformEditor())

// XXX STUB: for testing only...
window.transformEditor = TransformEditor


// jQuery API for the TransformEditor...
jQuery.fn.transform = function(){
	var that = this
	var elem = $(this)[0]

	var args = args2array(arguments)
	// normalize...
	args = args.length == 0 
			|| typeof(args[0]) == typeof('str') ? args
		: args[0].constructor === Array 
			|| args.length == 1 ? args[0]
		: args

	// load the current state...
	var transform = TransformEditor(elem)

	// get state...
	if(args.constructor === Array){
		if(args.length == 0){
			// XXX get all attrs...
			// XXX

			return
		}

		// get requested attrs...
		return transform.get(args)

	// set state...
	} else {
		// load user inputs...
		Object.keys(args).forEach(function(k){
			if(!(k in transform)){
				return
			}

			transform[k].apply(transform, args[k] instanceof Array ? args[k] : [args[k]])
		})

		transform.toElem(this)
	}

	return $(this)
}


// shorthands...
jQuery.fn.scale = function(value){
	if(arguments.length > 0){
		return $(this).transform({scale: args2array(arguments)})

	} else {
		return $(this).transform('scale')
	}
}
// get element scale... 
jQuery.fn.getscale = function(){
	var res = 1
	$(this).parents().toArray().forEach(function(e){
		res *= $(e).scale() || 1
	})
	return res
}
jQuery.fn.origin = function(a, b, c){
	if(a != null && b != null){
		return $(this).transform({origin: [a, b, c == null ? 0 : c]})

	} else if(a == '' || a instanceof Array){
		return $(this).transform({origin: a})

	} else {
		return $(this).transform('origin')
	}
}



//---------------------------------------------------------------------

// XXX experiment
jQuery.fn._drag = function(){
	var dragging = false
	var s, 
		px, py

	var elem = $(this)
		.on('mousedown touchstart', function(evt){
			dragging = true
			px = evt.clientX
			px = evt.clientY

			s = elem.getscale()
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



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
